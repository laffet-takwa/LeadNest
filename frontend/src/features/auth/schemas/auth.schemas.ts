/**
 * Zod schemas for the authentication forms.
 *
 * The rules mirror the backend's validation tags so the user sees the same
 * requirement before and after the request.
 */

import { z } from 'zod'

const email = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(200, 'Password is too long')

/** Phone numbers are optional and, when present, digits with an optional +. */
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''))

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(200),
  companyEmail: email.optional().or(z.literal('')),
  companyPhone: phone,
  companyWebsite: z
    .string()
    .trim()
    .url('Enter a valid URL')
    .optional()
    .or(z.literal('')),
  fullName: z.string().trim().min(1, 'Your name is required').max(200),
  adminEmail: email,
  adminPassword: password,
  confirmPassword: z.string().min(1, 'Confirm your password'),
}).refine((values) => values.adminPassword === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
})

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * Converts a Zod error into the flat field map the backend also returns, so
 * server-side and client-side errors can be displayed the same way.
 */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!(key in out)) out[key] = issue.message
  }
  return out
}
