/**
 * Typed HTTP client for the LeadNest API.
 *
 * The client owns every network detail: the base URL, the Authorization
 * header, JSON encoding, timeouts and error normalisation. Feature code never
 * calls `fetch` directly.
 */

import type { ApiErrorBody, ApiErrorCode, ApiList, ApiSuccess } from '@/types/api'

/** Base URL of the API, including the /api/v1 prefix. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')

/** Default request timeout. */
const DEFAULT_TIMEOUT_MS = 20_000

/** The error codes the backend returns, plus the two the client raises. */
const ERROR_CODES: readonly ApiErrorCode[] = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'AI_NOT_CONFIGURED',
  'AI_TIMEOUT',
  'AI_PROVIDER_ERROR',
  'AI_EMPTY_RESPONSE',
  'METHOD_NOT_ALLOWED',
  'ABORTED',
  'NETWORK_ERROR',
]

/**
 * Checks whether a code is one the application knows about.
 *
 * The backend may add codes, so the check is a guard rather than a cast.
 */
function isApiErrorCode(code: string): code is ApiErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code)
}

/**
 * Normalises an error code.
 *
 * A code the application does not know about is reported as
 * `INTERNAL_ERROR`, so a caller can never act on a code it was not written
 * for. The original code stays available on the error itself.
 */
function toErrorCode(code: string): ApiErrorCode {
  return isApiErrorCode(code) ? code : 'INTERNAL_ERROR'
}

/**
 * A failed API call.
 *
 * The message is safe to show to a user: the backend never puts SQL errors or
 * stack traces in the response body.
 */
export class ApiError extends Error {
  readonly status: number
  /** The normalised code, always one the application reacts to. */
  readonly code: ApiErrorCode
  /** The code exactly as the server sent it. */
  readonly rawCode: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.rawCode = code
    this.code = toErrorCode(code)
    this.details = details
  }

  /** True when the caller must sign in again. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** True when the request was aborted by the caller or a timeout. */
  get isAborted(): boolean {
    return this.status === 0
  }

  /**
   * Returns a map of field name to message when the backend rejected
   * individual fields, so a form can show the error next to each input.
   */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {}
    const out: Record<string, string> = {}
    for (const entry of this.details) {
      if (
        typeof entry === 'object' &&
        entry !== null &&
        'field' in entry &&
        'reason' in entry &&
        typeof (entry as { field: unknown }).field === 'string' &&
        typeof (entry as { reason: unknown }).reason === 'string'
      ) {
        out[(entry as { field: string }).field] = (entry as { reason: string }).reason
      }
    }
    return out
  }
}

/** Provides the current access token, or null when the user is signed out. */
export type TokenProvider = () => string | null

/** Called when the API rejects a request because the session expired. */
export type UnauthorizedHandler = () => void

let getToken: TokenProvider = () => null
let onUnauthorized: UnauthorizedHandler = () => undefined

/** Registers the access-token source used for every request. */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider
}

/** Registers the callback invoked when the backend returns 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  onUnauthorized = handler
}

type QueryValue = string | number | boolean | undefined | null

/** Builds a query string, skipping empty values. */
export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

/** Parses a response body, tolerating an empty body. */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** Turns a non-2xx response into a normalised ApiError. */
async function toApiError(response: Response): Promise<ApiError> {
  const body = await parseBody(response)
  if (body && typeof body === 'object' && 'error' in body) {
    const errorBody = body as ApiErrorBody
    const { code, message, details } = errorBody.error
    return new ApiError(response.status, code, message || 'Request failed', details)
  }
  if (response.status === 429) {
    return new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again.')
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, QueryValue>
  signal?: AbortSignal
  timeoutMs?: number
  /** Send no Authorization header (used by the public auth endpoints). */
  anonymous?: boolean
}

/**
 * Performs a request against the API and returns the decoded body.
 *
 * @throws ApiError for any non-2xx response or a network failure.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, timeoutMs = DEFAULT_TIMEOUT_MS, anonymous } = options

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  // Forward an external abort (for example a query cancellation) to our signal.
  const onExternalAbort = () => controller.abort()
  signal?.addEventListener('abort', onExternalAbort)

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!anonymous) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'ABORTED', 'The request was cancelled')
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
      error,
    )
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) {
    const apiError = await toApiError(response)
    // A 401 on a public endpoint (login, register, refresh) means the
    // credentials were wrong, not that the session expired. Only an
    // authenticated request can end the session.
    if (apiError.isUnauthorized && !anonymous) onUnauthorized()
    throw apiError
  }

  if (response.status === 204) {
    return undefined as T
  }
  return (await parseBody(response)) as T
}

/** GET a single resource and unwrap the `data` envelope. */
export async function getOne<T>(path: string, options?: RequestOptions): Promise<T> {
  const response = await request<ApiSuccess<T>>(path, options)
  return response.data
}

/** GET a list and unwrap the `data` and `meta` envelopes. */
export async function getList<T>(
  path: string,
  options?: RequestOptions,
): Promise<{ data: T[]; meta: ApiList<T>['meta'] }> {
  const response = await request<ApiList<T>>(path, options)
  return { data: response.data ?? [], meta: response.meta }
}

/** POST a payload and unwrap the `data` envelope. */
export async function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const response = await request<ApiSuccess<T>>(path, { ...options, method: 'POST', body })
  return response.data
}

/** PATCH a payload and unwrap the `data` envelope. */
export async function patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const response = await request<ApiSuccess<T>>(path, { ...options, method: 'PATCH', body })
  return response.data
}

/** DELETE a resource. The backend answers with 204 and no body. */
export async function remove(path: string, options?: RequestOptions): Promise<void> {
  await request<void>(path, { ...options, method: 'DELETE' })
}
