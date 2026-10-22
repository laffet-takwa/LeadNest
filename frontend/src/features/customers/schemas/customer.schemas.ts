/**
 * Zod schema for the customer form.
 *
 * The rules mirror the backend's validation tags. The email and phone
 * patterns are intentionally the same shape as the server's, so a value that
 * passes here is accepted there.
 */

import { z } from 'zod'

const email = z.string().trim().email('Enter a valid email address').optional().or(z.literal(''))

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''))

export const customerSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  company: z.string().trim().max(200).optional().or(z.literal('')),
  email,
  phone,
  source: z.string().trim().max(200).optional().or(z.literal('')),
  assigned_to: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().or(z.literal('')),
})

export type CustomerFormValues = z.infer<typeof customerSchema>
