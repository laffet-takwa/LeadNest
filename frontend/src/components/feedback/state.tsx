/**
 * Feedback components: EmptyState, ErrorState and the state wrapper that
 * decides which of the three states a panel shows.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted/50 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-control bg-surface text-ink-muted shadow-xs">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-secondary">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-danger-border bg-danger-soft/50 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-control bg-surface text-danger shadow-xs">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="text-sm text-ink-secondary">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          icon={<RefreshCw className="size-3.5" />}
        >
          Try again
        </Button>
      ) : null}
    </div>
  )
}
