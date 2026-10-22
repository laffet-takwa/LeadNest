/**
 * The task list.
 *
 * The views map onto the filters the backend supports, so "My tasks" and
 * "Overdue" are real queries rather than a client-side guess.
 */

import { ListTodo, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/page-header'
import { TaskCard } from '@/components/data-display/task-card'
import { Pagination } from '@/components/data-display/list-controls'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/overlays'
import { EmptyState, ErrorState } from '@/components/feedback/state'
import { TaskFormDialog } from '@/features/tasks/components/task-form-dialog'
import { useDeleteTask, useTasks, useUpdateTask } from '@/features/tasks/hooks/use-tasks'
import { useAssignees } from '@/features/companies/hooks/use-company'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants/domain'
import { isPast } from '@/lib/utils/date'
import type { Task, TaskListParams } from '@/types/api'

type TaskView = 'all' | 'mine' | 'pending' | 'completed' | 'overdue' | 'upcoming'

const VIEWS: { value: TaskView; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'My tasks' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
]

export function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { data: assigneeData } = useAssignees()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const view = (searchParams.get('view') as TaskView | null) ?? 'all'
  const limit = Number(searchParams.get('limit') ?? DEFAULT_PAGE_SIZE)
  const offset = Number(searchParams.get('offset') ?? 0)

  /**
   * The start of the "upcoming" window.
   *
   * It is captured once per view, so the query key stays stable: recomputing
   * it on every render would start a new request on every render. The state
   * is adjusted while rendering, which React applies immediately, so the list
   * is only requested once per view.
   */
  const [upcomingFrom, setUpcomingFrom] = useState(() => new Date().toISOString())
  const [lastView, setLastView] = useState(view)
  if (lastView !== view) {
    setLastView(view)
    setUpcomingFrom(new Date().toISOString())
  }

  const params: TaskListParams = { limit, offset, sort: 'due_date', order: 'asc' }
  if (view === 'mine' && user) params.assigned_to = user.id
  if (view === 'pending') params.status = 'pending'
  if (view === 'completed') params.status = 'completed'
  if (view === 'overdue') params.overdue = true
  if (view === 'upcoming') {
    params.status = 'pending'
    params.due_from = upcomingFrom
  }

  const { data, isLoading, error, refetch } = useTasks(params)
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

  const setView = (next: TaskView) => {
    setParam({ view: next === 'all' ? null : next })
  }

  /** Completes a task. The list is refreshed once the server confirms it. */
  const completeTask = (task: Task) => {
    updateTask.mutate({ id: task.id, payload: { status: 'completed' } })
  }

  return (
    <>
      <PageHeader
        title="Tasks"
        description="The follow-ups your team owes, and what is already done."
        meta={
          data ? (
            <span>
              {data.meta.total} task{data.meta.total === 1 ? '' : 's'}
            </span>
          ) : null
        }
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            icon={<Plus className="size-4" />}
          >
            New task
          </Button>
        }
      />

      <Tabs value={view} onValueChange={(next) => setView(next as TaskView)}>
        <TabsList aria-label="Task views" className="mb-4 flex flex-wrap">
          {VIEWS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={view} forceMount className="mt-0">
          {error ? (
            <ErrorState
              title="The tasks could not be loaded"
              description={error.message}
              onRetry={() => void refetch()}
            />
          ) : (data?.data.length ?? 0) === 0 && !isLoading ? (
            <div className="rounded-card border border-border bg-surface">
              <EmptyState
                icon={ListTodo}
                title={view === 'all' ? 'No tasks yet' : 'Nothing in this view'}
                description={
                  view === 'all'
                    ? 'Schedule the next follow-up so nothing slips through.'
                    : 'Switch to another view, or adjust the filters.'
                }
                action={
                  view === 'all' ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(null)
                        setFormOpen(true)
                      }}
                    >
                      Create a task
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="space-y-2" aria-busy={isLoading || undefined}>
              {isLoading
                ? Array.from({ length: 5 }, (_, index) => (
                    <li key={`skeleton-${index}`}>
                      <div className="skeleton h-[5.25rem] w-full" />
                    </li>
                  ))
                : data?.data.map((task) => {
                    const assignee = assignees.find((member) => member.id === task.assigned_to)
                    const overdue = task.status === 'pending' && isPast(task.due_date)
                    const completing =
                      updateTask.isPending && updateTask.variables?.id === task.id

                    return (
                      <li key={task.id} className="flex items-start gap-2">
                        <TaskCard
                          task={task}
                          assigneeName={assignee?.full_name}
                          isOverdue={overdue}
                          onComplete={() => completeTask(task)}
                          isCompleting={completing}
                          className="flex-1"
                        />
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(task)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-ink-muted hover:text-danger"
                            onClick={() => setDeleting(task)}
                            aria-label={`Delete ${task.title}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {data && data.meta.total > data.meta.limit ? (
        <Pagination
          className="mt-4"
          total={data.meta.total}
          limit={data.meta.limit}
          offset={data.meta.offset}
          onOffsetChange={(next) =>
            setParam({ offset: next === 0 ? null : String(next) })
          }
        />
      ) : null}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
            setParam({ new: null })
          }
        }}
        task={editing ?? undefined}
        defaultCustomerId={searchParams.get('customer_id') ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Delete this task?"
        description={
          <>
            <strong className="font-medium text-ink">{deleting?.title}</strong> will be permanently
            removed.
          </>
        }
        confirmLabel="Delete task"
        destructive
        onConfirm={() => {
          if (deleting) {
            deleteTask.mutate(deleting.id, {
              onSettled: () => setDeleting(null),
            })
          }
        }}
      />
    </>
  )
}
