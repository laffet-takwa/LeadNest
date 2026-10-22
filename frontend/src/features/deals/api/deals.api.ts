/**
 * Deal API.
 */

import { getList, getOne, patch, post, remove } from '@/lib/api/client'
import type { Deal, DealListParams, DealPatch, DealPayload, DealWithCustomer } from '@/types/api'

export const dealsApi = {
  /** `GET /deals` — a paginated, filtered list. */
  list(params: DealListParams = {}, options?: { signal?: AbortSignal }) {
    return getList<DealWithCustomer>('/deals', { ...options, query: { ...params } })
  },

  /** `GET /deals/:id` — a single deal. */
  get(id: string, options?: { signal?: AbortSignal }) {
    return getOne<Deal>(`/deals/${id}`, options)
  },

  /** `POST /deals` — creates a deal. */
  create(payload: DealPayload) {
    return post<Deal>('/deals', payload)
  },

  /** `PATCH /deals/:id` — updates a deal, including its status. */
  update(id: string, payload: DealPatch) {
    return patch<Deal>(`/deals/${id}`, payload)
  },

  /** `DELETE /deals/:id` — removes a deal. */
  remove(id: string) {
    return remove(`/deals/${id}`)
  },
}
