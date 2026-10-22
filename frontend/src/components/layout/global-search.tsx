/**
 * GlobalSearch.
 *
 * Type-ahead customer search. It is used in the top bar on wide screens and
 * inside the navigation drawer on narrow ones, so the feature is reachable at
 * every viewport.
 */

import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CustomerAvatar } from '@/components/data-display/customer-avatar'
import { Input } from '@/components/ui/input'
import { useCustomerSearch } from '@/features/customers/hooks/use-customers'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

export function GlobalSearch({
  className,
  onNavigate,
  autoFocus = false,
}: {
  className?: string
  /** Called after a result is chosen, so the drawer can close itself. */
  onNavigate?: () => void
  autoFocus?: boolean
}) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debouncedTerm = useDebouncedValue(term, 250)

  const { data, isFetching, error } = useCustomerSearch(debouncedTerm)

  const results = data?.data ?? []
  const hasQuery = debouncedTerm.trim().length >= 2

  // Reveal the results as soon as a search resolves.
  useEffect(() => {
    if (hasQuery && (results.length > 0 || error)) setOpen(true)
  }, [hasQuery, results.length, error])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={term}
        autoFocus={autoFocus}
        onChange={(event) => {
          setTerm(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
        placeholder="Search customers…"
        aria-label="Search customers"
        aria-expanded={open}
        aria-controls={open ? 'global-search-results' : undefined}
        role="combobox"
        aria-autocomplete="list"
        className="h-9 border-transparent bg-surface-sunken pl-9 text-sm focus-visible:border-brand-600"
      />

      {open && hasQuery ? (
        <div
          id="global-search-results"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-popover"
        >
          {error ? (
            <p className="px-3 py-3 text-xs text-ink-secondary">
              Search is unavailable right now. Try again in a moment.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-ink-secondary">
              {isFetching ? 'Searching…' : 'No customers match that search.'}
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto scrollbar-thin p-1">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setTerm('')
                      onNavigate?.()
                      void navigate(`/customers/${customer.id}`)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                  >
                    <CustomerAvatar name={customer.full_name} size="xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{customer.full_name}</span>
                      {customer.company ? (
                        <span className="block truncate text-2xs text-ink-muted">
                          {customer.company}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
