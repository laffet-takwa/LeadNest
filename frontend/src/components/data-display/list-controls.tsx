/**
 * Pagination, SearchInput and FilterBar.
 */

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ALL_OPTIONS, PAGE_SIZE_OPTIONS } from '@/lib/constants/domain'
import { cn, pageCount, pageNumber } from '@/lib/utils'

export function Pagination({
  total,
  limit,
  offset,
  onOffsetChange,
  className,
}: {
  total: number
  limit: number
  offset: number
  onOffsetChange: (offset: number) => void
  className?: string
}) {
  const page = pageNumber(offset, limit)
  const pages = pageCount(total, limit)
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)

  return (
    <div className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="text-xs text-ink-secondary" aria-live="polite">
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          disabled={offset <= 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
        <span className="tabular px-1 text-xs text-ink-secondary">
          Page {page} of {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onOffsetChange(offset + limit)}
          disabled={offset + limit >= total}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

/**
 * A debounced search field.
 *
 * The value is reported immediately so the UI stays responsive, while the
 * debounced value drives the server request.
 */
export function SearchInput({
  value,
  onValueChange,
  onDebouncedChange,
  placeholder = 'Search…',
  delayMs = 300,
  className,
  label = 'Search',
}: {
  value: string
  onValueChange: (value: string) => void
  onDebouncedChange: (value: string) => void
  placeholder?: string
  delayMs?: number
  className?: string
  label?: string
}) {
  const [internal, setInternal] = useState(value)
  const debounced = useDebouncedValue(internal, delayMs)

  // Keep the field in step when the value is reset from outside, such as by
  // the "Clear filters" action.
  useEffect(() => {
    setInternal(value)
  }, [value])

  useEffect(() => {
    if (debounced !== value) onDebouncedChange(debounced)
  }, [debounced, onDebouncedChange, value])

  return (
    <div className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={internal}
        onChange={(event) => {
          setInternal(event.target.value)
          onValueChange(event.target.value)
        }}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9 pr-9"
      />
      {internal ? (
        <button
          type="button"
          onClick={() => {
            setInternal('')
            onValueChange('')
            onDebouncedChange('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          aria-label="Clear search"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/** A select that reports the chosen value, including the empty option. */
export function FilterSelect({
  value,
  onValueChange,
  options,
  placeholder,
  label,
  className,
  allowEmpty = true,
  emptyLabel = 'All',
}: {
  value: string
  onValueChange: (value: string) => void
  options: readonly { value: string; label: string }[]
  placeholder?: string
  label: string
  className?: string
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange}>
      <SelectTrigger className={cn('w-full sm:w-44', className)} aria-label={label}>
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty ? <SelectItem value={ALL_OPTIONS}>{emptyLabel}</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The toolbar above a list: search on the left, filters and actions on the right. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A date-range filter.
 *
 * Two native date controls are used rather than a calendar popover: a filter
 * needs both bounds visible at once, and the native control exposes the
 * keyboard and locale behaviour of the platform.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  label = 'Date range',
  className,
}: {
  /** Lower bound as `YYYY-MM-DD`. */
  from: string
  /** Upper bound as `YYYY-MM-DD`. */
  to: string
  onChange: (next: { from: string; to: string }) => void
  label?: string
  className?: string
}) {
  return (
    <fieldset className={cn('flex items-end gap-2', className)}>
      <legend className="sr-only">{label}</legend>
      <div>
        <label
          htmlFor="date-range-from"
          className="mb-1 block text-2xs font-medium uppercase tracking-wide text-ink-muted"
        >
          From
        </label>
        <input
          id="date-range-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className="h-9 rounded-control border border-input bg-surface px-2 text-xs text-ink shadow-xs transition-colors hover:border-ink-muted/40 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25"
        />
      </div>
      <div>
        <label
          htmlFor="date-range-to"
          className="mb-1 block text-2xs font-medium uppercase tracking-wide text-ink-muted"
        >
          To
        </label>
        <input
          id="date-range-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className="h-9 rounded-control border border-input bg-surface px-2 text-xs text-ink shadow-xs transition-colors hover:border-ink-muted/40 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25"
        />
      </div>
    </fieldset>
  )
}

/** A page-size selector. */
export function PageSizeSelect({
  value,
  onValueChange,
  className,
}: {
  value: number
  onValueChange: (value: number) => void
  className?: string
}) {
  return (
    <Select value={String(value)} onValueChange={(next) => onValueChange(Number(next))}>
      <SelectTrigger className={cn('w-28', className)} aria-label="Rows per page">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {size} rows
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
