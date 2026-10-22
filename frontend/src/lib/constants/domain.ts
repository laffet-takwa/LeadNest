/**
 * Domain constants shared across features.
 *
 * The values mirror the backend's own enumerations, so a status sent to the
 * API is always one the backend accepts.
 */

import type { ActivityType, DealStatus, TaskPriority, TaskStatus } from '@/types/api'

export interface StatusOption<T extends string> {
  value: T
  label: string
  /** Short description used in tooltips and empty states. */
  description?: string
}

/** The seven deal statuses, in pipeline order. */
export const DEAL_STATUSES: readonly StatusOption<DealStatus>[] = [
  { value: 'new', label: 'New', description: 'A newly identified opportunity' },
  { value: 'contacted', label: 'Contacted', description: 'First contact has been made' },
  { value: 'qualified', label: 'Qualified', description: 'Budget and need confirmed' },
  { value: 'proposal', label: 'Proposal', description: 'A proposal has been sent' },
  { value: 'negotiation', label: 'Negotiation', description: 'Terms are being discussed' },
  { value: 'won', label: 'Won', description: 'The deal is closed and won' },
  { value: 'lost', label: 'Closed lost', description: 'The deal is closed and lost' },
] as const

/** Statuses that are still in play. */
export const OPEN_DEAL_STATUSES: readonly DealStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
] as const

/** Statuses that close a deal. */
export const CLOSED_DEAL_STATUSES: readonly DealStatus[] = ['won', 'lost'] as const

export const TASK_STATUSES: readonly StatusOption<TaskStatus>[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export const TASK_PRIORITIES: readonly StatusOption<TaskPriority>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const

export const ACTIVITY_TYPES: readonly StatusOption<ActivityType>[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'message', label: 'Message' },
  { value: 'other', label: 'Other' },
] as const

/** Common customer sources offered in the customer form. */
export const CUSTOMER_SOURCES: readonly string[] = [
  'web',
  'referral',
  'phone',
  'email',
  'event',
  'social',
  'walk-in',
  'other',
] as const

/** Currencies the pipeline can hold. The backend accepts any ISO 4217 code. */
export const CURRENCIES: readonly { value: string; label: string }[] = [
  { value: 'TND', label: 'TND — Tunisian dinar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'GBP', label: 'GBP — Pound sterling' },
  { value: 'MAD', label: 'MAD — Moroccan dirham' },
  { value: 'DZD', label: 'DZD — Algerian dinar' },
] as const

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_SIZE = 20

/** Options offered by the page-size selector. */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

/**
 * Radix rejects an empty `Select.Item` value, so "no assignee" is expressed
 * with this sentinel and mapped back to an empty string before it is sent.
 */
export const NO_ASSIGNEE = '__none__'

/**
 * Radix also rejects an empty item value, so the "clear this filter" option
 * in a filter dropdown uses this sentinel.
 */
export const ALL_OPTIONS = '__all__'
