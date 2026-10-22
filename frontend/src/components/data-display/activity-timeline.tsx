/**
 * ActivityTimeline.
 *
 * One chronological list of customer interactions, shared by the dashboard
 * feed, the customer detail page and the activity page.
 *
 * The three callers receive slightly different activity shapes from the API,
 * so the timeline works from a normalised entry instead of a raw model.
 */

import { Mail, MessageSquare, Phone, StickyNote, Users, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { formatDateTime, formatRelative } from '@/lib/utils/date'
import type { ActivityType } from '@/types/api'

export interface TimelineEntry {
  id: string
  type: ActivityType
  subject?: string
  description?: string
  occurred_at: string
  customer_id?: string
  customer_name?: string
  user_id?: string
  user_name?: string
}

const TYPE_ICONS: Record<ActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: StickyNote,
  message: MessageSquare,
  other: StickyNote,
}

const TYPE_LABELS: Record<ActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  message: 'Message',
  other: 'Other',
}

export function ActivityTimeline({
  entries,
  /** Shows the customer name next to each entry. */
  showCustomer = false,
  /** Makes the customer name a link to the customer page. */
  linkCustomer = false,
  className,
}: {
  entries: readonly TimelineEntry[]
  showCustomer?: boolean
  linkCustomer?: boolean
  className?: string
}) {
  if (entries.length === 0) return null

  return (
    <ol className={cn('relative space-y-0', className)}>
      {entries.map((entry, index) => {
        const Icon = TYPE_ICONS[entry.type] ?? StickyNote
        const label = TYPE_LABELS[entry.type] ?? 'Activity'
        const isLast = index === entries.length - 1

        return (
          <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[0.9375rem] top-8 h-[calc(100%-1.5rem)] w-px bg-border"
              />
            ) : null}

            <span
              aria-hidden="true"
              className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary"
            >
              <Icon className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  {label}
                </span>
                <time
                  dateTime={entry.occurred_at}
                  title={formatDateTime(entry.occurred_at)}
                  className="text-2xs text-ink-muted"
                >
                  {formatRelative(entry.occurred_at)}
                </time>
              </div>

              {entry.subject ? (
                <p className="mt-0.5 truncate text-sm font-medium text-ink">{entry.subject}</p>
              ) : null}

              {entry.description ? (
                <p className="mt-0.5 line-clamp-3 text-sm leading-relaxed text-ink-secondary">
                  {entry.description}
                </p>
              ) : null}

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-ink-muted">
                {showCustomer && entry.customer_name ? (
                  linkCustomer && entry.customer_id ? (
                    <Link
                      to={`/customers/${entry.customer_id}`}
                      className="truncate rounded transition-colors hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                    >
                      {entry.customer_name}
                    </Link>
                  ) : (
                    <span className="truncate">{entry.customer_name}</span>
                  )
                ) : null}
                {entry.user_name ? <span className="truncate">by {entry.user_name}</span> : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
