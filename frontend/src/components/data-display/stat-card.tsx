/**
 * StatCard — a compact metric tile for the dashboard.
 */

import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { Tooltip } from '@/components/ui/overlays'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Optional explanatory text shown under the value. */
  hint?: ReactNode
  icon: LucideIcon
  /** Tints the icon tile. */
  tone?: 'brand' | 'teal' | 'violet' | 'success' | 'warning' | 'danger' | 'neutral'
  /** Percentage change against a previous period. Only shown when real. */
  change?: { value: number; direction: 'up' | 'down' }
  /** Explains the metric when the label alone is ambiguous. */
  tooltip?: string
  className?: string
}

const TONES = {
  brand: 'bg-brand-soft text-brand-soft-text',
  teal: 'bg-accent-teal-soft text-accent-teal-strong',
  violet: 'bg-accent-violet-soft text-accent-violet-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-sunken text-ink-secondary',
} as const

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  change,
  tooltip,
  className,
}: StatCardProps) {
  const labelNode = (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
      {label}
    </span>
  )

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between gap-3 rounded-card border border-border bg-surface p-4 shadow-xs transition-shadow duration-150 hover:shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {tooltip ? <Tooltip label={tooltip}>{labelNode}</Tooltip> : labelNode}
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-control',
            TONES[tone],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="tabular text-2xl font-semibold leading-tight text-ink">{value}</p>
        <div className="mt-1 flex items-center gap-2">
          {change ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium',
                change.direction === 'up' ? 'text-success' : 'text-danger',
              )}
            >
              {change.direction === 'up' ? (
                <TrendingUp className="size-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden="true" />
              )}
              {Math.abs(change.value).toFixed(1)}%
            </span>
          ) : null}
          {hint ? <span className="truncate text-xs text-ink-muted">{hint}</span> : null}
        </div>
      </div>
    </div>
  )
}
