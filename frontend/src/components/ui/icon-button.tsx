/**
 * IconButton.
 *
 * A square button that holds a single icon. The accessible name is required
 * rather than optional, because an icon on its own never carries a label a
 * screen reader can announce.
 */

import { forwardRef } from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'trailingIcon'> {
  /** The icon to render. */
  icon: React.ReactNode
  /** Required: the accessible name of the button. */
  label: string
  /** Use the smaller square. */
  size?: 'sm' | 'md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size={size === 'sm' ? 'icon-sm' : 'icon'}
      aria-label={label}
      title={label}
      className={cn('shrink-0', className)}
      {...props}
    >
      {icon}
    </Button>
  )
})
