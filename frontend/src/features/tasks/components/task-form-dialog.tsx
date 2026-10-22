/**
 * The task form dialog.
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
import { useCreateTask, useUpdateTask } from '@/features/tasks/hooks/use-tasks'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useDeals } from '@/features/deals/hooks/use-deals'
import { useAssigneeOptions } from '@/features/companies/hooks/use-company'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { taskSchema, type TaskFormValues } from '@/features/tasks/schemas/task.schemas'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants/domain'
import { ApiError } from '@/lib/api/client'
import { toInputDateTime } from '@/lib/utils/date'
import type { Task } from '@/types/api'

const EMPTY: TaskFormValues = {
  title: '',
  description: '',
  assigned_to: '',
  customer_id: '',
  deal_id: '',
  priority: 'medium',
  status: 'pending',
  due_date: '',
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultCustomerId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
  defaultCustomerId?: string
  onSaved?: (task: Task) => void
}) {
  const isEditing = Boolean(task)
  const { user } = useAuth()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const assignees = useAssigneeOptions()
  const { data: customers } = useCustomers({ limit: 100, sort: 'full_name', order: 'asc' })
  const { data: deals } = useDeals({ limit: 100 })
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})

  const defaultValues = useMemo<TaskFormValues>(
    () =>
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assigned_to: task.assigned_to,
            customer_id: task.customer_id ?? '',
            deal_id: task.deal_id ?? '',
            priority: task.priority,
            status: task.status,
            due_date: toInputDateTime(task.due_date),
          }
        : { ...EMPTY, customer_id: defaultCustomerId ?? '', assigned_to: user?.id ?? '' },
    [task, defaultCustomerId, user?.id],
  )

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
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
    const payload = {
      assigned_to: values.assigned_to,
      customer_id: values.customer_id || undefined,
      deal_id: values.deal_id || undefined,
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      // The API expects a timestamp; a date-only value becomes midnight UTC
      // so the due date is not shifted by the browser's time zone.
      due_date: values.due_date ? new Date(values.due_date).toISOString() : undefined,
    }

    try {
      const saved = task
        ? await updateTask.mutateAsync({ id: task.id, payload })
        : await createTask.mutateAsync(payload)
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.fieldErrors
        setServerErrors(fieldErrors)
        for (const [field, message] of Object.entries(fieldErrors)) {
          setError(field as keyof TaskFormValues, { type: 'server', message })
        }
      }
    }
  })

  const busy = isSubmitting || createTask.isPending || updateTask.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the follow-up.'
              : 'Schedule a follow-up for a customer, a deal, or the team in general.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => { void onSubmit(event) }} noValidate>
          <DialogBody className="space-y-4">
            <FormField label="Title" htmlFor="task-title" error={errors.title?.message} required>
              <Input
                autoFocus
                placeholder="Call about the renewal"
                {...register('title')}
                {...fieldA11y('task-title', errors.title?.message)}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Assigned to"
                htmlFor="task-assigned"
                error={errors.assigned_to?.message ?? serverErrors.assigned_to}
                required
              >
                <Select
                  value={watch('assigned_to') || undefined}
                  onValueChange={(value) =>
                    setValue('assigned_to', value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="task-assigned" aria-label="Assignee">
                    <SelectValue placeholder="Choose an assignee" />
                  </SelectTrigger>
                  <SelectContent>
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
                label="Due date"
                htmlFor="task-due"
                error={errors.due_date?.message ?? serverErrors.due_date}
              >
                <Input
                  type="datetime-local"
                  {...register('due_date')}
                  {...fieldA11y('task-due', errors.due_date?.message)}
                />
              </FormField>

              <FormField
                label="Priority"
                htmlFor="task-priority"
                error={errors.priority?.message ?? serverErrors.priority}
              >
                <Select
                  value={watch('priority')}
                  onValueChange={(value) =>
                    setValue('priority', value as TaskFormValues['priority'])
                  }
                >
                  <SelectTrigger id="task-priority" aria-label="Priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('priority')} />
              </FormField>

              <FormField
                label="Status"
                htmlFor="task-status"
                error={errors.status?.message ?? serverErrors.status}
              >
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value as TaskFormValues['status'])}
                >
                  <SelectTrigger id="task-status" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" {...register('status')} />
              </FormField>

              <FormField
                label="Customer"
                htmlFor="task-customer"
                error={errors.customer_id?.message ?? serverErrors.customer_id}
              >
                <Select
                  value={selectedCustomerId || undefined}
                  onValueChange={(value) => setValue('customer_id', value)}
                >
                  <SelectTrigger id="task-customer" aria-label="Customer">
                    <SelectValue placeholder="Optional" />
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
                label="Deal"
                htmlFor="task-deal"
                error={errors.deal_id?.message ?? serverErrors.deal_id}
              >
                <Select
                  value={watch('deal_id') || undefined}
                  onValueChange={(value) => setValue('deal_id', value)}
                >
                  <SelectTrigger id="task-deal" aria-label="Deal">
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
            </div>

            <FormField
              label="Description"
              htmlFor="task-description"
              error={errors.description?.message ?? serverErrors.description}
            >
              <Textarea
                rows={3}
                placeholder="What needs to happen, and what to prepare."
                {...register('description')}
                {...fieldA11y('task-description', errors.description?.message)}
              />
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {isEditing ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
