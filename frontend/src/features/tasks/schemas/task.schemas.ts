/**
 * Zod schema for the task form.
 */

import { z } from 'zod'

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  assigned_to: z.string().trim().min(1, 'Choose an assignee'),
  customer_id: z.string().optional().or(z.literal('')),
  deal_id: z.string().optional().or(z.literal('')),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'completed', 'cancelled']),
  due_date: z.string().optional().or(z.literal('')),
})

export type TaskFormValues = z.infer<typeof taskSchema>
