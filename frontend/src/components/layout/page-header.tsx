/**
 * Page header, shared by every list and detail page.
 *
 * It answers the three questions a page must answer: where am I, what
 * matters here, and what can I do next.
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: string
  description?: string
  /** The primary action for this page. */
  actions?: ReactNode
  /** Secondary information shown under the title, such as a record count. */
  meta?: ReactNode
  className?: string
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-secondary">{description}</p>
        ) : null}
        {meta ? <div className="mt-2 text-xs text-ink-muted">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </motion.header>
  )
}

/** A heading above a section of a page. */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-ink-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
