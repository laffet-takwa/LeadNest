/**
 * Unit tests for the date-only helpers.
 *
 * A business date must never move because of the time zone of the machine, so
 * the parsing and formatting are checked against a negative UTC offset.
 */

import { describe, expect, it } from 'vitest'

import { formatDateOnly, parseDateOnly } from '@/lib/utils/date'

describe('parseDateOnly', () => {
  it('reads the parts as a local date', () => {
    const parsed = parseDateOnly('2026-03-12')
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(2)
    expect(parsed?.getDate()).toBe(12)
  })

  it('keeps the day even in a negative UTC offset', () => {
    // `new Date('2026-03-12')` is parsed as UTC midnight, which is the
    // previous day west of Greenwich. The helper must not do that.
    const parsed = parseDateOnly('2026-03-12')
    expect(parsed?.getDate()).toBe(12)
  })

  it('returns null for an empty or malformed value', () => {
    expect(parseDateOnly('')).toBeNull()
    expect(parseDateOnly('2026-3-1')).toBeNull()
    expect(parseDateOnly('12/03/2026')).toBeNull()
    expect(parseDateOnly(undefined)).toBeNull()
  })

  it('rejects a date that does not exist', () => {
    expect(parseDateOnly('2026-02-31')).toBeNull()
  })
})

describe('formatDateOnly', () => {
  it('writes the parts back in the API format', () => {
    expect(formatDateOnly(new Date(2026, 2, 12))).toBe('2026-03-12')
  })

  it('pads single digit months and days', () => {
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('round-trips a parsed value', () => {
    const parsed = parseDateOnly('2026-12-31')
    expect(parsed).not.toBeNull()
    expect(formatDateOnly(parsed as Date)).toBe('2026-12-31')
  })
})
