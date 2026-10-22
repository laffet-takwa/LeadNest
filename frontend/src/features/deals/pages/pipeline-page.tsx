/**
 * The sales pipeline board.
 *
 * A deal is moved between columns with an explicit status control, so the
 * board is fully usable with a keyboard. The status change is only applied
 * locally after the server confirms it.
 */

import { LayoutList, Plus, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { DealCard } from '@/components/data-display/deal-card'
import { DealStatusBadge } from '@/components/data-display/status-badge'
import { Pagination, SearchInput } from '@/components/data-display/list-controls'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { DealFormDialog } from '@/features/deals/components/deal-form-dialog'
import { useDeals, useDeleteDeal, useUpdateDeal } from '@/features/deals/hooks/use-deals'
import { useAssigneeOptions } from '@/features/companies/hooks/use-company'
import { DEAL_STATUSES, DEFAULT_PAGE_SIZE } from '@/lib/constants/domain'
import { formatAmount } from '@/lib/utils/format'
import { formatDate } from '@/lib/utils/date'
import type { DealStatus, DealWithCustomer } from '@/types/api'

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const assignees = useAssigneeOptions()
  const updateDeal = useUpdateDeal({ successMessage: null })
  const deleteDeal = useDeleteDeal()

  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<DealWithCustomer | null>(null)
  const [deleting, setDeleting] = useState<DealWithCustomer | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')

  const limit = Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE)
  const offset = Number(searchParams.get('offset') ?? 0)

  const params = {
    limit,
    offset,
    search: searchParams.get('search') ?? undefined,
  }

  const { data, isLoading, error, refetch } = useDeals(params)
  const rows = useMemo(() => data?.data ?? [], [data?.data])

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

  const byStatus = useMemo(() => {
    const groups = new Map<DealStatus, DealWithCustomer[]>()
    for (const status of DEAL_STATUSES) groups.set(status.value, [])
    for (const deal of rows) {
      groups.get(deal.status)?.push(deal)
    }
    return groups
  }, [rows])

  /**
   * Moves a deal to a new status.
   *
   * The card is only moved once the server has accepted the change, so the
   * board never shows a status the backend did not confirm. A rejected change
   * leaves the card where it was and reports the error.
   */
  const moveDeal = (deal: DealWithCustomer, status: DealStatus) => {
    if (deal.status === status) return
    updateDeal.mutate({ id: deal.id, payload: { status } })
  }

  return (
    <>
      <PageHeader
        title="Sales pipeline"
        description="Every open opportunity, and what has been won or lost."
        meta={
          data ? (
            <span>
              {data.meta.total} deal{data.meta.total === 1 ? '' : 's'}
            </span>
          ) : null
        }
        actions={
          <>
            <div className="hidden items-center rounded-input border border-border bg-surface-sunken p-0.5 sm:flex">
              <Button
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('board')}
                aria-pressed={view === 'board'}
              >
                <Target className="size-3.5" aria-hidden="true" />
                Board
              </Button>
              <Button
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
              >
                <LayoutList className="size-3.5" aria-hidden="true" />
                List
              </Button>
            </div>
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              icon={<Plus className="size-4" />}
            >
              New deal
            </Button>
          </>
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput
          value={search}
          onValueChange={setSearch}
          onDebouncedChange={(value) => setParam({ search: value || null })}
          placeholder="Search deals or customers…"
        />
      </div>

      {error ? (
        <ErrorState
          title="The pipeline could not be loaded"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : view === 'board' ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          <div className="flex min-w-max gap-3">
            {DEAL_STATUSES.map((status) => {
              const deals = byStatus.get(status.value) ?? []
              return (
                <section
                  key={status.value}
                  aria-label={`${status.label} deals`}
                  className="flex w-[17rem] shrink-0 flex-col rounded-panel border border-border bg-surface-sunken/60"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                    <h3 className="text-xs font-semibold text-ink">{status.label}</h3>
                    <span className="tabular rounded-full bg-surface px-1.5 py-0.5 text-2xs font-medium text-ink-secondary">
                      {deals.length}
                    </span>
                  </header>
                  <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                    {isLoading ? (
                      Array.from({ length: 2 }, (_, index) => (
                        <div key={index} className="skeleton h-32 w-full" />
                      ))
                    ) : deals.length === 0 ? (
                      <p className="px-2 py-6 text-center text-2xs text-ink-muted">
                        No deals here yet
                      </p>
                    ) : (
                      deals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          assigneeName={assignees.find((m) => m.id === deal.assigned_to)?.full_name}
                          onEdit={() => {
                            setEditing(deal)
                            setFormOpen(true)
                          }}
                          onDelete={() => setDeleting(deal)}
                          onMove={(nextStatus) => moveDeal(deal, nextStatus)}
                          isUpdating={updateDeal.isPending && updateDeal.variables?.id === deal.id}
                        />
                      ))
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 p-4" aria-busy="true">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="skeleton h-12" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Target}
                title="No deals yet"
                description="Create an opportunity to see it move through the pipeline."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    Create a deal
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((deal) => (
                <li
                  key={deal.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted"
                >
                  <Link to={`/deals/${deal.id}`} className="min-w-0 flex-1 rounded-control">
                    <p className="truncate text-sm font-medium text-ink hover:text-brand-text">
                      {deal.title}
                    </p>
                    <p className="truncate text-xs text-ink-secondary">
                      {deal.customer_name ?? 'No customer'} · {formatAmount(deal.value)}{' '}
                      {deal.currency}
                    </p>
                  </Link>
                  {deal.expected_close ? (
                    <span className="text-xs text-ink-muted">
                      closes {formatDate(deal.expected_close)}
                    </span>
                  ) : null}
                  <DealStatusBadge status={deal.status} />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-ink-muted hover:text-danger"
                    onClick={() => setDeleting(deal)}
                    aria-label={`Delete ${deal.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
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

      <DealFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
            setParam({ new: null })
          }
        }}
        deal={editing ?? undefined}
        defaultCustomerId={searchParams.get('customer_id') ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this deal?"
        description={
          <>
            <strong className="font-medium text-ink">{deleting?.title}</strong> and its related
            tasks will be permanently removed. This cannot be undone.
          </>
        }
        confirmLabel="Delete deal"
        destructive
        onConfirm={() => {
          if (deleting) {
            deleteDeal.mutate(deleting.id, {
              onSettled: () => setDeleting(null),
            })
          }
        }}
      />
    </>
  )
}
