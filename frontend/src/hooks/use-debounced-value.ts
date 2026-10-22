import { useEffect, useState } from 'react'

/**
 * Returns a value that only updates after it has been stable for `delayMs`.
 *
 * Used by the search fields so typing does not trigger a request per
 * keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
