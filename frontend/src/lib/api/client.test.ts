/**
 * Tests for the API client.
 *
 * The error parsing is the part most likely to break silently, so it is
 * covered in detail.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, buildQuery, request, setTokenProvider, setUnauthorizedHandler } from '@/lib/api/client'

describe('buildQuery', () => {
  it('returns an empty string when there is nothing to send', () => {
    expect(buildQuery()).toBe('')
    expect(buildQuery({})).toBe('')
  })

  it('skips empty values', () => {
    expect(buildQuery({ a: 'x', b: undefined, c: null, d: '' })).toBe('?a=x')
  })

  it('encodes booleans and numbers', () => {
    expect(buildQuery({ overdue: true, limit: 20 })).toBe('?overdue=true&limit=20')
  })
})

/** A minimal stand-in for the parts of `Response` the client uses. */
interface MockResponse {
  ok: boolean
  status: number
  text: () => Promise<string>
}

function mockFetch(response: Partial<MockResponse>) {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ data: { id: '1' } })),
    ...response,
  })
  global.fetch = mock
  return mock
}

/** Reads the init object of the first call the mock received. */
function firstInit(mock: { mock: { calls: unknown[][] } }): RequestInit {
  const call = mock.mock.calls[0]
  const init = call?.[1]
  if (init && typeof init === 'object') {
    return init as RequestInit
  }
  return {}
}
describe('request', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    setTokenProvider(() => 'test-token')
    setUnauthorizedHandler(() => undefined)
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends the Authorization header', async () => {
    const mock = mockFetch({})
    await request('/customers')
    const init = firstInit(mock)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('omits the Authorization header for anonymous requests', async () => {
    const mock = mockFetch({})
    await request('/auth/login', { method: 'POST', anonymous: true })
    const init = firstInit(mock)
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('parses a validation error into field errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'The request contains invalid fields',
              details: [
                { field: 'email', reason: 'must be a valid email' },
                { field: 'full_name', reason: 'is required' },
              ],
            },
          }),
        ),
    })

    await expect(request('/customers', { method: 'POST', body: {} })).rejects.toThrowError(ApiError)

    try {
      await request('/customers', { method: 'POST', body: {} })
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(422)
      expect(apiError.code).toBe('VALIDATION_ERROR')
      expect(apiError.fieldErrors).toEqual({
        email: 'must be a valid email',
        full_name: 'is required',
      })
    }
  })

  it('reports a 404 as not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'not found' } })),
    })

    try {
      await request('/customers/1')
      expect.unreachable('the request should have failed')
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(404)
      expect(apiError.isUnauthorized).toBe(false)
    }
  })

  it('reports a rate limit', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve(''),
    })

    try {
      await request('/customers')
      expect.unreachable('the request should have failed')
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(429)
      expect(apiError.code).toBe('RATE_LIMITED')
    }
  })

  it('reports a network failure without leaking internals', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))

    try {
      await request('/customers')
      expect.unreachable('the request should have failed')
    } catch (error) {
      const apiError = error as ApiError
      expect(apiError.status).toBe(0)
      expect(apiError.message).toContain('Could not reach the server')
    }
  })

  it('calls the unauthorized handler on a 401', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'nope' } })),
    })

    await expect(request('/customers')).rejects.toThrowError(ApiError)
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
