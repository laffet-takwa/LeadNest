/**
 * Unit tests for the sorting cycle used by the list views.
 */

import { describe, expect, it } from 'vitest'

import { nextSortState } from '@/lib/utils/sort'

describe('nextSortState', () => {
  it('sorts a new column ascending', () => {
    expect(nextSortState({ sort: null, order: null }, 'full_name')).toEqual({
      sort: 'full_name',
      order: 'asc',
    })
  })

  it('replaces the previous column when another one is chosen', () => {
    expect(nextSortState({ sort: 'full_name', order: 'desc' }, 'created_at')).toEqual({
      sort: 'created_at',
      order: 'asc',
    })
  })

  it('reverses the direction when the same column is chosen again', () => {
    expect(nextSortState({ sort: 'full_name', order: 'asc' }, 'full_name')).toEqual({
      sort: 'full_name',
      order: 'desc',
    })
  })

  it('returns to the server default after the second reversal', () => {
    expect(nextSortState({ sort: 'full_name', order: 'desc' }, 'full_name')).toEqual({
      sort: null,
      order: null,
    })
  })

  it('keeps a descending sort when the column is chosen a third time', () => {
    const state = nextSortState({ sort: null, order: null }, 'created_at')
    const reversed = nextSortState(state, 'created_at')
    const cleared = nextSortState(reversed, 'created_at')
    expect(cleared).toEqual({ sort: null, order: null })
    expect(nextSortState(cleared, 'created_at')).toEqual({
      sort: 'created_at',
      order: 'asc',
    })
  })
})
