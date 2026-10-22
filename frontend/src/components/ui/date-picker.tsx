/**
 * DatePicker.
 *
 * A calendar for date-only values.
 *
 * The value is always a `YYYY-MM-DD` string, matching what the API expects
 * for a business date. The calendar works in local time and never converts
 * the value through UTC, so a date never shifts a day because of the time
 * zone of the machine.
 */

import * as PopoverPrimitive from '@radix-ui/react-popover'
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import { formatDateOnly, parseDateOnly } from '@/lib/utils/date'

/** The first day of the week. Monday keeps business days together. */
const WEEK_STARTS_ON = 1 as const

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

export interface DatePickerProps {
  /** The selected date as `YYYY-MM-DD`, or an empty string. */
  value: string
  onValueChange: (value: string) => void
  /** Visible label, also used as the accessible name. */
  label: string
  /** Text shown when no date is selected. */
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Id of the field, so a <label> can point at it. */
  id?: string
  /** Marks the field as invalid. */
  invalid?: boolean
  /** Described-by target, usually the field error. */
  describedBy?: string
  /** Earliest selectable date, as `YYYY-MM-DD`. */
  min?: string
  /** Latest selectable date, as `YYYY-MM-DD`. */
  max?: string
  /** Allows clearing the selection. */
  allowEmpty?: boolean
}

/**
 * Parses a `YYYY-MM-DD` string into a local date at midnight.
 *
 * The parts are read directly instead of going through `new Date(string)`,
 * because the string form is parsed as UTC and would shift the day in
 * negative offsets.
 */
export function DatePicker({
  value,
  onValueChange,
  label,
  placeholder = 'Select a date',
  className,
  disabled = false,
  id,
  invalid = false,
  describedBy,
  min,
  max,
  allowEmpty = true,
}: DatePickerProps) {
  const generatedId = useId()
  const gridId = `${generatedId}-grid`
  const selected = useMemo(() => parseDateOnly(value), [value])
  const minDate = useMemo(() => parseDateOnly(min), [min])
  const maxDate = useMemo(() => parseDateOnly(max), [max])

  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(selected ?? new Date()))
  const [focusedDate, setFocusedDate] = useState<Date>(() => selected ?? new Date())

  useEffect(() => {
    if (selected) {
      setViewMonth(startOfMonth(selected))
      setFocusedDate(selected)
    }
  }, [selected])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: WEEK_STARTS_ON })
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: WEEK_STARTS_ON })
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  const isDisabled = (date: Date): boolean => {
    if (minDate && date.getTime() < startOfDay(minDate).getTime()) return true
    if (maxDate && date.getTime() > startOfDay(maxDate).getTime()) return true
    return false
  }

  const commit = (date: Date) => {
    onValueChange(formatDateOnly(date))
    setOpen(false)
  }

  const moveFocus = (next: Date) => {
    setFocusedDate(next)
    if (!isSameMonth(next, viewMonth)) setViewMonth(startOfMonth(next))
  }

  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next: Date | null = null
    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(focusedDate, -1)
        break
      case 'ArrowRight':
        next = addDays(focusedDate, 1)
        break
      case 'ArrowUp':
        next = addDays(focusedDate, -7)
        break
      case 'ArrowDown':
        next = addDays(focusedDate, 7)
        break
      case 'Home':
        next = startOfWeek(focusedDate, { weekStartsOn: WEEK_STARTS_ON })
        break
      case 'End':
        next = endOfWeek(focusedDate, { weekStartsOn: WEEK_STARTS_ON })
        break
      case 'PageUp':
        next = addMonths(focusedDate, -1)
        break
      case 'PageDown':
        next = addMonths(focusedDate, 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        if (!isDisabled(focusedDate)) commit(focusedDate)
        return
      default:
        return
    }
    event.preventDefault()
    if (next) moveFocus(next)
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          const base = selected ?? new Date()
          setViewMonth(startOfMonth(base))
          setFocusedDate(base)
        }
      }}
    >
      <div className="relative">
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            aria-label={`${label}: ${selected ? format(selected, 'd MMM yyyy') : 'no date selected'}`}
            className={cn(
              'flex h-10 w-full items-center justify-between gap-2 rounded-input border border-input bg-surface px-3 text-left text-sm shadow-xs transition-[border-color,box-shadow] duration-150',
              'hover:border-ink-muted/40 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25',
              'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted',
              invalid && 'border-danger focus-visible:ring-danger/25',
              !selected && 'text-ink-muted',
              allowEmpty && selected && 'pr-9',
              className,
            )}
          >
            <span className="truncate">
              {selected ? format(selected, 'd MMM yyyy') : placeholder}
            </span>
            <ChevronRight className="size-4 shrink-0 rotate-90 text-ink-muted" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>

        {allowEmpty && selected ? (
          <button
            type="button"
            onClick={() => onValueChange('')}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-[19rem] rounded-card border border-border bg-surface p-3 shadow-popover data-[state=open]:animate-scale-in"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const next = addMonths(viewMonth, -1)
                setViewMonth(next)
                setFocusedDate(next)
              }}
              aria-label="Previous month"
              className="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <p className="text-sm font-semibold text-ink" aria-live="polite">
              {format(viewMonth, 'MMMM yyyy')}
            </p>
            <button
              type="button"
              onClick={() => {
                const next = addMonths(viewMonth, 1)
                setViewMonth(next)
                setFocusedDate(next)
              }}
              aria-label="Next month"
              className="rounded-control p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div
            id={gridId}
            role="grid"
            aria-label={label}
            onKeyDown={onGridKeyDown}
            className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <div role="row" className="mb-1 grid grid-cols-7">
              {WEEKDAY_LABELS.map((day) => (
                <div
                  key={day}
                  role="columnheader"
                  aria-label={day}
                  className="text-center text-2xs font-semibold uppercase tracking-wide text-ink-muted"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const inMonth = isSameMonth(day, viewMonth)
                const isSelected = selected ? isSameDay(day, selected) : false
                const isFocused = isSameDay(day, focusedDate)
                const disabled = isDisabled(day)
                return (
                  <div key={day.toISOString()} role="gridcell" aria-selected={isSelected}>
                    <button
                      type="button"
                      tabIndex={isFocused ? 0 : -1}
                      disabled={disabled}
                      onClick={() => commit(day)}
                      onFocus={() => setFocusedDate(day)}
                      aria-label={format(day, 'd MMMM yyyy')}
                      aria-current={isToday(day) ? 'date' : undefined}
                      className={cn(
                        'flex size-9 items-center justify-center rounded-control text-sm transition-colors duration-100',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
                        !inMonth && 'text-ink-muted/60',
                        inMonth && !isSelected && 'text-ink hover:bg-surface-sunken',
                        isSelected && 'bg-brand-600 font-medium text-white',
                        !isSelected && isToday(day) && 'font-semibold text-brand-text',
                        disabled && 'cursor-not-allowed text-ink-muted/40 hover:bg-transparent',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                const today = new Date()
                moveFocus(today)
                commit(today)
              }}
              className="rounded-control px-2 py-1 text-xs font-medium text-brand-text transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const next = addYears(viewMonth, 1)
                setViewMonth(next)
                setFocusedDate(next)
              }}
              className="rounded-control px-2 py-1 text-xs font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
            >
              Next year
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
