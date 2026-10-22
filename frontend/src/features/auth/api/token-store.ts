/**
 * Token storage.
 *
 * The LeadNest backend issues bearer tokens in the response body; it does not
 * set HttpOnly cookies, so the browser has to hold the token itself. The
 * strategy below is the best available without a server-side cookie change:
 *
 * - The **access token** is kept in memory only. It is never written to
 *   `localStorage` or `sessionStorage`, so it cannot be read from disk after
 *   the tab is closed, and it does not survive a reload.
 * - The **refresh token** is persisted in `localStorage` so that a reload can
 *   silently restore the session without a second login.
 *
 * Trade-off: a refresh token in `localStorage` is readable by any script that
 * runs in the origin, so a successful XSS attack could steal it. The
 * alternative — never persisting the refresh token — turns every reload into
 * a login, which is worse for a daily-driver CRM. Note that the backend only
 * rotates the refresh token on login, registration and password change — not
 * on `/auth/refresh` — so the same opaque token is replayed until the user
 * signs in again, and a second login replaces it and invalidates this session.
 * Moving to HttpOnly cookies requires a backend change and is documented as
 * the recommended follow-up.
 */

const REFRESH_TOKEN_KEY = 'leadnest.refresh_token'

function storage(): Storage | null {
  try {
    // Accessing localStorage throws in some privacy modes.
    return window.localStorage
  } catch {
    return null
  }
}

/** Reads the persisted refresh token, if any. */
export function readRefreshToken(): string | null {
  const store = storage()
  if (!store) return null
  try {
    return store.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

/** Persists the refresh token so the session survives a reload. */
export function writeRefreshToken(token: string): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(REFRESH_TOKEN_KEY, token)
  } catch {
    // A storage failure is not fatal: the session simply ends at reload.
  }
}

/** Removes the persisted refresh token. */
export function clearRefreshToken(): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Nothing to do.
  }
}
