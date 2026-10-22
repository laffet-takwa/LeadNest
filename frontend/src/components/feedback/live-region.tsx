/**
 * LiveRegion.
 *
 * A polite live region that announces the results of asynchronous work. The
 * region is always present in the DOM and its text is swapped, so assistive
 * technology picks up the change.
 */

import { useCallback, useMemo, useRef, useState } from 'react'

import { AnnouncerContext, type AnnouncerContextValue } from '@/hooks/use-announcer'

export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')
  const timerRef = useRef<number | null>(null)

  const announce = useCallback((next: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    // The same text twice is not re-announced, so the message is cleared
    // first and set again on the next tick.
    setMessage('')
    timerRef.current = window.setTimeout(() => setMessage(next), 60)
  }, [])

  const value = useMemo<AnnouncerContextValue>(() => ({ announce }), [announce])

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  )
}
