/**
 * The customer form, used for both creating and editing.
 *
 * The dialog stays open until the request succeeds, and the entered values
 * are preserved when it fails.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { customerSchema, type CustomerFormValues } from '@/features/customers/schemas/customer.schemas'
import { useCreateCustomer, useUpdateCustomer } from '@/features/customers/hooks/use-customers'
import { useAssigneeOptions } from '@/features/companies/hooks/use-company'
import { CUSTOMER_SOURCES, NO_ASSIGNEE } from '@/lib/constants/domain'
import { ApiError } from '@/lib/api/client'
import type { Customer, CustomerPayload } from '@/types/api'

const EMPTY: CustomerFormValues = {
  full_name: '',
  company: '',
  email: '',
  phone: '',
  source: '',
  assigned_to: '',
  notes: '',
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits this customer instead of creating one. */
  customer?: Customer
  onSaved?: (customer: Customer) => void
}) {
  const isEditing = Boolean(customer)
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const assignees = useAssigneeOptions()
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const defaultValues = useMemo<CustomerFormValues>(
    () =>
      customer
        ? {
            full_name: customer.full_name,
            company: customer.company ?? '',
            email: customer.email ?? '',
            phone: customer.phone ?? '',
            source: customer.source ?? '',
            assigned_to: customer.assigned_to ?? '',
            notes: customer.notes ?? '',
          }
        : EMPTY,
    [customer],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setServerErrors({})
    }
  }, [open, defaultValues, reset])

  const selectedSource = watch('source')
  const selectedAssignee = watch('assigned_to')

  /**
   * The current assignee is kept in the option list even when the signed-in
   * user cannot list their colleagues, so an existing assignment is never
   * silently dropped.
   */
  const assigneeOptions = useMemo(() => {
    if (!selectedAssignee) return assignees
    if (assignees.some((member) => member.id === selectedAssignee)) return assignees
    return [
      ...assignees,
      { id: selectedAssignee, full_name: 'Current assignee', role: 'employee', is_active: true },
    ]
  }, [assignees, selectedAssignee])

  const onSubmit = handleSubmit(async (values) => {
    setServerErrors({})
    // The backend replaces every writable column, so the payload carries the
    // complete state of the record: an empty string clears the field.
    const payload: CustomerPayload = {
      full_name: values.full_name,
      company: values.company ?? '',
      email: values.email ?? '',
      phone: values.phone ?? '',
      source: values.source ?? '',
      assigned_to: values.assigned_to ?? '',
      notes: values.notes ?? '',
    }

    try {
      const saved = customer
        ? await updateCustomer.mutateAsync({ id: customer.id, payload })
        : await createCustomer.mutateAsync(payload)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      // The dialog stays open and the values are preserved.
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        setServerErrors(fieldErrors)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof CustomerFormValues, { type: 'server', message })
        }
      }
    }
  })

  const busy = isSubmitting || createCustomer.isPending || updateCustomer.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit customer' : 'Add customer'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the contact details for this customer.'
              : 'Add a customer to your company. Only the name is required.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => { void onSubmit(event) }} noValidate>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Full name"
                htmlFor="customer-full-name"
                error={errors.full_name?.message ?? serverErrors.full_name}
                required
              >
                <Input
                  {...register('full_name')}
                  {...fieldA11y('customer-full-name', errors.full_name?.message)}
                  placeholder="Amira Ben Salah"
                  autoComplete="name"
                />
              </FormField>

              <FormField
                label="Company"
                htmlFor="customer-company"
                error={errors.company?.message ?? serverErrors.company}
              >
                <Input
                  {...register('company')}
                  {...fieldA11y('customer-company', errors.company?.message)}
                  placeholder="Atlas Consulting"
                  autoComplete="organization"
                />
              </FormField>

              <FormField
                label="Email"
                htmlFor="customer-email"
                error={errors.email?.message ?? serverErrors.email}
              >
                <Input
                  type="email"
                  {...register('email')}
                  {...fieldA11y('customer-email', errors.email?.message)}
                  placeholder="amira@atlas.tn"
                  autoComplete="email"
                />
              </FormField>

              <FormField
                label="Phone"
                htmlFor="customer-phone"
                error={errors.phone?.message ?? serverErrors.phone}
              >
                <Input
                  type="tel"
                  {...register('phone')}
                  {...fieldA11y('customer-phone', errors.phone?.message)}
                  placeholder="+21620123456"
                  autoComplete="tel"
                />
              </FormField>

              <FormField
                label="Source"
                htmlFor="customer-source"
                error={errors.source?.message ?? serverErrors.source}
              >
                <Select
                  value={selectedSource || undefined}
                  onValueChange={(value) => setValue('source', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="customer-source" aria-label="Source">
                    <SelectValue placeholder="How did they find you?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('source')} />
              </FormField>

              <FormField
                label="Assigned to"
                htmlFor="customer-assigned"
                error={errors.assigned_to?.message ?? serverErrors.assigned_to}
              >
                <Select
                  value={selectedAssignee || NO_ASSIGNEE}
                  onValueChange={(value) =>
                    setValue('assigned_to', value === NO_ASSIGNEE ? '' : value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="customer-assigned" aria-label="Assigned employee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
                    {assigneeOptions.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('assigned_to')} />
              </FormField>
            </div>

            <FormField
              label="Notes"
              htmlFor="customer-notes"
              error={errors.notes?.message ?? serverErrors.notes}
              hint="Only visible to your team"
            >
              <Textarea
                {...register('notes')}
                {...fieldA11y('customer-notes', errors.notes?.message)}
                placeholder="Context, preferences, anything worth remembering."
                rows={3}
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {isEditing ? 'Save changes' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
