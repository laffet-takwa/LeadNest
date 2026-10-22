/**
 * The deal detail page.
 *
 * The deal itself comes from `GET /deals/:id`. The related customer, tasks
 * and activities are loaded from their own endpoints, so a failure in one of
 * them does not hide the deal.
 */

import { CalendarPlus, Mail, Pencil, Phone, Target, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { ActivityTimeline } from '@/components/data-display/activity-timeline'
import { TaskCard } from '@/components/data-display/task-card'
import { DealStatusBadge } from '@/components/data-display/status-badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { DealFormDialog } from '@/features/deals/components/deal-form-dialog'
import { useDeal, useDeleteDeal, useUpdateDeal } from '@/features/deals/hooks/use-deals'
import { useCustomer } from '@/features/customers/hooks/use-customers'
import { useActivities } from '@/features/activities/hooks/use-activities'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import { useAssigneeOptions } from '@/features/companies/hooks/use-company'
import { DEAL_STATUSES } from '@/lib/constants/domain'
import { formatAmount } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import type { DealStatus } from '@/types/api'

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dealId = id ?? ''

  const { data: deal, isLoading, error, refetch } = useDeal(dealId)
  const { data: customer } = useCustomer(deal?.customer_id)
  const {
    data: tasks,
    error: tasksError,
    refetch: refetchTasks,
  } = useTasks({ deal_id: dealId, limit: 50, sort: 'due_date', order: 'asc' })
  const {
    data: activities,
    error: activitiesError,
    refetch: refetchActivities,
  } = useActivities({ deal_id: dealId, limit: 20 })
  const assignees = useAssigneeOptions()
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-2/3" />
            </CardBody>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !deal) {
    return (
      <ErrorState
        title="This deal could not be loaded"
        description={error?.message ?? 'The deal was not found.'}
        onRetry={() => void refetch()}
      />
    )
  }

  const assignee = assignees.find((member) => member.id === deal.assigned_to)
  const isClosed = deal.status === 'won' || deal.status === 'lost'
  const statusOption = DEAL_STATUSES.find((option) => option.value === deal.status)

  return (
    <>
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Sales pipeline', to: '/pipeline' }, { label: deal.title }]}
      />

      <PageHeader
        title={deal.title}
        description={statusOption?.description ?? 'A sales opportunity.'}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <DealStatusBadge status={deal.status} />
            <span className="tabular font-medium text-ink">
              {formatAmount(deal.value)} {deal.currency}
            </span>
            {isClosed ? (
              <span className="text-ink-muted">
                · closed {deal.closed_at ? formatDate(deal.closed_at) : ''}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
            <Button
              variant="danger-ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete deal"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Summary. */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-ink-muted">Value</dt>
                <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
                  {formatAmount(deal.value)}{' '}
                  <span className="text-sm font-normal text-ink-secondary">{deal.currency}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Status</dt>
                <dd className="mt-1">
                  <DealStatusBadge status={deal.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Expected close</dt>
                <dd className="mt-0.5 text-sm text-ink">
                  {deal.expected_close ? formatDate(deal.expected_close) : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Assigned to</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-ink">
                  {assignee ? (
                    <>
                      <Avatar name={assignee.full_name} size="xs" />
                      {assignee.full_name}
                    </>
                  ) : (
                    <span className="text-ink-secondary">Unassigned</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-ink-muted">Created</dt>
                <dd className="mt-0.5 text-sm text-ink-secondary">{formatDate(deal.created_at)}</dd>
              </div>
            </dl>

            <div>
              <p className="text-xs font-medium text-ink-muted">Move to</p>
              <div className="mt-1.5">
                <label className="sr-only" htmlFor="deal-status-control">
                  Move {deal.title} to another status
                </label>
                <select
                  id="deal-status-control"
                  value={deal.status}
                  disabled={updateDeal.isPending}
                  onChange={(event) =>
                    updateDeal.mutate({
                      id: deal.id,
                      payload: { status: event.target.value as DealStatus },
                    })
                  }
                  className="h-9 w-full rounded-input border border-input bg-surface px-2.5 text-sm text-ink transition-colors hover:border-ink-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30 disabled:opacity-60"
                >
                  {DEAL_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          {/* Description. */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardBody>
              {deal.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
                  {deal.description}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  No description yet. Add the scope and the terms so the team knows where this
                  stands.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Customer. */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardBody>
              {customer ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={customer.full_name} size="md" />
                    <div className="min-w-0">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="truncate font-medium text-ink hover:text-brand-text"
                      >
                        {customer.full_name}
                      </Link>
                      {customer.company ? (
                        <p className="truncate text-xs text-ink-secondary">{customer.company}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-secondary">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="inline-flex items-center gap-1.5 hover:text-brand-text"
                      >
                        <Mail className="size-3.5" aria-hidden="true" />
                        {customer.email}
                      </a>
                    ) : null}
                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone}`}
                        className="inline-flex items-center gap-1.5 hover:text-brand-text"
                      >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {customer.phone}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-muted">The customer could not be loaded.</p>
              )}
            </CardBody>
          </Card>

          {/* Related tasks. */}
          <Card>
            <CardHeader>
              <CardTitle>Related tasks</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigate(`/tasks?new=1&deal_id=${deal.id}`)
                }}
              >
                <CalendarPlus className="size-3.5" aria-hidden="true" />
                Add task
              </Button>
            </CardHeader>
            <CardBody className="p-0">
              {tasksError ? (
                <div className="p-4">
                  <ErrorState
                    title="The tasks could not be loaded"
                    description={tasksError.message}
                    onRetry={() => void refetchTasks()}
                  />
                </div>
              ) : (tasks?.data.length ?? 0) === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={Target}
                    title="No tasks for this deal"
                    description="Schedule a follow-up so the opportunity does not stall."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {tasks?.data.map((task) => (
                    <li key={task.id} className="px-4 py-3">
                      <TaskCard task={task} className="border-0 bg-transparent p-0 shadow-none" />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Related activity. */}
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {activitiesError ? (
                <div className="p-4">
                  <ErrorState
                    title="The activity could not be loaded"
                    description={activitiesError.message}
                    onRetry={() => void refetchActivities()}
                  />
                </div>
              ) : (activities?.data.length ?? 0) === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={UserRound}
                    title="No activity yet"
                    description="Calls, emails and meetings recorded against this deal will appear here."
                  />
                </div>
              ) : (
                <div className="px-4 py-4">
                  <ActivityTimeline
                    entries={
                      activities?.data.map((activity) => ({
                        id: activity.id,
                        type: activity.type,
                        subject: activity.subject,
                        description: activity.description,
                        occurred_at: activity.occurred_at,
                      })) ?? []
                    }
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <DealFormDialog open={editOpen} onOpenChange={setEditOpen} deal={deal} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this deal?"
        description={
          <>
            <strong className="font-medium text-ink">{deal.title}</strong> and its related tasks
            will be permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete deal"
        destructive
        onConfirm={() => {
          deleteDeal.mutate(deal.id, {
            onSuccess: () => {
              void navigate('/pipeline')
            },
            onSettled: () => setConfirmDelete(false),
          })
        }}
      />
    </>
  )
}
