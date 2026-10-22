/**
 * Breadcrumbs.
 *
 * A navigation trail. The final entry is the current page and is marked with
 * `aria-current="page"`; the earlier entries are links.
 */

import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  /** Omit on the current page. */
  to?: string
}

export function Breadcrumbs({
  items,
  className,
  label = 'Breadcrumb',
}: {
  items: readonly BreadcrumbItem[]
  className?: string
  label?: string
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3 shrink-0 text-ink-muted/60" aria-hidden="true" />
              ) : null}
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="truncate rounded transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={cn('truncate', isLast && 'font-medium text-ink-secondary')}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
