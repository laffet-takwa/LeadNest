/**
 * Combobox.
 *
 * A searchable picker. It follows the ARIA 1.2 combobox pattern: the search
 * field owns the focus and the listbox is referenced through `aria-controls`
 * and `aria-activedescendant`, so the arrow keys move the active option
 * without moving the focus off the field.
 *
 * The closed state is a button that reports the current selection; opening
 * the list moves the focus into the search field.
 */

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Supporting text under the label. */
  description?: string
  /** Rendered before the label, such as an avatar. */
  icon?: ReactNode
}

export interface ComboboxProps {
  /** The selected value, or an empty string when nothing is selected. */
  value: string
  onValueChange: (value: string) => void
  options: readonly ComboboxOption[]
  /** Visible label of the field, also used as the accessible name. */
  label: string
  /** Text shown in the field when nothing is selected. */
  placeholder?: string
  /** Text shown in the search box inside the list. */
  searchPlaceholder?: string
  className?: string
  /** Allows clearing the selection. */
  allowEmpty?: boolean
  /** Label of the "no selection" entry. */
  emptyLabel?: string
  /** Message shown when the search matches nothing. */
  noResultsLabel?: string
  disabled?: boolean
  /** Id of the field, so a <label> can point at it. */
  id?: string
  /** Marks the field as invalid. */
  invalid?: boolean
  /** Described-by target, usually the field error. */
  describedBy?: string
}

function matches(option: ComboboxOption, query: string): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.description?.toLowerCase().includes(needle) ?? false)
  )
}

export function Combobox({
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className,
  allowEmpty = false,
  emptyLabel = 'None',
  noResultsLabel = 'No matches',
  disabled = false,
  id,
  invalid = false,
  describedBy,
}: ComboboxProps) {
  const generatedId = useId()
  const listboxId = `${generatedId}-listbox`
  const optionId = (index: number) => `${generatedId}-option-${index}`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  const visible = useMemo(
    () => options.filter((option) => matches(option, query)),
    [options, query],
  )

  // Keep the active option inside the filtered list.
  useEffect(() => {
    setActiveIndex((current) => (current < visible.length ? current : 0))
  }, [visible.length])

  // Scroll the active option into view when it changes.
  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const commit = (option: ComboboxOption) => {
    onValueChange(option.value)
    setQuery('')
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => {
        const next = current + delta
        if (next < 0) return Math.max(visible.length - 1, 0)
        if (next >= visible.length) return 0
        return next
      })
      return
    }
    if (event.key === 'Enter') {
      const option = visible[activeIndex]
      if (option) {
        event.preventDefault()
        commit(option)
      }
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-label={label}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-input border border-input bg-surface px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] duration-150',
            'hover:border-ink-muted/40 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
            invalid && 'border-danger focus-visible:ring-danger/25',
            !selected && 'text-ink-muted',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[14rem] rounded-card border border-border bg-surface p-1 shadow-popover data-[state=open]:animate-scale-in"
          onOpenAutoFocus={(event) => {
            // The search field takes the focus, so the list is operable from
            // the keyboard straight away.
            event.preventDefault()
            searchRef.current?.focus()
          }}
        >
          <div className="relative mb-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={visible.length > 0 ? optionId(activeIndex) : undefined}
              aria-label={`${label}: search options`}
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-control border border-input bg-surface-sunken pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/25"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setActiveIndex(0)
                  searchRef.current?.focus()
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                aria-label="Clear search"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="max-h-60 overflow-y-auto scrollbar-thin"
          >
            {allowEmpty ? (
              <li
                id={optionId(0)}
                role="option"
                aria-selected={value === ''}
                data-active={activeIndex === 0 ? 'true' : undefined}
                onMouseEnter={() => setActiveIndex(0)}
                onClick={() => {
                  onValueChange('')
                  setOpen(false)
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-control px-2 py-1.5 text-sm text-ink-secondary',
                  activeIndex === 0 && 'bg-surface-sunken',
                )}
              >
                {emptyLabel}
                {value === '' ? (
                  <Check className="size-3.5 text-success" aria-hidden="true" />
                ) : null}
              </li>
            ) : null}

            {visible.map((option, index) => {
              const position = index + (allowEmpty ? 1 : 0)
              const active = activeIndex === position
              return (
                <li
                  key={option.value}
                  id={optionId(position)}
                  role="option"
                  aria-selected={value === option.value}
                  data-active={active ? 'true' : undefined}
                  onMouseEnter={() => setActiveIndex(position)}
                  onClick={() => commit(option)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 text-sm text-ink',
                    active && 'bg-brand-soft text-brand-soft-text',
                  )}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-2xs opacity-70">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {value === option.value ? (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : null}
                </li>
              )
            })}

            {visible.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-ink-muted">{noResultsLabel}</li>
            ) : null}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
