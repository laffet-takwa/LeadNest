/**
 * The activity form dialog.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateActivity } from '@/features/activities/hooks/use-activities'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useDeals } from '@/features/deals/hooks/use-deals'
import {
  activitySchema,
  type ActivityFormValues,
} from '@/features/activities/schemas/activity.schemas'
import { ACTIVITY_TYPES } from '@/lib/constants/domain'
import { ApiError } from '@/lib/api/client'
import type { Activity } from '@/types/api'

const EMPTY: ActivityFormValues = {
  customer_id: '',
  deal_id: '',
  type: 'note',
  subject: '',
  description: '',
  occurred_at: '',
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  defaultCustomerId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCustomerId?: string
  onSaved?: (activity: Activity) => void
}) {
  const createActivity = useCreateActivity()
  const { data: customers } = useCustomers({ limit: 100, sort: 'full_name', order: 'asc' })
  const { data: deals } = useDeals({ limit: 100 })
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const defaultValues = useMemo<ActivityFormValues>(
    () => ({ ...EMPTY, customer_id: defaultCustomerId ?? '' }),
    [defaultCustomerId],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues,
  })

  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setServerErrors({})
    }
  }, [open, defaultValues, reset])

  const selectedCustomerId = watch('customer_id')
  const customerDeals = (deals?.data ?? []).filter(
    (deal) => !selectedCustomerId || deal.customer_id === selectedCustomerId,
  )

  const onSubmit = handleSubmit(async (values) => {
    setServerErrors({})
    try {
      const saved = await createActivity.mutateAsync({
        customerId: values.customer_id,
        payload: {
          customer_id: values.customer_id,
          deal_id: values.deal_id || undefined,
          type: values.type,
          subject: values.subject || undefined,
          description: values.description || undefined,
          occurred_at: values.occurred_at ? new Date(values.occurred_at).toISOString() : undefined,
        },
      })
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        setServerErrors(fieldErrors)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof ActivityFormValues, { type: 'server', message })
        }
      }
    }
  })

  const busy = isSubmitting || createActivity.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record activity</DialogTitle>
          <DialogDescription>
            Log a call, an email, a meeting or a note against a customer.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            void onSubmit(event)
          }}
          noValidate
        >
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Customer"
                htmlFor="activity-customer"
                error={errors.customer_id?.message ?? serverErrors.customer_id}
                required
              >
                <Select
                  value={selectedCustomerId || undefined}
                  onValueChange={(value) =>
                    setValue('customer_id', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="activity-customer" aria-label="Customer">
                    <SelectValue placeholder="Choose a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.data.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('customer_id')} />
              </FormField>

              <FormField
                label="Type"
                htmlFor="activity-type"
                error={errors.type?.message ?? serverErrors.type}
                required
              >
                <Select
                  value={watch('type')}
                  onValueChange={(value) => setValue('type', value as ActivityFormValues['type'])}
                >
                  <SelectTrigger id="activity-type" aria-label="Activity type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('type')} />
              </FormField>

              <FormField
                label="Deal"
                htmlFor="activity-deal"
                error={errors.deal_id?.message ?? serverErrors.deal_id}
              >
                <Select
                  value={watch('deal_id') || undefined}
                  onValueChange={(value) => setValue('deal_id', value)}
                >
                  <SelectTrigger id="activity-deal" aria-label="Deal">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerDeals.map((deal) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('deal_id')} />
              </FormField>

              <FormField
                label="When"
                htmlFor="activity-occurred-at"
                error={errors.occurred_at?.message ?? serverErrors.occurred_at}
                hint="Defaults to now"
              >
                <Input
                  type="datetime-local"
                  {...register('occurred_at')}
                  {...fieldA11y('activity-occurred-at', errors.occurred_at?.message)}
                />
              </FormField>
            </div>

            <FormField
              label="Subject"
              htmlFor="activity-subject"
              error={errors.subject?.message ?? serverErrors.subject}
            >
              <Input
                autoFocus
                placeholder="Discussed the renewal"
                {...register('subject')}
                {...fieldA11y('activity-subject', errors.subject?.message)}
              />
            </FormField>

            <FormField
              label="Details"
              htmlFor="activity-description"
              error={errors.description?.message ?? serverErrors.description}
            >
              <Textarea
                rows={4}
                placeholder="What was discussed, and what happens next."
                {...register('description')}
                {...fieldA11y('activity-description', errors.description?.message)}
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Record activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
