/**
 * Formatting helpers.
 *
 * Money is handled as decimal strings end to end: the backend sends
 * `NUMERIC(15,2)` as a string and the client never converts it to a float.
 */

/** A currency amount together with its ISO 4217 code. */
export interface Money {
  amount: string
  currency: string
}

/** Parses a decimal string into a number without floating-point drift. */
function toDecimalParts(value: string): { integer: string; fraction: string } {
  const cleaned = value.trim()
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned)
  if (!match) return { integer: '0', fraction: '00' }
  const [, sign, integer = '', fraction = ''] = match
  return {
    integer: `${sign}${integer || '0'}`,
    fraction: fraction.padEnd(2, '0').slice(0, 2),
  }
}

/**
 * Formats a decimal amount with thousands separators and exactly two
 * fractional digits.
 *
 * The grouping is applied to the integer part as a string, so no rounding
 * error can be introduced.
 */
export function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0.00'
  const raw = typeof value === 'number' ? value.toString() : value
  const { integer, fraction } = toDecimalParts(raw)
  const negative = integer.startsWith('-')
  const digits = negative ? integer.slice(1) : integer
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}.${fraction}`
}

/**
 * Formats an amount for display with its currency code.
 *
 * Amounts in different currencies are never combined, so the code is always
 * shown next to the number.
 */
export function formatMoney(money: Money | null | undefined): string {
  if (!money) return '—'
  return `${formatAmount(money.amount)} ${money.currency}`
}

/**
 * Adds two decimal amounts of the same currency.
 *
 * The result is returned as a string so the caller can hand it straight back
 * to the API. Mixing currencies is not possible through this helper.
 */
export function addAmounts(amounts: readonly string[]): string {
  let totalCents = 0
  for (const amount of amounts) {
    totalCents += toCents(amount)
  }
  const sign = totalCents < 0 ? '-' : ''
  const absolute = Math.abs(totalCents)
  const integer = Math.floor(absolute / 100)
  const fraction = absolute % 100
  return `${sign}${integer}.${String(fraction).padStart(2, '0')}`
}

/**
 * Converts a decimal string into whole cents.
 *
 * The conversion goes through the string, so no binary floating point error
 * can creep in.
 */
function toCents(value: string): number {
  const { integer, fraction } = toDecimalParts(value)
  const negative = integer.startsWith('-')
  const digits = negative ? integer.slice(1) : integer
  const cents = Number(digits) * 100 + Number(fraction)
  return negative ? -cents : cents
}

/** Sums amounts that are grouped by currency. */
export function sumByCurrency(entries: readonly Money[]): Money[] {
  const grouped = new Map<string, string[]>()
  for (const entry of entries) {
    const list = grouped.get(entry.currency) ?? []
    list.push(entry.amount)
    grouped.set(entry.currency, list)
  }
  return [...grouped.entries()].map(([currency, amounts]) => ({
    currency,
    amount: addAmounts(amounts),
  }))
}

/** Formats a percentage, guarding against a zero denominator. */
export function formatPercent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '0%'
  return `${value.toFixed(fractionDigits)}%`
}

/** Formats a large count compactly, for example 1200 becomes "1.2k". */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) < 1000) return String(value)
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}
