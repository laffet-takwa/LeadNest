/**
 * Loading skeletons.
 *
 * The skeletons approximate the shape of the content they stand in for, so
 * the layout does not jump when the data arrives. They are decorative: the
 * surrounding region carries the `aria-busy` state and the status message.
 */

import { Skeleton } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function LoadingSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn('h-4', className)} {...props} />
}

/** A stack of text lines, used inside a card or a panel. */
export function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** The rows of a table, sized to the number of columns. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'divide-y divide-border rounded-card border border-border bg-surface',
        className,
      )}
      aria-hidden="true"
    >
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5', columnIndex === 0 ? 'w-1/4' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A single statistic card. */
export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface p-4 shadow-xs', className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-8 rounded-control" />
      </div>
      <Skeleton className="mt-3 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  )
}

/** A row of statistic cards. */
export function StatGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <StatSkeleton key={index} />
      ))}
    </div>
  )
}

/** A panel with a heading and a few lines of content. */
export function PanelSkeleton({ className, lines = 4 }: { className?: string; lines?: number }) {
  return (
    <div
      className={cn('rounded-card border border-border bg-surface p-4 shadow-xs', className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-32" />
      <TextSkeleton lines={lines} className="mt-3" />
    </div>
  )
}
