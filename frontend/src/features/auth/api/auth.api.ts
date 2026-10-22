/**
 * Authentication API calls.
 *
 * The endpoints and payload shapes mirror the backend's auth handler.
 */

import { getOne, patch, post, request } from '@/lib/api/client'
import type {
  AuthTokens,
  ChangePasswordPayload,
  Company,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types/api'

/** `POST /auth/register` — creates a company and its first administrator. */
export async function register(payload: RegisterPayload): Promise<AuthTokens> {
  return post<AuthTokens>('/auth/register', payload, { anonymous: true })
}

/** `POST /auth/login` — exchanges credentials for an access token. */
export async function login(payload: LoginPayload): Promise<AuthTokens> {
  return post<AuthTokens>('/auth/login', payload, { anonymous: true })
}

/** `POST /auth/refresh` — exchanges a refresh token for a new access token. */
export async function refresh(refreshToken: string): Promise<AuthTokens> {
  return post<AuthTokens>('/auth/refresh', { refresh_token: refreshToken }, { anonymous: true })
}

/** `GET /auth/me` — the signed-in user. */
export async function me(): Promise<User> {
  const response = await request<{ data: { user: User } }>('/auth/me')
  return response.data.user
}

/**
 * `PATCH /auth/me/password` — changes the signed-in user's password.
 *
 * The backend rotates the session and returns fresh tokens, so the caller
 * stays signed in without signing in again.
 */
export async function changePassword(payload: ChangePasswordPayload): Promise<AuthTokens> {
  return patch<AuthTokens>('/auth/me/password', payload)
}

/** `POST /auth/logout` — revokes the stored refresh token. */
export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}

/** `GET /companies/me` — the caller's company. */
export async function company(): Promise<{ company: Company }> {
  return getOne<{ company: Company }>('/companies/me')
}
