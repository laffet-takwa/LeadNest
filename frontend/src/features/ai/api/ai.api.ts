/**
 * AI API.
 *
 * The three capabilities map onto the backend's three generation endpoints.
 * The AI interaction history has its own endpoint.
 */

import { getList, post } from '@/lib/api/client'
import type {
  AIInteraction,
  CustomerSummaryPayload,
  CustomerSummaryResult,
  EmailDraftPayload,
  EmailDraftResult,
  FollowUpPayload,
  FollowUpResult,
} from '@/types/api'

export const aiApi = {
  /** `POST /ai/email-draft` — generates a follow-up email draft. */
  emailDraft(payload: EmailDraftPayload) {
    return post<EmailDraftResult>('/ai/email-draft', payload)
  },

  /** `POST /ai/customer-summary` — summarises a customer and their history. */
  customerSummary(payload: CustomerSummaryPayload) {
    return post<CustomerSummaryResult>('/ai/customer-summary', payload)
  },

  /** `POST /ai/follow-up-suggestions` — suggests who to follow up with. */
  followUpSuggestions(payload: FollowUpPayload = {}) {
    return post<FollowUpResult>('/ai/follow-up-suggestions', payload)
  },

  /** `GET /ai/history` — the recorded AI interactions. */
  history(
    params: { limit?: number; offset?: number; type?: string } = {},
    options?: { signal?: AbortSignal },
  ) {
    return getList<AIInteraction>('/ai/history', { ...options, query: { ...params } })
  },
}
