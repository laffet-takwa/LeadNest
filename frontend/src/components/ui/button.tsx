/**
 * Button.
 *
 * A single component covers the button, icon button and link-button cases so
 * that spacing, focus rings and loading states stay consistent everywhere.
 */

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-in-out-soft disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white shadow-xs hover:bg-brand-700 focus-visible:ring-brand-600',
        secondary:
          'border border-border bg-surface text-ink shadow-xs hover:bg-surface-sunken hover:border-ink-muted/30',
        ghost: 'text-ink-secondary hover:bg-surface-sunken hover:text-ink',
        subtle: 'bg-brand-soft text-brand-soft-text hover:bg-brand-soft-hover',
        danger: 'bg-danger text-white shadow-xs hover:bg-danger/90',
        'danger-ghost': 'text-danger hover:bg-danger-soft',
        link: 'text-brand-text underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs [&_svg]:size-3.5',
        md: 'h-10 px-4 [&_svg]:size-4',
        lg: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button>, keeping the styles. */
  asChild?: boolean
  /** Show a spinner and block interaction. */
  loading?: boolean
  /** Content rendered before the label. */
  icon?: ReactNode
  /** Content rendered after the label. */
  trailingIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    icon,
    trailingIcon,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : icon}
      {children}
      {!loading && trailingIcon}
    </Comp>
  )
})

export { buttonVariants }
