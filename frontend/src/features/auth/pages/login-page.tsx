/**
 * The login page.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { AuthLayout, AuthLink } from '@/features/auth/components/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { loginSchema, type LoginInput } from '@/features/auth/schemas/auth.schemas'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError } from '@/lib/api/client'

export function LoginPage() {
  const { login, sessionExpired } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await login(values)
      void navigate(redirectTo, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setFormError('That email and password combination was not recognised.')
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
      title="Welcome back"
      subtitle="Sign in to pick up where your team left off."
      footer={
        <>
          New to LeadNest? <AuthLink to="/register">Create a company</AuthLink>
        </>
      }
    >
      {sessionExpired ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-input border border-warning-border bg-warning-soft px-3.5 py-3 text-sm text-warning"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Your session expired. Please sign in again.</span>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-input border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <form onSubmit={(event) => { void onSubmit(event) }} noValidate className="space-y-4">
        <FormField label="Email" htmlFor="login-email" error={errors.email?.message} required>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            {...register('email')}
            {...fieldA11y('login-email', errors.email?.message)}
          />
        </FormField>

        <FormField label="Password" htmlFor="login-password" error={errors.password?.message} required>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              {...register('password')}
              {...fieldA11y('login-password', errors.password?.message)}
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

        <Button type="submit" className="w-full" loading={isSubmitting} size="lg">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
