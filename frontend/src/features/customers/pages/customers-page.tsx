/**
 * The customer list.
 *
 * The table is server-paged, searched and filtered, so the page never
 * downloads the whole customer base.
 */

import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { Plus, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react'

import { PageHeader } from '@/components/layout/page-header'
import { DataTable, type DataTableColumn } from '@/components/data-display/data-table'
import { CustomerAvatar } from '@/components/data-display/customer-avatar'
import {
  FilterBar,
  FilterSelect,
  PageSizeSelect,
  Pagination,
  SearchInput,
} from '@/components/data-display/list-controls'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { CustomerFormDialog } from '@/features/customers/components/customer-form-dialog'
import { useCustomers, useDeleteCustomer } from '@/features/customers/hooks/use-customers'
import { useAssignees } from '@/features/companies/hooks/use-company'
import { ALL_OPTIONS, CUSTOMER_SOURCES, DEFAULT_PAGE_SIZE } from '@/lib/constants/domain'
import { nextSortState } from '@/lib/utils/sort'
import { formatDate } from '@/lib/utils/date'
import type { Customer, CustomerListParams } from '@/types/api'

const SORTABLE_COLUMNS = ['full_name', 'company', 'email', 'source', 'created_at'] as const

export function CustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: assigneeData } = useAssignees()
  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState<Customer | null>(null)
  const deleteCustomer = useDeleteCustomer()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const assignees = assigneeData?.data ?? []

  const params: CustomerListParams = {
    limit: Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE),
    offset: Number(searchParams.get('offset') ?? 0),
    search: searchParams.get('search') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    assigned_to: searchParams.get('assigned_to') ?? undefined,
    sort: (searchParams.get('sort') as CustomerListParams['sort']) ?? undefined,
    order: (searchParams.get('order') as CustomerListParams['order']) ?? undefined,
  }

  const { data, isLoading, error, refetch, isPlaceholderData } = useCustomers(params)

  /**
   * Writes one or more filters back to the URL, so the view is shareable.
   *
   * All the changes are applied in a single update: two separate calls would
   * each read the same stale query string and the second would undo the first.
   */
  const setParams = (updates: Record<string, string | null>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') {
          next.delete(key)
        } else {
          next.set(key, value)
        }
      }
      if (!('offset' in updates)) next.delete('offset')
      return next
    }, { replace: true })
  }

  /** Writes a single filter back to the URL. */
  const setParam = (key: string, value: string | null) => setParams({ [key]: value })

  const hasFilters = Boolean(params.search || params.source || params.assigned_to)

  const columns: DataTableColumn<Customer>[] = [
    {
      key: 'full_name',
      header: 'Customer',
      primary: true,
      cell: (row) => (
        <CustomerAvatar
          name={row.full_name}
          company={row.company}
          size="sm"
          withDetails
        />
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => (row.email ? <span className="truncate">{row.email}</span> : '—'),
      hideBelow: 'md',
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => row.phone ?? '—',
      hideBelow: 'lg',
    },
    {
      key: 'source',
      header: 'Source',
      cell: (row) => (row.source ? <span className="capitalize">{row.source}</span> : '—'),
      hideBelow: 'xl',
    },
    {
      key: 'assigned_to',
      header: 'Assigned to',
      cell: (row) => {
        const member = assignees.find((candidate) => candidate.id === row.assigned_to)
        return member ? (
          <span className="flex items-center gap-1.5">
            <CustomerAvatar name={member.full_name} size="xs" />
            <span className="truncate">{member.full_name}</span>
          </span>
        ) : (
          '—'
        )
      },
      hideBelow: 'lg',
    },
    {
      key: 'created_at',
      header: 'Added',
      cell: (row) => formatDate(row.created_at),
      hideBelow: 'xl',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setEditing(row)
            }}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-ink-muted hover:text-danger"
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(row)
            }}
            aria-label={`Delete ${row.full_name}`}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone your company is working with, and the deals attached to them."
        meta={
          data ? (
            <span>
              {data.meta.total} customer{data.meta.total === 1 ? '' : 's'}
              {isPlaceholderData ? ' · updating…' : ''}
            </span>
          ) : null
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
              setParam('new', null)
            }}
            icon={<Plus className="size-4" />}
          >
            Add customer
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <FilterBar>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            onDebouncedChange={(value) => setParam('search', value || null)}
            placeholder="Search by name, company, email or phone…"
            className="w-full sm:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Source"
              value={params.source ?? ''}
              onValueChange={(value) => setParam('source', value === ALL_OPTIONS ? null : value)}
              options={CUSTOMER_SOURCES.map((source) => ({ value: source, label: source }))}
              placeholder="Any source"
              emptyLabel="Any source"
            />
            <FilterSelect
              label="Assigned employee"
              value={params.assigned_to ?? ''}
              onValueChange={(value) =>
                setParam('assigned_to', value === ALL_OPTIONS ? null : value)
              }
              options={assignees.map((member) => ({
                value: member.id,
                label: member.full_name,
              }))}
              placeholder="Anyone"
              emptyLabel="Anyone"
            />
            {hasFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setSearchParams(new URLSearchParams(), { replace: true })
                }}
                icon={<X className="size-3.5" />}
              >
                Clear filters
              </Button>
            ) : null}
            <PageSizeSelect
              value={params.limit ?? DEFAULT_PAGE_SIZE}
              onValueChange={(value) => setParam('limit', String(value))}
            />
          </div>
        </FilterBar>
      </div>

      {error ? (
        <ErrorState
          title="The customers could not be loaded"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          sortKey={params.sort}
          sortDirection={params.order ?? 'desc'}
          sortableColumns={SORTABLE_COLUMNS}
          onSortChange={(key) => {
            // Ascending, then descending, then back to the server default.
            const next = nextSortState(
              { sort: params.sort ?? null, order: params.order ?? null },
              key,
            )
            setParams({ sort: next.sort, order: next.order })
          }}
          emptyState={
            <EmptyState
              icon={hasFilters ? SlidersHorizontal : UserRound}
              title={hasFilters ? 'No matching customers' : 'No customers yet'}
              description={
                hasFilters
                  ? 'No customer matches the current filters. Try widening your search.'
                  : 'Add your first customer to start tracking relationships, deals and follow-ups.'
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setSearchParams(new URLSearchParams(), { replace: true })
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    Add your first customer
                  </Button>
                )
              }
            />
          }
        />
      )}

      {data && data.meta.total > 0 ? (
        <Pagination
          className="mt-4"
          total={data.meta.total}
          limit={data.meta.limit}
          offset={data.meta.offset}
          onOffsetChange={(offset) => setParam('offset', offset === 0 ? null : String(offset))}
        />
      ) : null}

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setParam('new', null)
        }}
        customer={editing ?? undefined}
        onSaved={() => {
          setEditing(null)
          setFormOpen(false)
          setParam('new', null)
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this customer?"
        description={
          <>
            <strong className="font-medium text-ink">{deleting?.full_name}</strong> and all of their
            deals, tasks and activities will be permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete customer"
        destructive
        onConfirm={() => {
          if (deleting) {
            deleteCustomer.mutate(deleting.id, {
              onSettled: () => setDeleting(null),
            })
          }
        }}
      />
    </>
  )
}
