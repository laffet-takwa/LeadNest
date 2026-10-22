/**
 * Form building blocks.
 *
 * `FormField` wires a label, a control, an error message and the ARIA
 * attributes that tie them together, so every form in the application reports
 * errors accessibly.
 */

import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </Label>
        {hint ? <span className="text-2xs text-ink-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p
          id={`${htmlFor}-error`}
          className="flex items-start gap-1.5 text-xs font-medium text-danger"
          role="alert"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** The attributes an input needs to report an error accessibly. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const
}
