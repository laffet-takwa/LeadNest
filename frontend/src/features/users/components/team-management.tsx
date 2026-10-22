/**
 * Team management.
 *
 * The member list and the "add member" form are shared by the team page and
 * the team section of the settings page, so both offer the same controls.
 */

import { Plus, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Avatar } from '@/components/ui/avatar'
import { Badge, Card } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormField, fieldA11y } from '@/components/forms/form-field'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import {
  useCreateEmployee,
  useDeactivateEmployee,
  useUpdateEmployee,
  useUsers,
} from '@/features/companies/hooks/use-company'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError } from '@/lib/api/client'
import { formatDate } from '@/lib/utils/date'
import type { Role, User } from '@/types/api'

const memberSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
  role: z.enum(['admin', 'employee']),
})

type MemberFormValues = z.infer<typeof memberSchema>

export function TeamManagement({
  addDialogOpen,
  onAddDialogOpenChange,
  showAddButton = true,
}: {
  /** Whether the "add member" dialog is open. */
  addDialogOpen: boolean
  onAddDialogOpenChange: (open: boolean) => void
  /** Renders an "add member" button above the list. */
  showAddButton?: boolean
}) {
  const { user: currentUser } = useAuth()
  const { data, isLoading, error, refetch } = useUsers(true)
  const updateEmployee = useUpdateEmployee()
  const deactivateEmployee = useDeactivateEmployee()
  const [deactivating, setDeactivating] = useState<User | null>(null)

  return (
    <>
      {showAddButton ? (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => onAddDialogOpenChange(true)} icon={<Plus className="size-4" />}>
            Add member
          </Button>
        </div>
      ) : null}

      {error ? (
        <ErrorState
          title="The team could not be loaded"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-4" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="skeleton h-14" />
              ))}
            </div>
          ) : (data?.data.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Users}
                title="No team members yet"
                description="Add a colleague so you can share customers and assign follow-ups."
                action={
                  <Button size="sm" onClick={() => onAddDialogOpenChange(true)}>
                    Add your first member
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data?.data.map((member) => {
                const isSelf = member.id === currentUser?.id
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <Avatar name={member.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                        {member.full_name}
                        {isSelf ? (
                          <span className="text-2xs font-normal text-ink-muted">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-ink-secondary">{member.email}</p>
                    </div>

                    <Badge tone={member.role === 'admin' ? 'brand' : 'neutral'}>
                      {member.role === 'admin' ? (
                        <ShieldCheck className="size-3" aria-hidden="true" />
                      ) : null}
                      {member.role === 'admin' ? 'Administrator' : 'Employee'}
                    </Badge>

                    {!member.is_active ? <Badge tone="danger">Deactivated</Badge> : null}

                    <span className="hidden text-2xs text-ink-muted lg:inline">
                      joined {formatDate(member.created_at)}
                    </span>

                    {!isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(role) =>
                          updateEmployee.mutate({
                            id: member.id,
                            payload: { role: role as Role },
                          })
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-32"
                          aria-label={`Role for ${member.full_name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="admin">Administrator</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}

                    {!isSelf && member.is_active ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-ink-muted hover:text-danger"
                        onClick={() => setDeactivating(member)}
                        aria-label={`Deactivate ${member.full_name}`}
                      >
                        <UserMinus className="size-3.5" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      <AddMemberDialog open={addDialogOpen} onOpenChange={onAddDialogOpenChange} />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => {
          if (!open) setDeactivating(null)
        }}
        title="Deactivate this team member?"
        description={
          <>
            <strong className="font-medium text-ink">{deactivating?.full_name}</strong> will lose
            access to the company immediately. Their records are kept.
          </>
        }
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivating) {
            deactivateEmployee.mutate(deactivating.id, {
              onSettled: () => setDeactivating(null),
            })
          }
        }}
      />
    </>
  )
}

function AddMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createEmployee = useCreateEmployee()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { full_name: '', email: '', password: '', role: 'employee' },
  })

  const role = watch('role')

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await createEmployee.mutateAsync({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      })
      reset()
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof MemberFormValues, { type: 'server', message })
        }
        if (Object.keys(fieldErrors).length === 0) setFormError(error.message)
      } else {
        setFormError('Could not add the team member.')
      }
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a team member</DialogTitle>
          <DialogDescription>
            They will be able to manage customers, deals and tasks right away.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void onSubmit(event)
          }}
          noValidate
        >
          <DialogBody className="space-y-4">
            {formError ? (
              <p
                role="alert"
                className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger"
              >
                {formError}
              </p>
            ) : null}

            <FormField
              label="Full name"
              htmlFor="member-name"
              error={errors.full_name?.message}
              required
            >
              <Input
                autoComplete="name"
                {...register('full_name')}
                {...fieldA11y('member-name', errors.full_name?.message)}
                placeholder="Sami Trabelsi"
              />
            </FormField>

            <FormField label="Email" htmlFor="member-email" error={errors.email?.message} required>
              <Input
                type="email"
                autoComplete="email"
                {...register('email')}
                {...fieldA11y('member-email', errors.email?.message)}
                placeholder="sami@atlas.tn"
              />
            </FormField>

            <FormField
              label="Temporary password"
              htmlFor="member-password"
              error={errors.password?.message}
              hint="At least 8 characters. Share it with the new member."
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...register('password')}
                {...fieldA11y('member-password', errors.password?.message)}
              />
            </FormField>

            <FormField label="Role" htmlFor="member-role" error={errors.role?.message}>
              <Select
                value={role}
                onValueChange={(value) => setValue('role', value as Role, { shouldValidate: true })}
              >
                <SelectTrigger id="member-role" aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || createEmployee.isPending}>
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
