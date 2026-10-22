/**
 * Deal queries and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { dealsApi } from '@/features/deals/api/deals.api'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { DealListParams, DealPatch, DealPayload } from '@/types/api'

/** A paginated list of deals. */
export function useDeals(params: DealListParams) {
  return useQuery({
    queryKey: queryKeys.deals.list(params),
    queryFn: ({ signal }) => dealsApi.list(params, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 15 * 1000,
  })
}

/** A single deal. */
export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deals.detail(id ?? ''),
    queryFn: ({ signal }) => dealsApi.get(id ?? '', { signal }),
    enabled: Boolean(id),
  })
}

/** Creates a deal. */
export function useCreateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: DealPayload) => dealsApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Deal created')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the deal')
    },
  })
}

/**
 * Updates a deal.
 *
 * The dashboard is invalidated as well, because a status change moves the
 * deal between the pipeline buckets.
 */
export function useUpdateDeal(options?: { successMessage?: string | null }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DealPatch }) =>
      dealsApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      // A status change on the board is self-evident, so the caller can opt
      // out of the confirmation toast.
      const message = options?.successMessage
      if (message !== null) {
        toast.success(message ?? 'Deal updated')
      }
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the deal')
    },
  })
}

/** Deletes a deal. */
export function useDeleteDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dealsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.deals.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Deal deleted')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the deal')
    },
  })
}
