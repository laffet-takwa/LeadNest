/**
 * The announcer.
 *
 * A polite live region that reports the result of asynchronous work, such as
 * "12 customers loaded". The context lives here so the provider and the hook
 * can be kept in separate files, which keeps fast refresh working.
 */

import { createContext, useContext } from 'react'

export interface AnnouncerContextValue {
  /** Announces a short message to screen readers. */
  announce: (message: string) => void
}

export const AnnouncerContext = createContext<AnnouncerContextValue | null>(null)

/** Returns the announcer. */
export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext)
  if (!context) {
    throw new Error('useAnnouncer must be used inside a LiveRegionProvider')
  }
  return context
}
