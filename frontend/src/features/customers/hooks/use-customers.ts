/**
 * Customer queries and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { customersApi } from '@/features/customers/api/customers.api'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { CustomerListParams, CustomerPayload } from '@/types/api'

/** A paginated list of customers. */
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: ({ signal }) => customersApi.list(params, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 15 * 1000,
  })
}

/** A single customer. */
export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id ?? ''),
    queryFn: ({ signal }) => customersApi.get(id ?? '', { signal }),
    enabled: Boolean(id),
  })
}

/** A customer together with its deals and activities. */
export function useCustomerDetails(id: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.customers.detail(id ?? ''), 'details'] as const,
    queryFn: ({ signal }) => customersApi.getWithDetails(id ?? '', 'deals,activities', { signal }),
    enabled: Boolean(id),
  })
}

/**
 * Type-ahead customer search for the global search field.
 *
 * The query is disabled until the term is long enough to be useful, so the
 * application does not ask the server for every keystroke.
 */
export function useCustomerSearch(term: string, limit = 6) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: [...queryKeys.customers.all, 'search', trimmed, limit] as const,
    queryFn: ({ signal }) =>
      customersApi.list({ search: trimmed, limit }, { signal }),
    enabled: trimmed.length >= 2,
    staleTime: 30 * 1000,
  })
}

/** Creates a customer. */
export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CustomerPayload) => customersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Customer added')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the customer')
    },
  })
}

/**
 * Updates a customer.
 *
 * The payload is the complete desired state, because the backend replaces
 * every writable column rather than merging the request with the record.
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerPayload }) =>
      customersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Customer updated')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the customer')
    },
  })
}

/** Deletes a customer. */
export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Customer deleted')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the customer')
    },
  })
}
