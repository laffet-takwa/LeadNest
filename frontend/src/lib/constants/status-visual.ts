/**
 * The visual mapping for the domain enumerations.
 *
 * One entry per status keeps the badges, the pipeline chart and the pipeline
 * board in agreement: a status is described in a single place, so a colour
 * never drifts between two views.
 *
 * The badge always carries the status label, so colour is never the only
 * signal.
 */

import type { ActivityType, DealStatus, TaskPriority, TaskStatus } from '@/types/api'

/** The tones a badge can take. */
export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'violet'
  | 'teal'
  | 'outline'

export interface StatusVisual {
  /** The badge tone. */
  tone: BadgeTone
  /** The Tailwind fill utility used by the pipeline chart. */
  fill: string
}

/**
 * The deal statuses.
 *
 * The open stages run from the lightest to the darkest blue, so the pipeline
 * chart reads as a progression, and the two closed stages use the semantic
 * success and danger colours.
 */
export const DEAL_STATUS_VISUAL: Record<DealStatus, StatusVisual> = {
  new: { tone: 'info', fill: 'fill-brand-300' },
  contacted: { tone: 'brand', fill: 'fill-brand-400' },
  qualified: { tone: 'teal', fill: 'fill-brand-500' },
  proposal: { tone: 'violet', fill: 'fill-brand-600' },
  negotiation: { tone: 'warning', fill: 'fill-brand-700' },
  won: { tone: 'success', fill: 'fill-success' },
  lost: { tone: 'danger', fill: 'fill-danger' },
}

/** The task statuses. */
export const TASK_STATUS_VISUAL: Record<TaskStatus, StatusVisual> = {
  pending: { tone: 'info', fill: 'fill-info' },
  completed: { tone: 'success', fill: 'fill-success' },
  cancelled: { tone: 'neutral', fill: 'fill-border' },
}

/** The task priorities. */
export const PRIORITY_VISUAL: Record<TaskPriority, StatusVisual> = {
  low: { tone: 'neutral', fill: 'fill-border' },
  medium: { tone: 'info', fill: 'fill-info' },
  high: { tone: 'warning', fill: 'fill-warning' },
}

/** The activity types. */
export const ACTIVITY_TYPE_VISUAL: Record<ActivityType, StatusVisual> = {
  call: { tone: 'teal', fill: 'fill-accent-teal' },
  email: { tone: 'info', fill: 'fill-info' },
  meeting: { tone: 'violet', fill: 'fill-accent-violet' },
  note: { tone: 'neutral', fill: 'fill-border' },
  message: { tone: 'brand', fill: 'fill-brand-500' },
  other: { tone: 'neutral', fill: 'fill-border' },
}
