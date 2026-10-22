/**
 * The activity timeline.
 *
 * The list is server-paged and filtered, and the same timeline component is
 * used on the customer page, so an activity looks the same everywhere.
 */

import { CalendarPlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { ActivityTimeline } from '@/components/data-display/activity-timeline'
import { Combobox } from '@/components/ui/combobox'
import {
  DateRangeFilter,
  FilterBar,
  FilterSelect,
  Pagination,
} from '@/components/data-display/list-controls'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { ActivityFormDialog } from '@/features/activities/components/activity-form-dialog'
import { useActivities } from '@/features/activities/hooks/use-activities'
import { useCustomers } from '@/features/customers/hooks/use-customers'
import { useAssignees } from '@/features/companies/hooks/use-company'
import { ALL_OPTIONS, ACTIVITY_TYPES, DEFAULT_PAGE_SIZE } from '@/lib/constants/domain'
import type { ActivityType } from '@/types/api'

export function ActivitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: assigneeData } = useAssignees()
  const { data: customers } = useCustomers({ limit: 100, sort: 'full_name', order: 'asc' })
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')

  const limit = Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE)
  const offset = Number(searchParams.get('offset') ?? 0)

  const params = {
    limit,
    offset,
    type: (searchParams.get('type') as ActivityType | null) ?? undefined,
    customer_id: searchParams.get('customer_id') ?? undefined,
    user_id: searchParams.get('user_id') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  }

  const { data, isLoading, error, refetch } = useActivities(params)
  const assignees = assigneeData?.data ?? []

  const setParam = (updates: Record<string, string | null>) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        if (!('offset' in updates)) next.delete('offset')
        return next
      },
      { replace: true },
    )
  }

  const hasFilters = Boolean(params.type || params.customer_id || params.user_id || params.from || params.to)

  return (
    <>
      <PageHeader
        title="Activities"
        description="Every call, email, meeting and note your team has logged."
        meta={
          data ? (
            <span>
              {data.meta.total} activit{data.meta.total === 1 ? 'y' : 'ies'}
            </span>
          ) : null
        }
        actions={
          <Button
            onClick={() => {
              setFormOpen(true)
              setParam({ new: null })
            }}
            icon={<Plus className="size-4" />}
          >
            Record activity
          </Button>
        }
      />

      <div className="mb-4">
        <FilterBar>
          <div className="flex flex-wrap items-end gap-2">
            <FilterSelect
              label="Activity type"
              value={params.type ?? ''}
              onValueChange={(value) => setParam({ type: value === ALL_OPTIONS ? null : value })}
              options={ACTIVITY_TYPES.map((type) => ({ value: type.value, label: type.label }))}
              placeholder="Any type"
              emptyLabel="Any type"
            />
            <Combobox
              label="Customer"
              value={params.customer_id ?? ''}
              onValueChange={(value) => setParam({ customer_id: value || null })}
              options={(customers?.data ?? []).map((customer) => ({
                value: customer.id,
                label: customer.full_name,
                description: customer.company,
              }))}
              placeholder="Any customer"
              allowEmpty
              emptyLabel="Any customer"
              className="w-full sm:w-56"
            />
            <FilterSelect
              label="Team member"
              value={params.user_id ?? ''}
              onValueChange={(value) => setParam({ user_id: value === ALL_OPTIONS ? null : value })}
              options={assignees.map((member) => ({
                value: member.id,
                label: member.full_name,
              }))}
              placeholder="Anyone"
              emptyLabel="Anyone"
            />
            <DateRangeFilter
              from={params.from ?? ''}
              to={params.to ?? ''}
              onChange={(next) => setParam({ from: next.from || null, to: next.to || null })}
            />
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParam({ type: null, customer_id: null, user_id: null, from: null, to: null })}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </FilterBar>
      </div>

      {error ? (
        <ErrorState
          title="The activities could not be loaded"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-4" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-14" />
              ))}
            </div>
          ) : (data?.data.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarPlus}
                title={hasFilters ? 'No matching activities' : 'No activity recorded'}
                description={
                  hasFilters
                    ? 'No activity matches the current filters. Try widening the date range.'
                    : 'Log calls, emails and meetings to build a history for every customer.'
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setParam({
                          type: null,
                          customer_id: null,
                          user_id: null,
                          from: null,
                          to: null,
                        })
                      }
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setFormOpen(true)}>
                      Record the first activity
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <div className="px-4 py-4">
              <ActivityTimeline
                showCustomer
                linkCustomer
                entries={(data?.data ?? []).map((activity) => ({
                  id: activity.id,
                  type: activity.type,
                  subject: activity.subject,
                  description: activity.description,
                  occurred_at: activity.occurred_at,
                  customer_id: activity.customer_id,
                  user_id: activity.user_id,
                  user_name: assignees.find((member) => member.id === activity.user_id)?.full_name,
                }))}
              />
            </div>
          )}
        </Card>
      )}

      {data && data.meta.total > data.meta.limit ? (
        <Pagination
          className="mt-4"
          total={data.meta.total}
          limit={data.meta.limit}
          offset={data.meta.offset}
          onOffsetChange={(next) => setParam({ offset: next === 0 ? null : String(next) })}
        />
      ) : null}

      <ActivityFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setParam({ new: null })
        }}
        defaultCustomerId={searchParams.get('customer_id') ?? undefined}
      />
    </>
  )
}
