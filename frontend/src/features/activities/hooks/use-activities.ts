/**
 * Activity queries and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { activitiesApi } from '@/features/activities/api/activities.api'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { ActivityListParams, ActivityPayload } from '@/types/api'

/** A paginated list of activities. */
export function useActivities(params: ActivityListParams) {
  return useQuery({
    queryKey: queryKeys.activities.list(params),
    queryFn: ({ signal }) => activitiesApi.list(params, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 15 * 1000,
  })
}

/** Records an activity against a customer. */
export function useCreateActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ customerId, payload }: { customerId: string; payload: ActivityPayload }) =>
      activitiesApi.create(customerId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activities.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Activity recorded')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not record the activity')
    },
  })
}
