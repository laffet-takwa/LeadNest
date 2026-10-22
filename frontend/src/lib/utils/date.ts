/**
 * Date and time helpers.
 *
 * The backend sends RFC 3339 timestamps and plain `YYYY-MM-DD` dates. The
 * helpers keep the two apart: a date-only value is never converted into a
 * timestamp, because that would shift a business date across time zones.
 */

import {
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from 'date-fns'

/** Parses an RFC 3339 timestamp. Returns null for an empty or invalid value. */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Formats a timestamp as a readable local date, for example "12 Mar 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return '—'
  return format(date, 'd MMM yyyy')
}

/** Formats a timestamp as a readable local date and time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return '—'
  return format(date, 'd MMM yyyy, HH:mm')
}

/**
 * Formats a timestamp as a relative phrase, for example "3 hours ago".
 *
 * Falls back to an absolute date beyond a week so the text stays useful.
 */
export function formatRelative(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return '—'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60_000)

  if (Math.abs(minutes) < 1) return 'just now'
  if (minutes > 0 && minutes < 60) return `${minutes} min ago`
  if (minutes < 0 && minutes > -60) return `in ${Math.abs(minutes)} min`

  const hours = Math.round(minutes / 60)
  if (hours > 0 && hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (hours < 0 && hours > -24)
    return `in ${Math.abs(hours)} hour${Math.abs(hours) === 1 ? '' : 's'}`

  const days = differenceInCalendarDays(new Date(), date)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days === -1) return 'tomorrow'
  if (days > 1 && days < 7) return `${days} days ago`
  if (days < -1 && days > -7) return `in ${Math.abs(days)} days`

  return format(date, 'd MMM yyyy')
}

/** Returns true when the date is in the past. */
export function isPast(value: string | Date | null | undefined): boolean {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return false
  return date.getTime() < Date.now()
}

/** Describes a due date in words, used by the task list. */
export function describeDueDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return 'No due date'
  if (isToday(date)) return 'Due today'
  if (isTomorrow(date)) return 'Due tomorrow'
  if (isYesterday(date)) return 'Due yesterday'
  const days = differenceInCalendarDays(date, new Date())
  if (days > 0 && days < 7) return `Due in ${days} day${days === 1 ? '' : 's'}`
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  return `Due ${format(date, 'd MMM')}`
}

/**
 * Converts a timestamp into the `YYYY-MM-DD` value the API expects for
 * date-only fields.
 */
export function toDateOnly(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

/**
 * Parses a `YYYY-MM-DD` string into a local date at midnight.
 *
 * The parts are read directly instead of going through `new Date(string)`,
 * because the string form is parsed as UTC and would shift the day in
 * negative offsets.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

/** Formats a local date as `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Formats a date for a `<input type="datetime-local">` control. */
export function toInputDateTime(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseTimestamp(value)
  if (!date) return ''
  return format(date, "yyyy-MM-dd'T'HH:mm")
}
