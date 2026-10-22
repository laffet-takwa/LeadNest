/**
 * Sorting helpers for list views.
 *
 * The behaviour is kept in a pure function so the cycle can be verified
 * without rendering the table.
 */

export type SortOrder = 'asc' | 'desc'

export interface SortState {
  /** The column that is sorted, or null when the server default is used. */
  sort: string | null
  /** The direction, or null when the server default is used. */
  order: SortOrder | null
}

/**
 * Works out the next sorting state for a column header.
 *
 * Clicking a new column sorts it ascending. Clicking the same column again
 * reverses the direction, and a third click returns to the server default, so
 * the original ordering can be restored.
 */
export function nextSortState(current: SortState, key: string): SortState {
  if (current.sort !== key) {
    return { sort: key, order: 'asc' }
  }
  if (current.order === 'asc') {
    return { sort: key, order: 'desc' }
  }
  if (current.order === 'desc') {
    return { sort: null, order: null }
  }
  return { sort: key, order: 'asc' }
}
