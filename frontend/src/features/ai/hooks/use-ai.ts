/**
 * AI queries and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { aiApi } from '@/features/ai/api/ai.api'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type {
  CustomerSummaryPayload,
  CustomerSummaryResult,
  EmailDraftPayload,
  EmailDraftResult,
  FollowUpPayload,
  FollowUpResult,
} from '@/types/api'

/** The recorded AI interactions. */
export function useAIHistory(params: { limit?: number; offset?: number; type?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.ai.history(params),
    queryFn: ({ signal }) => aiApi.history(params, { signal }),
    staleTime: 30 * 1000,
  })
}

/** Generates an email draft. */
export function useEmailDraft() {
  const queryClient = useQueryClient()
  return useMutation<EmailDraftResult, Error, EmailDraftPayload>({
    mutationFn: (payload: EmailDraftPayload) => aiApi.emailDraft(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all })
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not generate the draft')
    },
  })
}

/** Generates a customer summary. */
export function useCustomerSummary() {
  const queryClient = useQueryClient()
  return useMutation<CustomerSummaryResult, Error, CustomerSummaryPayload>({
    mutationFn: (payload: CustomerSummaryPayload) => aiApi.customerSummary(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all })
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not generate the summary')
    },
  })
}

/** Generates follow-up suggestions. */
export function useFollowUpSuggestions() {
  const queryClient = useQueryClient()
  return useMutation<FollowUpResult, Error, FollowUpPayload>({
    mutationFn: (payload: FollowUpPayload = {}) => aiApi.followUpSuggestions(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.ai.all })
    },
    onError: (error: Error) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not load the suggestions')
    },
  })
}
