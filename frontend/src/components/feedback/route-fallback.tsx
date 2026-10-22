/**
 * The fallback shown while a route chunk is loading.
 */

import { Loader2 } from 'lucide-react'

export function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex items-center gap-2.5 text-sm text-ink-secondary">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span role="status">Loading…</span>
      </div>
    </div>
  )
}

/** A lighter fallback for a section inside an already-rendered page. */
export function SectionFallback({ className }: { className?: string }) {
  return (
    <div className={className} role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  )
}
