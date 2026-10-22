/**
 * Avatar, Progress and Separator.
 */

import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { forwardRef } from 'react'

import { cn, colorIndex, initials } from '@/lib/utils'

const AVATAR_TONES = [
  'bg-brand-soft-hover text-brand-soft-text',
  'bg-accent-teal-soft text-accent-teal-strong',
  'bg-accent-violet-soft text-accent-violet-strong',
  'bg-warning-soft text-warning',
  'bg-info-soft text-info',
  'bg-danger-soft text-danger',
] as const

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  /** The full name used to derive the initials. */
  name: string
  /** Overrides the initials. */
  fallback?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const SIZES = {
  xs: 'size-6 text-2xs',
  sm: 'size-8 text-xs',
  md: 'size-9 text-sm',
  lg: 'size-12 text-base',
} as const

export const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(function Avatar({ className, name, fallback, size = 'md', ...props }, ref) {
  const label = fallback ?? initials(name)

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold',
        SIZES[size],
        AVATAR_TONES[colorIndex(name || fallback || '?')],
        className,
      )}
      {...props}
    >
      <AvatarPrimitive.Fallback delayMs={0}>{label}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
})

export const Separator = forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(function Separator({ className, orientation = 'horizontal', decorative = true, ...props }, ref) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
})

/** A simple determinate progress bar. */
export function Progress({
  value,
  max = 100,
  className,
  tone = 'brand',
  label,
}: {
  value: number
  max?: number
  className?: string
  tone?: 'brand' | 'success' | 'warning' | 'danger'
  label?: string
}) {
  const percentage = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100))
  const tones = {
    brand: 'bg-brand-600',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  } as const

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out-expo',
          tones[tone],
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
