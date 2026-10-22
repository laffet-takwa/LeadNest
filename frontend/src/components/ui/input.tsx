/**
 * Form primitives: Input, Textarea, Label, Checkbox and Switch.
 *
 * Every control is styled from the same tokens and exposes the correct
 * ARIA attributes, so a form assembled from these parts is accessible by
 * default.
 */

import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as LabelPrimitive from '@radix-ui/react-label'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check, Minus } from 'lucide-react'
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

const controlClasses =
  'w-full rounded-input border border-input bg-surface text-sm text-ink shadow-xs transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted hover:border-ink-muted/40 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field, before the text. */
  leadingIcon?: ReactNode
  /** Rendered inside the field, after the text. */
  trailingSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailingSlot, type = 'text', ...props },
  ref,
) {
  if (!leadingIcon && !trailingSlot) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(controlClasses, 'h-10 px-3', className)}
        {...props}
      />
    )
  }
  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted [&_svg]:size-4">
          {leadingIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        className={cn(
          controlClasses,
          'h-10',
          leadingIcon ? 'pl-9' : 'pl-3',
          trailingSlot ? 'pr-9' : 'pr-3',
          className,
        )}
        {...props}
      />
      {trailingSlot ? (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailingSlot}</span>
      ) : null}
    </div>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Shows the remaining character budget under the field. */
  maxLengthHint?: { value: number; max: number }
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, maxLengthHint, ...props },
  ref,
) {
  return (
    <div>
      <textarea
        ref={ref}
        rows={rows}
        className={cn(controlClasses, 'min-h-[92px] resize-y px-3 py-2 leading-relaxed', className)}
        {...props}
      />
      {maxLengthHint ? (
        <p className="mt-1 text-right text-2xs text-ink-muted">
          {maxLengthHint.value} / {maxLengthHint.max}
        </p>
      ) : null}
    </div>
  )
})

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-sm font-medium text-ink peer-disabled:opacity-60', className)}
      {...props}
    />
  )
})

export const Checkbox = forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        'peer size-[1.125rem] shrink-0 rounded-[5px] border border-input bg-surface shadow-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 data-[state=checked]:text-white data-[state=indeterminate]:border-brand-600 data-[state=indeterminate]:bg-brand-600 data-[state=indeterminate]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3" aria-hidden="true" />
        ) : (
          <Check className="size-3" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
})

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'peer inline-flex h-[1.375rem] w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:bg-brand-600 data-[state=unchecked]:bg-border',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-surface shadow-sm transition-transform duration-150 data-[state=checked]:translate-x-[1.125rem] data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  )
})
