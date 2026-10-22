/**
 * The theme context.
 *
 * It lives in its own module so the provider file only exports a component,
 * which keeps React Fast Refresh working during development.
 */

import { createContext, useContext } from 'react'

/** What the user chose. "system" follows the operating system. */
export type ThemePreference = 'light' | 'dark' | 'system'

/** The theme that is actually applied right now. */
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Returns the current theme state. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
