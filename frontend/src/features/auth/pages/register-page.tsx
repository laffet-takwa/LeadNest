/**
 * The registration page.
 *
 * The backend creates the company and its first administrator in a single
 * transactional request, so the form sends one payload rather than two
 * unrelated calls.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { AuthLayout, AuthLink } from '@/features/auth/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { registerSchema, type RegisterInput } from '@/features/auth/schemas/auth.schemas'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError } from '@/lib/api/client'

export function RegisterPage() {
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      companyEmail: '',
      companyPhone: '',
      companyWebsite: '',
      fullName: '',
      adminEmail: '',
      adminPassword: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await createAccount({
        company: {
          name: values.companyName,
          email: values.companyEmail || undefined,
          phone: values.companyPhone || undefined,
          website: values.companyWebsite || undefined,
        },
        admin: {
          full_name: values.fullName,
          email: values.adminEmail,
          password: values.adminPassword,
        },
      })
      void navigate('/dashboard', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setFormError('That email address is already registered. Try signing in instead.')
          return
        }
        setFormError(error.message)
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    }
  })

  return (
    <AuthLayout
      title="Create your company"
      subtitle="Set up LeadNest for your team in under a minute."
      footer={
        <>
          Already have an account? <AuthLink to="/login">Sign in</AuthLink>
        </>
      }
    >
      {formError ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-input border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className="space-y-5"
      >
        <fieldset className="space-y-4">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Your company
          </legend>

          <FormField
            label="Company name"
            htmlFor="register-company-name"
            error={errors.companyName?.message}
            required
          >
            <Input
              autoFocus
              autoComplete="organization"
              placeholder="Atlas Consulting"
              {...register('companyName')}
              {...fieldA11y('register-company-name', errors.companyName?.message)}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Company email"
              htmlFor="register-company-email"
              error={errors.companyEmail?.message}
            >
              <Input
                type="email"
                autoComplete="email"
                placeholder="hello@atlas.tn"
                {...register('companyEmail')}
                {...fieldA11y('register-company-email', errors.companyEmail?.message)}
              />
            </FormField>

            <FormField
              label="Phone"
              htmlFor="register-company-phone"
              error={errors.companyPhone?.message}
            >
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="+21620123456"
                {...register('companyPhone')}
                {...fieldA11y('register-company-phone', errors.companyPhone?.message)}
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-5">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Administrator
          </legend>

          <FormField
            label="Your name"
            htmlFor="register-full-name"
            error={errors.fullName?.message}
            required
          >
            <Input
              autoComplete="name"
              placeholder="Amira Ben Salah"
              {...register('fullName')}
              {...fieldA11y('register-full-name', errors.fullName?.message)}
            />
          </FormField>

          <FormField
            label="Your email"
            htmlFor="register-admin-email"
            error={errors.adminEmail?.message}
            required
          >
            <Input
              type="email"
              autoComplete="email"
              placeholder="amira@atlas.tn"
              {...register('adminEmail')}
              {...fieldA11y('register-admin-email', errors.adminEmail?.message)}
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="register-admin-password"
            error={errors.adminPassword?.message}
            hint="At least 8 characters"
            required
          >
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                {...register('adminPassword')}
                {...fieldA11y('register-admin-password', errors.adminPassword?.message)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </FormField>

          <FormField
            label="Confirm password"
            htmlFor="register-confirm-password"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              {...register('confirmPassword')}
              {...fieldA11y('register-confirm-password', errors.confirmPassword?.message)}
            />
          </FormField>
        </fieldset>

        <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
          Create company
        </Button>
      </form>
    </AuthLayout>
  )
}
