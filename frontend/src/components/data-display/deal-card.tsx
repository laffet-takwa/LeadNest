/**
 * DealCard.
 *
 * The card used on the pipeline board. It shows the essentials of a deal and
 * offers a keyboard-accessible status control, so the board never depends on
 * drag and drop.
 */

import { motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/overlays'
import { DEAL_STATUSES } from '@/lib/constants/domain'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date'
import { formatAmount } from '@/lib/utils/format'
import type { DealStatus, DealWithCustomer } from '@/types/api'

export interface DealCardProps {
  deal: DealWithCustomer
  /** Name of the assigned employee, when it is known. */
  assigneeName?: string
  onEdit: () => void
  onDelete: () => void
  onMove: (status: DealStatus) => void
  /** True while the status change is in flight. */
  isUpdating?: boolean
}

export function DealCard({
  deal,
  assigneeName,
  onEdit,
  onDelete,
  onMove,
  isUpdating = false,
}: DealCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group rounded-card border border-border bg-surface p-3 shadow-xs transition-shadow hover:shadow-sm',
        isUpdating && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/deals/${deal.id}`}
          className="min-w-0 flex-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
        >
          <p className="truncate text-sm font-medium text-ink">{deal.title}</p>
          {deal.customer_name ? (
            <p className="mt-0.5 truncate text-xs text-ink-secondary">{deal.customer_name}</p>
          ) : null}
          <p className="tabular mt-2 text-sm font-semibold text-ink">
            {formatAmount(deal.value)}{' '}
            <span className="text-xs font-normal text-ink-muted">{deal.currency}</span>
          </p>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-ink-muted opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${deal.title}`}
            >
              <MoreHorizontal className="size-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to={`/deals/${deal.id}`}>View details</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>Edit deal</DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onDelete}>
              Delete deal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {assigneeName ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar name={assigneeName} size="xs" />
            <span className="truncate text-2xs text-ink-secondary">{assigneeName}</span>
          </span>
        ) : (
          <span className="text-2xs text-ink-muted">Unassigned</span>
        )}
        {deal.expected_close ? (
          <span className="shrink-0 text-2xs text-ink-muted">
            closes {formatDate(deal.expected_close)}
          </span>
        ) : null}
      </div>

      {/* Keyboard-accessible status control. */}
      <label className="mt-2.5 block">
        <span className="sr-only">Move {deal.title} to another status</span>
        <select
          value={deal.status}
          onChange={(event) => onMove(event.target.value as DealStatus)}
          disabled={isUpdating}
          className="h-7 w-full rounded-control border border-border bg-surface px-2 text-2xs text-ink-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60"
        >
          {DEAL_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </label>
    </motion.article>
  )
}
