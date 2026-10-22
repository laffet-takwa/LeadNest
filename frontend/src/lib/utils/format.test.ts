/**
 * Tests for the formatting helpers.
 *
 * Money is the risky part: the backend sends decimal strings and the client
 * must never turn them into floats.
 */

import { describe, expect, it } from 'vitest'

import {
  addAmounts,
  formatAmount,
  formatCompactNumber,
  formatMoney,
  sumByCurrency,
} from '@/lib/utils/format'

describe('formatAmount', () => {
  it('adds thousands separators and keeps two decimals', () => {
    expect(formatAmount('1500.5')).toBe('1,500.50')
    expect(formatAmount('1234567.89')).toBe('1,234,567.89')
  })

  it('handles integers and empty values', () => {
    expect(formatAmount('100')).toBe('100.00')
    expect(formatAmount('')).toBe('0.00')
    expect(formatAmount(null)).toBe('0.00')
    expect(formatAmount(undefined)).toBe('0.00')
  })

  it('keeps the sign of a negative amount', () => {
    expect(formatAmount('-42.5')).toBe('-42.50')
  })

  it('does not accumulate binary floating point error', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point.
    const total = addAmounts(['0.1', '0.2'])
    expect(total).toBe('0.30')
  })
})

describe('formatMoney', () => {
  it('always shows the currency code', () => {
    expect(formatMoney({ amount: '1500.5', currency: 'TND' })).toBe('1,500.50 TND')
  })

  it('handles a missing value', () => {
    expect(formatMoney(null)).toBe('—')
  })
})

describe('addAmounts', () => {
  it('adds decimal amounts exactly', () => {
    expect(addAmounts(['10.10', '20.20'])).toBe('30.30')
    expect(addAmounts([])).toBe('0.00')
  })
})

describe('sumByCurrency', () => {
  it('never mixes currencies', () => {
    const result = sumByCurrency([
      { amount: '100.00', currency: 'TND' },
      { amount: '50.00', currency: 'USD' },
      { amount: '25.50', currency: 'TND' },
    ])

    expect(result).toHaveLength(2)
    const tnd = result.find((entry) => entry.currency === 'TND')
    const usd = result.find((entry) => entry.currency === 'USD')
    expect(tnd?.amount).toBe('125.50')
    expect(usd?.amount).toBe('50.00')
  })
})

describe('formatCompactNumber', () => {
  it('keeps small numbers exact', () => {
    expect(formatCompactNumber(999)).toBe('999')
  })

  it('compacts large numbers', () => {
    expect(formatCompactNumber(1200)).toMatch(/1\.2/)
  })
})
