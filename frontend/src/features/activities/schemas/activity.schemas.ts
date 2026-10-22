/**
 * Zod schema for the activity form.
 */

import { z } from 'zod'

export const activitySchema = z.object({
  customer_id: z.string().trim().min(1, 'Choose a customer'),
  deal_id: z.string().optional().or(z.literal('')),
  type: z.enum(['call', 'email', 'meeting', 'note', 'message', 'other']),
  subject: z.string().trim().max(255).optional().or(z.literal('')),
  description: z.string().trim().max(10_000).optional().or(z.literal('')),
  occurred_at: z.string().optional().or(z.literal('')),
})

export type ActivityFormValues = z.infer<typeof activitySchema>
