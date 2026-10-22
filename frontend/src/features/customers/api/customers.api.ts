/**
 * Customer API.
 */

import { getList, getOne, patch, post, remove } from '@/lib/api/client'
import type { Activity, Customer, CustomerListParams, CustomerPayload, Deal } from '@/types/api'

/** A customer together with the related records the backend can include. */
export type CustomerWithDetails = Customer & {
  deals?: Deal[]
  activities?: Activity[]
}

export const customersApi = {
  /** `GET /customers` — a paginated, searchable list. */
  list(params: CustomerListParams = {}, options?: { signal?: AbortSignal }) {
    return getList<Customer>('/customers', { ...options, query: { ...params } })
  },

  /** `GET /customers/:id` — a single customer. */
  get(id: string, options?: { signal?: AbortSignal }) {
    return getOne<Customer>(`/customers/${id}`, options)
  },

  /** `GET /customers/:id?include=deals,activities` — related records. */
  getWithDetails(
    id: string,
    include: 'deals' | 'activities' | 'deals,activities' = 'deals,activities',
    options?: { signal?: AbortSignal },
  ): Promise<CustomerWithDetails> {
    return getOne<CustomerWithDetails>(`/customers/${id}`, {
      ...options,
      query: { include },
    })
  },

  /** `POST /customers` — creates a customer. */
  create(payload: CustomerPayload) {
    return post<Customer>('/customers', payload)
  },

  /**
   * `PATCH /customers/:id` — updates a customer.
   *
   * The backend replaces every writable column, so the payload has to carry
   * the complete desired state: an omitted field is cleared, not preserved.
   */
  update(id: string, payload: CustomerPayload) {
    return patch<Customer>(`/customers/${id}`, payload)
  },

  /** `DELETE /customers/:id` — removes a customer and its dependent records. */
  remove(id: string) {
    return remove(`/customers/${id}`)
  },
}
