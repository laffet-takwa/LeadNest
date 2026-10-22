/**
 * The dashboard.
 *
 * The panels are independent: a failure in one of them does not blank the
 * rest of the page, and each one can be retried on its own.
 */

import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleDollarSign,
  Handshake,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '@/components/layout/page-header'
import { StatCard } from '@/components/data-display/stat-card'
import { ActivityTimeline } from '@/components/data-display/activity-timeline'
import { PriorityBadge } from '@/components/data-display/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/ui/badge'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import {
  useDashboardOverview,
  useRecentActivities,
  useSalesPipeline,
  useUpcomingTasks,
} from '@/features/dashboard/hooks/use-dashboard'
import { useUpdateTask } from '@/features/tasks/hooks/use-tasks'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { DEAL_STATUSES, OPEN_DEAL_STATUSES } from '@/lib/constants/domain'
import { DEAL_STATUS_VISUAL, type StatusVisual } from '@/lib/constants/status-visual'
import { cn } from '@/lib/utils'
import { formatAmount, sumByCurrency } from '@/lib/utils/format'
import { useChartTokens } from '@/lib/utils/chart-theme'
import { describeDueDate } from '@/lib/utils/date'
import type { DealStatus, UpcomingTask } from '@/types/api'

/**
 * The pipeline chart colours.
 *
 * They come from the shared status mapping, so a bar and the badge of the
 * same status always agree and follow the active theme.
 */
const STATUS_FILLS: Record<DealStatus, string> = Object.fromEntries(
  (Object.entries(DEAL_STATUS_VISUAL) as [DealStatus, StatusVisual][]).map(
    ([status, visual]) => [status, visual.fill],
  ),
) as Record<DealStatus, string>

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const chart = useChartTokens()
  const updateTask = useUpdateTask()

  const overview = useDashboardOverview()
  const pipelineQuery = useSalesPipeline()
  const activitiesQuery = useRecentActivities(8)
  const tasksQuery = useUpcomingTasks(6)

  const metrics = overview.data?.metrics
  const pipeline = useMemo(
    () => buildPipelineData(pipelineQuery.data ?? []),
    [pipelineQuery.data],
  )

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.full_name.split(' ')[0] ?? 'there'}`}
        description="Here is how your pipeline and follow-ups look today."
        actions={
          <Button
            onClick={() => {
              void navigate('/customers?new=1')
            }}
            icon={<UserPlus className="size-4" />}
          >
            Add customer
          </Button>
        }
      />

      {overview.error ? (
        <ErrorState
          title="The metrics could not be loaded"
          description={overview.error.message}
          onRetry={() => void overview.refetch()}
          className="mb-6"
        />
      ) : null}

      {/* Key metrics. */}
      <section aria-label="Key metrics" className="mb-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Total customers"
            value={metrics ? metrics.total_customers : '—'}
            icon={Users}
            tone="brand"
            tooltip="Every customer in your company"
          />
          <StatCard
            label="Open deals"
            value={metrics ? metrics.open_deals : '—'}
            icon={Handshake}
            tone="violet"
            tooltip="Deals that are neither won nor lost"
          />
          <StatCard
            label="Won revenue"
            value={metrics ? `${formatAmount(metrics.won_revenue_tnd)} TND` : '—'}
            icon={CircleDollarSign}
            tone="success"
            tooltip="Revenue from won deals, counted in TND only"
          />
          <StatCard
            label="Overdue tasks"
            value={metrics ? metrics.overdue_tasks : '—'}
            icon={TriangleAlert}
            tone={metrics && metrics.overdue_tasks > 0 ? 'danger' : 'neutral'}
            hint={metrics && metrics.overdue_tasks > 0 ? 'Needs attention' : 'All caught up'}
            tooltip="Pending tasks whose due date has passed"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Won deals" value={metrics ? metrics.won_deals : '—'} icon={BadgeCheck} tone="success" />
          <StatCard
            label="Lost deals"
            value={metrics ? metrics.lost_deals : '—'}
            icon={TrendingDown}
            tone="neutral"
          />
          <StatCard
            label="Pending tasks"
            value={metrics ? metrics.pending_tasks : '—'}
            icon={CalendarClock}
            tone="teal"
          />
          <StatCard
            label="Open pipeline value"
            value={pipelineOpenValue(pipelineQuery.data ?? [])}
            icon={TrendingUp}
            tone="violet"
            tooltip="Total value of open deals, grouped by currency"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Pipeline. */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales pipeline</CardTitle>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Deal count by status. Amounts in different currencies are kept separate.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate('/pipeline')
              }}
            >
              Open pipeline
            </Button>
          </CardHeader>
          <CardBody>
            {pipelineQuery.isLoading ? (
              <div className="flex h-64 items-end gap-3">
                {DEAL_STATUSES.map((status) => (
                  <Skeleton key={status.value} className="h-full flex-1" />
                ))}
              </div>
            ) : pipelineQuery.error ? (
              <ErrorState
                title="The pipeline could not be loaded"
                description={pipelineQuery.error.message}
                onRetry={() => void pipelineQuery.refetch()}
                className="border-0"
              />
            ) : pipeline.length === 0 ? (
              <EmptyState
                icon={Handshake}
                title="No deals yet"
                description="Create your first opportunity to see the pipeline take shape."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      void navigate('/pipeline?new=1')
                    }}
                  >
                    Create a deal
                  </Button>
                }
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: chart.axis }}
                      axisLine={{ stroke: chart.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: chart.axis }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      cursor={{ fill: chart.cursor }}
                      contentStyle={{
                        borderRadius: 12,
                        border: `1px solid ${chart.border}`,
                        fontSize: 12,
                        backgroundColor: chart.surface,
                        color: chart.foreground,
                        boxShadow: chart.shadow,
                      }}
                      formatter={(value: number, _name, entry) => [
                        `${value} deal${value === 1 ? '' : 's'}`,
                        (entry?.payload as { valueLabel?: string } | undefined)?.valueLabel ?? '',
                      ]}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                      {pipeline.map((entry) => (
                        <Cell key={entry.status} className={STATUS_FILLS[entry.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Upcoming tasks. */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming tasks</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigate('/tasks')
              }}
            >
              All tasks
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {tasksQuery.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12" />
                ))}
              </div>
            ) : tasksQuery.error ? (
              <div className="p-4">
                <ErrorState
                  title="The tasks could not be loaded"
                  description={tasksQuery.error.message}
                  onRetry={() => void tasksQuery.refetch()}
                  className="border-0"
                />
              </div>
            ) : (tasksQuery.data?.length ?? 0) === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={CalendarClock}
                  title="Nothing due"
                  description="You have no pending tasks. Schedule the next follow-up."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        void navigate('/tasks?new=1')
                      }}
                    >
                      Create a task
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tasksQuery.data?.slice(0, 6).map((task) => (
                  <UpcomingTaskRow
                    key={task.id}
                    task={task}
                    isCompleting={
                      updateTask.isPending && updateTask.variables?.id === task.id
                    }
                    onComplete={() =>
                      updateTask.mutate({ id: task.id, payload: { status: 'completed' } })
                    }
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent activity. */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigate('/activities')
            }}
          >
            All activity
          </Button>
        </CardHeader>
        <CardBody className="p-0">
          {activitiesQuery.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10" />
              ))}
            </div>
          ) : activitiesQuery.error ? (
            <div className="p-4">
              <ErrorState
                title="The activity feed could not be loaded"
                description={activitiesQuery.error.message}
                onRetry={() => void activitiesQuery.refetch()}
                className="border-0"
              />
            </div>
          ) : (activitiesQuery.data?.length ?? 0) === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={CalendarClock}
                title="No activity yet"
                description="Calls, emails and meetings recorded against your customers will appear here."
              />
            </div>
          ) : (
            <div className="px-4 py-4">
              <ActivityTimeline
                showCustomer
                entries={(activitiesQuery.data ?? []).map((activity) => ({
                  id: activity.id,
                  type: activity.type,
                  subject: activity.subject,
                  description: activity.description,
                  occurred_at: activity.occurred_at,
                  customer_id: activity.customer_id,
                  customer_name: activity.customer_name,
                  user_name: activity.user_name,
                }))}
              />
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}

function UpcomingTaskRow({
  task,
  onComplete,
  isCompleting,
}: {
  task: UpcomingTask
  onComplete: () => void
  isCompleting: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted">
      <button
        type="button"
        onClick={onComplete}
        disabled={isCompleting}
        aria-label={`Mark ${task.title} as completed`}
        className={cn(
          'flex size-[1.125rem] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
          'disabled:cursor-not-allowed disabled:opacity-60',
          task.overdue ? 'border-warning hover:border-brand-600' : 'border-input hover:border-brand-600',
        )}
      >
        <Check className="size-3 text-transparent" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-secondary">
          {task.customer_name ? <span className="truncate">{task.customer_name}</span> : null}
          <span className={cn(task.overdue && 'font-medium text-danger')}>
            {describeDueDate(task.due_date)}
          </span>
        </p>
      </div>
      <PriorityBadge priority={task.priority} className="shrink-0" />
    </li>
  )
}

/** Builds the chart data: one bar per status that actually has deals. */
function buildPipelineData(
  buckets: { status: DealStatus; currency: string; count: number; value: string }[],
): { status: DealStatus; label: string; count: number; valueLabel: string }[] {
  const byStatus = new Map<DealStatus, { count: number; parts: string[] }>()
  for (const bucket of buckets) {
    const entry = byStatus.get(bucket.status) ?? { count: 0, parts: [] }
    entry.count += bucket.count
    entry.parts.push(`${formatAmount(bucket.value)} ${bucket.currency}`)
    byStatus.set(bucket.status, entry)
  }

  return DEAL_STATUSES.filter((status) => byStatus.has(status.value)).map((status) => {
    const entry = byStatus.get(status.value) ?? { count: 0, parts: [] }
    return {
      status: status.value,
      label: status.label,
      count: entry.count,
      valueLabel: entry.parts.join(' · '),
    }
  })
}

/**
 * Sums the value of the open deals, keeping each currency separate.
 *
 * The amounts are decimal strings, so they are added as decimals rather than
 * as floating-point numbers.
 */
function pipelineOpenValue(
  buckets: { status: DealStatus; currency: string; count: number; value: string }[],
): string {
  const open = buckets.filter((bucket) => OPEN_DEAL_STATUSES.includes(bucket.status))
  if (open.length === 0) return '—'
  return sumByCurrency(open.map((bucket) => ({ amount: bucket.value, currency: bucket.currency })))
    .map((money) => `${formatAmount(money.amount)} ${money.currency}`)
    .join(' · ')
}
