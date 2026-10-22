/**
 * Zod schema for the deal form.
 *
 * The value is validated as a decimal string, never as a number, so no
 * binary floating-point rounding can creep into a monetary amount.
 */

import { z } from 'zod'

const currency = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'Use a three-letter ISO currency code, for example TND')
  .optional()
  .or(z.literal(''))

/** A non-negative decimal with at most two fractional digits. */
export const amountSchema = z
  .string()
  .trim()
  .min(1, 'Value is required')
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount with at most two decimals')
  .refine((value) => Number(value) >= 0, 'The value must not be negative')

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  customer_id: z.string().trim().min(1, 'Choose a customer'),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  value: amountSchema,
  currency: currency,
  status: z.string().optional().or(z.literal('')),
  assigned_to: z.string().optional().or(z.literal('')),
  expected_close: z.string().optional().or(z.literal('')),
})

export type DealFormValues = z.infer<typeof dealSchema>
