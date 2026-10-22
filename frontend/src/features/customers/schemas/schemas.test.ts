/**
 * Tests for the validation schemas.
 *
 * The rules must match the backend's, so a value that passes here is accepted
 * there.
 */

import { describe, expect, it } from 'vitest'

import { customerSchema } from '@/features/customers/schemas/customer.schemas'
import { amountSchema, dealSchema } from '@/features/deals/schemas/deal.schemas'
import { taskSchema } from '@/features/tasks/schemas/task.schemas'
import { activitySchema } from '@/features/activities/schemas/activity.schemas'
import { loginSchema, registerSchema, zodFieldErrors } from '@/features/auth/schemas/auth.schemas'

describe('customerSchema', () => {
  it('requires a name', () => {
    const result = customerSchema.safeParse({ full_name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const result = customerSchema.safeParse({ full_name: 'Amira', email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed phone number', () => {
    const result = customerSchema.safeParse({ full_name: 'Amira', phone: 'abc' })
    expect(result.success).toBe(false)
  })

  it('accepts an optional customer', () => {
    const result = customerSchema.safeParse({ full_name: 'Amira' })
    expect(result.success).toBe(true)
  })
})

describe('amountSchema', () => {
  it('accepts a positive decimal with two places', () => {
    expect(amountSchema.safeParse('1500.50').success).toBe(true)
  })

  it('accepts an integer', () => {
    expect(amountSchema.safeParse('100').success).toBe(true)
  })

  it('rejects a negative amount', () => {
    expect(amountSchema.safeParse('-1').success).toBe(false)
  })

  it('rejects more than two decimals', () => {
    expect(amountSchema.safeParse('1.234').success).toBe(false)
  })

  it('rejects text', () => {
    expect(amountSchema.safeParse('abc').success).toBe(false)
  })
})

describe('dealSchema', () => {
  const valid = {
    title: 'Annual licence',
    customer_id: 'customer-1',
    value: '1500.50',
    currency: 'TND',
    status: 'new',
  }

  it('accepts a valid deal', () => {
    expect(dealSchema.safeParse(valid).success).toBe(true)
  })

  it('requires a customer', () => {
    const result = dealSchema.safeParse({ ...valid, customer_id: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid currency code', () => {
    const result = dealSchema.safeParse({ ...valid, currency: 'DOLLARS' })
    expect(result.success).toBe(false)
  })
})

describe('taskSchema', () => {
  it('requires a title and an assignee', () => {
    const result = taskSchema.safeParse({
      title: '',
      assigned_to: '',
      priority: 'medium',
      status: 'pending',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid task', () => {
    const result = taskSchema.safeParse({
      title: 'Call back',
      assigned_to: 'user-1',
      priority: 'high',
      status: 'pending',
    })
    expect(result.success).toBe(true)
  })
})

describe('activitySchema', () => {
  it('requires a customer and a known type', () => {
    expect(activitySchema.safeParse({ customer_id: '', type: 'call' }).success).toBe(false)
    expect(activitySchema.safeParse({ customer_id: 'c1', type: 'pigeon' }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('requires a valid email and a password', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
  })
})

describe('registerSchema', () => {
  const valid = {
    companyName: 'Atlas',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
    fullName: 'Amira',
    adminEmail: 'amira@atlas.tn',
    adminPassword: 'ValidPass123',
    confirmPassword: 'ValidPass123',
  }

  it('requires a company name and a name', () => {
    const result = registerSchema.safeParse({ ...valid, companyName: '' })
    expect(result.success).toBe(false)
  })

  it('requires the passwords to match', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different123' })
    expect(result.success).toBe(false)
  })

  it('requires a password of at least eight characters', () => {
    const result = registerSchema.safeParse({
      ...valid,
      adminPassword: 'short',
      confirmPassword: 'short',
    })
    expect(result.success).toBe(false)
  })
})

describe('zodFieldErrors', () => {
  it('flattens the issues into a field map', () => {
    const result = loginSchema.safeParse({ email: 'nope', password: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const errors = zodFieldErrors(result.error)
      expect(errors.email).toBeDefined()
      expect(errors.password).toBeDefined()
    }
  })
})
