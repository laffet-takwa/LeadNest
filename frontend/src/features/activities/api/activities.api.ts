/**
 * Activity API.
 */

import { getList, getOne, post } from '@/lib/api/client'
import type { Activity, ActivityListParams, ActivityPayload } from '@/types/api'

export const activitiesApi = {
  /** `GET /activities` — a paginated, filtered feed. */
  list(params: ActivityListParams = {}, options?: { signal?: AbortSignal }) {
    return getList<Activity>('/activities', { ...options, query: { ...params } })
  },

  /** `GET /activities/:id` — a single activity. */
  get(id: string, options?: { signal?: AbortSignal }) {
    return getOne<Activity>(`/activities/${id}`, options)
  },

  /** `POST /customers/:customerId/activities` — records an activity. */
  create(customerId: string, payload: ActivityPayload) {
    return post<Activity>(`/customers/${customerId}/activities`, payload)
  },
}
