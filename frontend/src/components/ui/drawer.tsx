/**
 * Drawer.
 *
 * A panel that slides in from the edge of the viewport. It is built on Radix's
 * Dialog, so it traps focus, restores focus to the trigger on close, closes
 * on Escape and marks the rest of the page as `aria-hidden` while it is open.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const Drawer = DialogPrimitive.Root

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Which edge the drawer slides in from. */
  side?: 'left' | 'right'
  /** Accessible name for the drawer. */
  title: string
  /** Hides the close button when the drawer must be dismissed deliberately. */
  hideClose?: boolean
  /** Rendered under the title, such as a company switcher. */
  header?: ReactNode
  /** Extra classes for the close button, for use on a dark surface. */
  closeButtonClassName?: string
}

const SIDE_CLASSES = {
  left: {
    panel: 'inset-y-0 left-0 h-full w-[17rem] max-w-[85vw] rounded-r-panel',
    enter:
      'data-[state=open]:animate-slide-in-from-left data-[state=closed]:animate-slide-out-to-left',
  },
  right: {
    panel: 'inset-y-0 right-0 h-full w-[22rem] max-w-[90vw] rounded-l-panel',
    enter:
      'data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right',
  },
} as const

export const DrawerContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent(
  {
    className,
    children,
    side = 'left',
    title,
    hideClose = false,
    header,
    closeButtonClassName,
    ...props
  },
  ref,
) {
  const sideClasses = SIDE_CLASSES[side]
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-navy/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border-border bg-surface shadow-popover',
          'transition-transform duration-200 ease-out-expo',
          sideClasses.panel,
          sideClasses.enter,
          className,
        )}
        {...props}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3.5">
          <DialogPrimitive.Title className="text-base font-semibold text-ink">
            {header ?? title}
          </DialogPrimitive.Title>
          {!hideClose ? (
            <DialogPrimitive.Close
              className={cn(
                'rounded-control p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
                closeButtonClassName,
              )}
              aria-label="Close"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          ) : null}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto scrollbar-thin', className)} {...props} />
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('shrink-0 border-t border-border p-4', className)} {...props} />
  )
}
