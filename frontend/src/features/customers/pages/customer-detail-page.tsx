/**
 * The customer detail page.
 *
 * The related records come from the backend's `include` parameter, so a
 * single request returns the profile, the deals and the activity timeline.
 */

import {
  Bot,
  Building2,
  CalendarPlus,
  Mail,
  Phone,
  Plus,
  StickyNote,
  Target,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { ActivityTimeline } from '@/components/data-display/activity-timeline'
import { DealStatusBadge } from '@/components/data-display/status-badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { CustomerFormDialog } from '@/features/customers/components/customer-form-dialog'
import { useCustomerDetails, useDeleteCustomer } from '@/features/customers/hooks/use-customers'
import { useAssignees } from '@/features/companies/hooks/use-company'
import { formatAmount } from '@/lib/utils/format'
import { formatDate, formatRelative } from '@/lib/utils/date'
import type { Activity, Deal } from '@/types/api'

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: assigneeData } = useAssignees()
  const { data, isLoading, error, refetch } = useCustomerDetails(id)
  const deleteCustomer = useDeleteCustomer()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardBody className="space-y-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-80" />
          </CardBody>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <ErrorState
        title="This customer could not be loaded"
        description={error?.message ?? 'The customer was not found.'}
        onRetry={() => void refetch()}
      />
    )
  }

  const customer = data
  const assignees = assigneeData?.data ?? []
  const assignee = assignees.find((member) => member.id === customer.assigned_to)
  const deals = (data as { deals?: Deal[] }).deals ?? []
  const activities = (data as { activities?: Activity[] }).activities ?? []

  return (
    <>
      <Breadcrumbs
        className="mb-4"
        items={[{ label: 'Customers', to: '/customers' }, { label: customer.full_name }]}
      />

      <PageHeader
        title={customer.full_name}
        description={customer.company ?? 'No company recorded'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button
              variant="danger-ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete customer"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Profile. */}
        <Card className="h-fit">
          <CardBody className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={customer.full_name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{customer.full_name}</p>
                {customer.source ? (
                  <p className="truncate text-xs capitalize text-ink-secondary">
                    {customer.source}
                  </p>
                ) : null}
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              {customer.email ? (
                <div className="flex items-start gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-brand-text underline-offset-2 hover:underline"
                      >
                        {customer.email}
                      </a>
                    </dd>
                  </div>
                </div>
              ) : null}

              {customer.phone ? (
                <div className="flex items-start gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="sr-only">Phone</dt>
                    <dd className="truncate">
                      <a
                        href={`tel:${customer.phone}`}
                        className="text-brand-text underline-offset-2 hover:underline"
                      >
                        {customer.phone}
                      </a>
                    </dd>
                  </div>
                </div>
              ) : null}

              {customer.company ? (
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="sr-only">Company</dt>
                    <dd className="truncate text-ink-secondary">{customer.company}</dd>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-2.5">
                <UserRound className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="sr-only">Assigned employee</dt>
                  <dd className="truncate text-ink-secondary">
                    {assignee ? assignee.full_name : 'Unassigned'}
                  </dd>
                </div>
              </div>
            </dl>

            {customer.notes ? (
              <div className="rounded-input bg-surface-sunken p-3">
                <p className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  <StickyNote className="size-3" aria-hidden="true" />
                  Notes
                </p>
                <p className="whitespace-pre-wrap text-sm text-ink-secondary">{customer.notes}</p>
              </div>
            ) : null}

            <p className="text-2xs text-ink-muted">
              Added {formatDate(customer.created_at)} · last updated{' '}
              {formatRelative(customer.updated_at)}
            </p>
          </CardBody>
        </Card>

        {/* Related records. */}
        <div>
          <Tabs defaultValue="deals">
            <TabsList>
              <TabsTrigger value="deals">
                <Target className="size-4" aria-hidden="true" />
                Deals
                <span className="ml-0.5 text-ink-muted">{deals.length}</span>
              </TabsTrigger>
              <TabsTrigger value="activities">
                <CalendarPlus className="size-4" aria-hidden="true" />
                Activity
                <span className="ml-0.5 text-ink-muted">{activities.length}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deals">
              <Card>
                <CardHeader>
                  <CardTitle>Deals</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void navigate(`/pipeline?new=1&customer_id=${customer.id}`)
                    }}
                    icon={<Plus className="size-3.5" />}
                  >
                    New deal
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  {deals.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={Target}
                        title="No deals yet"
                        description="Create an opportunity to start tracking this relationship commercially."
                        action={
                          <Button
                            size="sm"
                            onClick={() => {
                              void navigate(`/pipeline?new=1&customer_id=${customer.id}`)
                            }}
                          >
                            Create a deal
                          </Button>
                        }
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {deals.map((deal) => (
                        <li
                          key={deal.id}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{deal.title}</p>
                            <p className="mt-0.5 text-xs text-ink-secondary">
                              {formatAmount(deal.value)} {deal.currency}
                              {deal.expected_close
                                ? ` · closes ${formatDate(deal.expected_close)}`
                                : ''}
                            </p>
                          </div>
                          <DealStatusBadge status={deal.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </TabsContent>

            <TabsContent value="activities">
              <Card>
                <CardHeader>
                  <CardTitle>Activity timeline</CardTitle>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void navigate(`/activities?new=1&customer_id=${customer.id}`)
                    }}
                    icon={<Plus className="size-3.5" />}
                  >
                    Record activity
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  {activities.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={CalendarPlus}
                        title="No activity recorded"
                        description="Log calls, emails and meetings to build a history for this customer."
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-4">
                      <ActivityTimeline
                        entries={activities.map((activity) => ({
                          id: activity.id,
                          type: activity.type,
                          subject: activity.subject,
                          description: activity.description,
                          occurred_at: activity.occurred_at,
                        }))}
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigate(`/ai?customer_id=${customer.id}`)
              }}
              icon={<Bot className="size-3.5" />}
            >
              Summarise with AI
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigate(`/tasks?new=1&customer_id=${customer.id}`)
              }}
              icon={<CalendarPlus className="size-3.5" />}
            >
              Schedule a task
            </Button>
          </div>
        </div>
      </div>

      <CustomerFormDialog open={editOpen} onOpenChange={setEditOpen} customer={customer} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this customer?"
        description={
          <>
            <strong className="font-medium text-ink">{customer.full_name}</strong> and all of their
            deals, tasks and activities will be permanently removed.
          </>
        }
        confirmLabel="Delete customer"
        destructive
        onConfirm={() => {
          deleteCustomer.mutate(customer.id, {
            onSuccess: () => {
              void navigate('/customers', { replace: true })
            },
            onSettled: () => setConfirmDelete(false),
          })
        }}
      />
    </>
  )
}
