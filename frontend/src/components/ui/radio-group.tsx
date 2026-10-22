/**
 * RadioGroup.
 *
 * A set of mutually exclusive options. The group owns the roving focus and
 * the arrow-key navigation; the individual options are plain buttons styled
 * as radio buttons so a card-style layout stays possible.
 */

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { Circle } from 'lucide-react'
import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

export const RadioGroup = RadioGroupPrimitive.Root

export interface RadioGroupItemProps extends React.ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive.Item
> {
  /** The text label. */
  label: string
  /** Optional supporting text under the label. */
  description?: string
  /** Render the option as a card rather than a plain radio. */
  card?: boolean
}

export const RadioGroupItem = forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>(function RadioGroupItem(
  { className, label, description, card = false, children, ...props },
  ref,
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'group flex items-start gap-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        card
          ? 'rounded-card border border-border bg-surface p-3.5 hover:border-ink-muted/40 data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-soft/60 data-[state=checked]:ring-1 data-[state=checked]:ring-brand-600/30'
          : 'items-center',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          card
            ? 'border-ink-muted/50 group-data-[state=checked]:border-brand-600'
            : 'border-ink-muted/50',
          'group-data-[state=checked]:border-brand-600',
        )}
        aria-hidden="true"
      >
        <Circle className="size-2 fill-brand-600 text-brand-600 group-data-[state=unchecked]:hidden" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-secondary">
            {description}
          </span>
        ) : null}
        {children}
      </span>
    </RadioGroupPrimitive.Item>
  )
})
