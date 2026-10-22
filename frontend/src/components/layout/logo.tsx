/**
 * Brand mark and wordmark.
 */

import { cn } from '@/lib/utils'

export function LeadNestLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-[0.625rem] bg-brand-600 text-white shadow-xs',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-4.5" fill="none">
        <path d="M5 18V6h3.4l6.2 8.3V6H18v12h-3.4L8.4 9.7V18H5Z" fill="currentColor" />
      </svg>
    </span>
  )
}

export function LeadNestWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[0.9375rem] font-semibold tracking-tight text-white', className)}>
      Lead<span className="text-brand-300">Nest</span>
    </span>
  )
}
