/**
 * The deal form dialog.
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
import { useCreateDeal, useUpdateDeal } from '@/features/deals/hooks/use-deals'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useAssigneeOptions } from '@/features/companies/hooks/use-company'
import { dealSchema, type DealFormValues } from '@/features/deals/schemas/deal.schemas'
import { CURRENCIES, DEAL_STATUSES, NO_ASSIGNEE } from '@/lib/constants/domain'
import { ApiError } from '@/lib/api/client'
import type { Deal } from '@/types/api'

const EMPTY: DealFormValues = {
  title: '',
  customer_id: '',
  description: '',
  value: '',
  currency: 'TND',
  status: 'new',
  assigned_to: '',
  expected_close: '',
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  defaultCustomerId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the form edits this deal. */
  deal?: Deal
  /** Pre-selects a customer, used when the form is opened from a customer. */
  defaultCustomerId?: string
  onSaved?: (deal: Deal) => void
}) {
  const isEditing = Boolean(deal)
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()
  const { data: customers } = useCustomers({ limit: 100, sort: 'full_name', order: 'asc' })
  const assignees = useAssigneeOptions()
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const defaultValues = useMemo<DealFormValues>(
    () =>
      deal
        ? {
            title: deal.title,
            customer_id: deal.customer_id,
            description: deal.description ?? '',
            value: deal.value,
            currency: deal.currency,
            status: deal.status,
            assigned_to: deal.assigned_to ?? '',
            expected_close: deal.expected_close ? deal.expected_close.slice(0, 10) : '',
          }
        : { ...EMPTY, customer_id: defaultCustomerId ?? '' },
    [deal, defaultCustomerId],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setServerErrors({})
    }
  }, [open, defaultValues, reset])

  const selectedCustomerId = watch('customer_id')
  const selectedCurrency = watch('currency') || 'TND'

  const onSubmit = handleSubmit(async (values) => {
    setServerErrors({})
    const payload = {
      customer_id: values.customer_id,
      title: values.title,
      description: values.description || undefined,
      value: values.value,
      currency: values.currency || 'TND',
      status: (values.status || 'new') as Deal['status'],
      assigned_to: values.assigned_to || undefined,
      expected_close: values.expected_close || undefined,
    }

    try {
      const saved = deal
        ? await updateDeal.mutateAsync({ id: deal.id, payload })
        : await createDeal.mutateAsync(payload)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        setServerErrors(fieldErrors)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof DealFormValues, { type: 'server', message })
        }
      }
    }
  })

  const busy = isSubmitting || createDeal.isPending || updateDeal.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit deal' : 'New deal'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the opportunity details.'
              : 'Track a sales opportunity for one of your customers.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => { void onSubmit(event) }} noValidate>
          <DialogBody className="space-y-4">
            <FormField label="Title" htmlFor="deal-title" error={errors.title?.message} required>
              <Input
                autoFocus
                placeholder="Annual licence renewal"
                {...register('title')}
                {...fieldA11y('deal-title', errors.title?.message)}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Customer"
                htmlFor="deal-customer"
                error={errors.customer_id?.message ?? serverErrors.customer_id}
                required
              >
                <Select
                  value={selectedCustomerId || undefined}
                  onValueChange={(value) => setValue('customer_id', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="deal-customer" aria-label="Customer">
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.data.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.full_name}
                        {customer.company ? ` · ${customer.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('customer_id')} />
              </FormField>

              <FormField
                label="Assigned to"
                htmlFor="deal-assigned"
                error={errors.assigned_to?.message ?? serverErrors.assigned_to}
              >
                <Select
                  value={watch('assigned_to') || NO_ASSIGNEE}
                  onValueChange={(value) =>
                    setValue('assigned_to', value === NO_ASSIGNEE ? '' : value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="deal-assigned" aria-label="Assigned employee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ASSIGNEE}>Unassigned</SelectItem>
                    {assignees.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('assigned_to')} />
              </FormField>

              <FormField
                label="Value"
                htmlFor="deal-value"
                error={errors.value?.message ?? serverErrors.value}
                required
              >
                <Input
                  inputMode="decimal"
                  placeholder="1500.00"
                  {...register('value')}
                  {...fieldA11y('deal-value', errors.value?.message)}
                />
              </FormField>

              <FormField
                label="Currency"
                htmlFor="deal-currency"
                error={errors.currency?.message ?? serverErrors.currency}
              >
                <Select
                  value={selectedCurrency}
                  onValueChange={(value) => setValue('currency', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="deal-currency" aria-label="Currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('currency')} />
              </FormField>

              <FormField
                label="Status"
                htmlFor="deal-status"
                error={errors.status?.message ?? serverErrors.status}
              >
                <Select
                  value={watch('status') || 'new'}
                  onValueChange={(value) => setValue('status', value, { shouldValidate: true })}
                >
                  <SelectTrigger id="deal-status" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEAL_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('status')} />
              </FormField>

              <FormField
                label="Expected close"
                htmlFor="deal-expected-close"
                error={errors.expected_close?.message ?? serverErrors.expected_close}
              >
                <Input
                  type="date"
                  {...register('expected_close')}
                  {...fieldA11y('deal-expected-close', errors.expected_close?.message)}
                />
              </FormField>
            </div>

            <FormField
              label="Description"
              htmlFor="deal-description"
              error={errors.description?.message ?? serverErrors.description}
            >
              <Textarea
                rows={3}
                placeholder="Scope, terms, and anything the team should know."
                {...register('description')}
                {...fieldA11y('deal-description', errors.description?.message)}
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {isEditing ? 'Save changes' : 'Create deal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
