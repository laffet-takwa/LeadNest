/**
 * The settings page.
 *
 * Each section is an independent form. A control is only shown when the
 * backend actually supports it, so there are no dead settings.
 */

import {
  Building2,
  KeyRound,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/page-header'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useCompany, useUpdateCompany } from '@/features/companies/hooks/use-company'
import { TeamManagement } from '@/features/users/components/team-management'
import { useTheme, type ThemePreference } from '@/app/theme-context'
import { ApiError } from '@/lib/api/client'
import { formatDate } from '@/lib/utils/date'

/** The themes offered on the appearance card. */
const THEME_OPTIONS: {
  value: ThemePreference
  label: string
  description: string
  icon: typeof Sun
}[] = [
  { value: 'light', label: 'Light', description: 'A bright interface for daytime work.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'A dimmed interface that is easier at night.', icon: Moon },
  { value: 'system', label: 'System', description: 'Follow whatever your device is set to.', icon: Monitor },
]

const companySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(200),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  website: z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
})

type CompanyFormValues = z.infer<typeof companySchema>

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z
      .string()
      .min(8, 'The new password must be at least 8 characters')
      .max(128, 'The new password is too long'),
    confirm_password: z.string().min(1, 'Repeat the new password'),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'The two passwords do not match',
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ['new_password'],
    message: 'The new password must be different from the current one',
  })

type PasswordFormValues = z.infer<typeof passwordSchema>

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const tab = searchParams.get('tab') ?? 'company'
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const tabs = [
    { value: 'company', label: 'Company', icon: Building2, visible: true },
    { value: 'profile', label: 'Profile', icon: UserRound, visible: true },
    { value: 'appearance', label: 'Appearance', icon: Palette, visible: true },
    { value: 'security', label: 'Security', icon: ShieldCheck, visible: true },
    { value: 'team', label: 'Team', icon: Users, visible: isAdmin },
  ].filter((entry) => entry.visible)

  /**
   * Switching the tab keeps the other query parameters, so a link that opens
   * a specific tab does not lose the rest of the state.
   */
  const selectTab = (value: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        next.set('tab', value)
        return next
      },
      { replace: true },
    )
  }

  return (
    <>
      <PageHeader title="Settings" description="Manage your company, your profile and your team." />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList className="flex flex-wrap">
          {tabs.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              <entry.icon className="size-4" aria-hidden="true" />
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="company">
          <CompanySettings />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileSettings />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySettings />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="team">
            <TeamManagement
              addDialogOpen={addMemberOpen}
              onAddDialogOpenChange={setAddMemberOpen}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  )
}

function CompanySettings() {
  const { isAdmin } = useAuth()
  const { data: company, isLoading } = useCompany()
  const updateCompany = useUpdateCompany()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', email: '', phone: '', website: '' },
  })

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        email: company.email ?? '',
        phone: company.phone ?? '',
        website: company.website ?? '',
      })
    }
  }, [company, reset])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await updateCompany.mutateAsync({
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        website: values.website || undefined,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof CompanyFormValues, { type: 'server', message })
        }
        if (Object.keys(fieldErrors).length === 0) setFormError(error.message)
      } else {
        setFormError('Could not save the company profile.')
      }
    }
  })

  if (isLoading) {
    return <div className="skeleton h-72 max-w-2xl rounded-card" />
  }

  // Only an administrator may change the company. Everyone else sees the
  // details without a form that would fail on save.
  if (!isAdmin) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <div>
            <CardTitle>Company profile</CardTitle>
            <p className="mt-0.5 text-xs text-ink-secondary">
              The details your company appears with across LeadNest.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink-muted">Name</dt>
              <dd className="mt-0.5 text-sm text-ink">{company?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Email</dt>
              <dd className="mt-0.5 text-sm text-ink">{company?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Phone</dt>
              <dd className="mt-0.5 text-sm text-ink">{company?.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Website</dt>
              <dd className="mt-0.5 text-sm text-ink">{company?.website ?? '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-input bg-surface-sunken px-3.5 py-2.5 text-xs text-ink-secondary">
            Only an administrator can change the company details. Ask an administrator if
            something needs updating.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Company profile</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            This information identifies your company to the rest of your team.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <form onSubmit={(event) => { void onSubmit(event) }} noValidate className="space-y-4">
          {formError ? (
            <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger">
              {formError}
            </p>
          ) : null}

          <FormField label="Company name" htmlFor="company-name" error={errors.name?.message} required>
            <Input
              {...register('name')}
              {...fieldA11y('company-name', errors.name?.message)}
              placeholder="Atlas Consulting"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email" htmlFor="company-email" error={errors.email?.message}>
              <Input
                type="email"
                {...register('email')}
                {...fieldA11y('company-email', errors.email?.message)}
                placeholder="hello@atlas.tn"
              />
            </FormField>

            <FormField label="Phone" htmlFor="company-phone" error={errors.phone?.message}>
              <Input
                type="tel"
                {...register('phone')}
                {...fieldA11y('company-phone', errors.phone?.message)}
                placeholder="+21620123456"
              />
            </FormField>
          </div>

          <FormField label="Website" htmlFor="company-website" error={errors.website?.message}>
            <Input
              type="url"
              {...register('website')}
              {...fieldA11y('company-website', errors.website?.message)}
              placeholder="https://atlas.tn"
            />
          </FormField>

          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting || updateCompany.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}

function ProfileSettings() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Your profile</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Your name, email address and role in this company.
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} size="lg" />
          <div>
            <p className="font-medium text-ink">{user.full_name}</p>
            <p className="text-sm text-ink-secondary">{user.email}</p>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-muted">Role</dt>
            <dd className="mt-0.5 text-sm capitalize text-ink">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Member since</dt>
            <dd className="mt-0.5 text-sm text-ink">{formatDate(user.created_at)}</dd>
          </div>
        </dl>
        <p className="rounded-input bg-surface-sunken px-3.5 py-2.5 text-xs text-ink-secondary">
          The backend does not expose an endpoint to edit your own profile, so these details are
          read-only here. An administrator can update your name and role from the team page.
        </p>
      </CardBody>
    </Card>
  )
}

function AppearanceSettings() {
  const { preference, resolved, setPreference } = useTheme()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div>
          <CardTitle>Appearance</CardTitle>
          <p className="mt-0.5 text-xs text-ink-secondary">
            How LeadNest looks on this device. The choice is remembered on this browser.
          </p>
        </div>
      </CardHeader>
      <CardBody>
        <RadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
          aria-label="Colour theme"
          className="grid gap-3 sm:grid-cols-3"
          orientation="horizontal"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                card
              >
                <span className="mt-2 flex items-center gap-2 text-ink-muted">
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="text-2xs">Preview</span>
                </span>
              </RadioGroupItem>
            )
          })}
        </RadioGroup>
        <p className="mt-4 text-xs text-ink-muted">
          The active theme is <span className="font-medium text-ink-secondary">{resolved}</span>.
          The interface also follows your device&rsquo;s reduced-motion setting automatically.
        </p>
      </CardBody>
    </Card>
  )
}

function SecuritySettings() {
  const { changePassword } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setSaved(false)
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      })
      reset()
      setSaved(true)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof PasswordFormValues, { type: 'server', message })
        }
        if (Object.keys(fieldErrors).length === 0) setFormError(error.message)
      } else {
        setFormError('Could not change your password.')
      }
    }
  })

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Change password</CardTitle>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Your session stays signed in; the stored session is rotated when the change succeeds.
            </p>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={(event) => { void onSubmit(event) }} noValidate className="space-y-4">
            {formError ? (
              <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}
            {saved ? (
              <p
                role="status"
                className="rounded-input bg-success-soft px-3 py-2 text-sm text-success"
              >
                Your password has been changed.
              </p>
            ) : null}

            <FormField
              label="Current password"
              htmlFor="current-password"
              error={errors.current_password?.message}
              required
            >
              <Input
                type="password"
                autoComplete="current-password"
                {...register('current_password')}
                {...fieldA11y('current-password', errors.current_password?.message)}
              />
            </FormField>

            <FormField
              label="New password"
              htmlFor="new-password"
              error={errors.new_password?.message}
              hint="At least 8 characters."
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...register('new_password')}
                {...fieldA11y('new-password', errors.new_password?.message)}
              />
            </FormField>

            <FormField
              label="Repeat new password"
              htmlFor="confirm-password"
              error={errors.confirm_password?.message}
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...register('confirm_password')}
                {...fieldA11y('confirm-password', errors.confirm_password?.message)}
              />
            </FormField>

            <div className="flex justify-end">
              <Button
                type="submit"
                loading={isSubmitting}
                icon={<KeyRound className="size-4" />}
              >
                Change password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>How your session is protected</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-ink-secondary">
          <p>
            Passwords are hashed with Argon2id and are never returned by the API. Access tokens are
            short-lived and stored only in memory for the duration of the session.
          </p>
          <p>
            Signing out revokes the stored refresh token immediately, so a copied link cannot be used
            to restore the session.
          </p>
          <p className="rounded-input bg-surface-sunken px-3.5 py-2.5 text-xs">
            The backend does not expose a two-factor endpoint yet, so it cannot be enabled here.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
