/**
 * Authentication context.
 *
 * Owns the session: the current user, the in-memory access token and the
 * silent refresh that keeps the session alive across reloads.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { setTokenProvider, setUnauthorizedHandler } from '@/lib/api/client'
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from '../api/token-store'
import * as authApi from '../api/auth.api'
import type {
  AuthTokens,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  /** True when the user is an administrator. */
  isAdmin: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  /** Changes the signed-in user's password and rotates the session. */
  changePassword: (payload: ChangePasswordPayload) => Promise<void>
  /** True when the session ended and the user has to sign in again. */
  sessionExpired: boolean
  setSessionExpired: (expired: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Milliseconds before expiry at which the token is refreshed proactively. */
const REFRESH_MARGIN_MS = 60_000

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)

  // The access token lives in a ref so it is available to the API client
  // without being part of the React render cycle.
  const accessTokenRef = useRef<string | null>(null)
  const refreshTimerRef = useRef<number | null>(null)
  const refreshInFlight = useRef<Promise<AuthTokens | null> | null>(null)
  // `performRefresh` and `scheduleRefresh` depend on each other. A ref breaks
  // the cycle so the scheduled timer always calls the current implementation.
  const performRefreshRef = useRef<() => Promise<AuthTokens | null>>(() => Promise.resolve(null))

  const clearSession = useCallback(() => {
    accessTokenRef.current = null
    clearRefreshToken()
    setUser(null)
    setStatus('anonymous')
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  /** Schedules a proactive refresh shortly before the token expires. */
  const scheduleRefresh = useCallback((tokens: AuthTokens) => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    const expiresInMs = Math.max(tokens.expires_in, 0) * 1000
    const delay = Math.max(expiresInMs - REFRESH_MARGIN_MS, 5_000)
    refreshTimerRef.current = window.setTimeout(() => {
      void performRefreshRef.current()
    }, delay)
  }, [])

  const applyTokens = useCallback(
    (tokens: AuthTokens) => {
      accessTokenRef.current = tokens.access_token
      setUser(tokens.user)
      setStatus('authenticated')
      if (tokens.refresh_token) writeRefreshToken(tokens.refresh_token)
      scheduleRefresh(tokens)
    },
    [scheduleRefresh],
  )

  /**
   * Exchanges the stored refresh token for a new access token. Concurrent
   * callers share a single in-flight request so a burst of 401s does not
   * trigger a burst of refreshes.
   */
  const performRefresh = useCallback(async (): Promise<AuthTokens | null> => {
    if (refreshInFlight.current) return refreshInFlight.current

    const stored = readRefreshToken()
    if (!stored) {
      clearSession()
      return null
    }

    const promise = (async () => {
      try {
        const tokens = await authApi.refresh(stored)
        applyTokens(tokens)
        return tokens
      } catch {
        clearSession()
        return null
      } finally {
        refreshInFlight.current = null
      }
    })()

    refreshInFlight.current = promise
    return promise
  }, [applyTokens, clearSession])

  // Keep the ref pointing at the current implementation. The assignment
  // happens in an effect, so the render pass stays free of side effects.
  useEffect(() => {
    performRefreshRef.current = performRefresh
  }, [performRefresh])

  // Register the token source and the 401 handler with the API client.
  useEffect(() => {
    setTokenProvider(() => accessTokenRef.current)
    setUnauthorizedHandler(() => {
      // A 401 means the access token is no longer accepted. Try to renew
      // once; if that fails the session is over.
      void performRefresh().then((tokens) => {
        if (!tokens) setSessionExpired(true)
      })
    })
  }, [performRefresh])

  // Restore a session on first load.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = readRefreshToken()
      if (!stored) {
        if (!cancelled) setStatus('anonymous')
        return
      }
      const tokens = await performRefresh()
      if (cancelled) return
      if (!tokens) {
        setStatus('anonymous')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [performRefresh])

  // Clear the refresh timer when the provider unmounts.
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokens = await authApi.login(payload)
      setSessionExpired(false)
      applyTokens(tokens)
    },
    [applyTokens],
  )

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const tokens = await authApi.register(payload)
      setSessionExpired(false)
      applyTokens(tokens)
    },
    [applyTokens],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The session is cleared locally even if the server call fails.
    }
    clearSession()
  }, [clearSession])

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload) => {
      // The backend rotates the session, so the new tokens are applied and
      // the user keeps working without signing in again.
      const tokens = await authApi.changePassword(payload)
      applyTokens(tokens)
    },
    [applyTokens],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      changePassword,
      sessionExpired,
      setSessionExpired,
    }),
    [status, user, login, register, logout, changePassword, sessionExpired],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Returns the authentication context. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
