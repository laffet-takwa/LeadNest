/**
 * TaskCard.
 *
 * A single follow-up task. It is used by the task list and by the compact
 * task panels on the dashboard and the customer detail page.
 */

import { Check } from 'lucide-react'

import { PriorityBadge, TaskStatusBadge } from '@/components/data-display/status-badge'
import { cn } from '@/lib/utils'
import { describeDueDate } from '@/lib/utils/date'
import type { Task } from '@/types/api'

export interface TaskCardProps {
  task: Task
  /** Name of the customer the task belongs to. */
  customerName?: string
  /** Title of the deal the task belongs to. */
  dealTitle?: string
  /** Name of the assignee. */
  assigneeName?: string
  /** True when the task is pending and its due date has passed. */
  isOverdue?: boolean
  /** Renders the quick "mark as done" control. */
  onComplete?: () => void
  /** True while the completion request is in flight. */
  isCompleting?: boolean
  className?: string
}

export function TaskCard({
  task,
  customerName,
  dealTitle,
  assigneeName,
  isOverdue = false,
  onComplete,
  isCompleting = false,
  className,
}: TaskCardProps) {
  const isDone = task.status === 'completed'

  return (
    <article
      className={cn(
        'flex items-start gap-3 rounded-card border border-border bg-surface p-3 shadow-xs transition-colors',
        isOverdue && 'border-warning-border bg-warning-soft/40',
        isDone && 'opacity-75',
        className,
      )}
    >
      {onComplete ? (
        <button
          type="button"
          onClick={onComplete}
          disabled={isCompleting}
          aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} as done`}
          aria-pressed={isDone}
          className={cn(
            'mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30',
            'disabled:cursor-not-allowed disabled:opacity-60',
            isDone
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-input bg-surface text-transparent hover:border-brand-600',
          )}
        >
          <Check className="size-3" aria-hidden="true" />
        </button>
      ) : null}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm font-medium text-ink',
            isDone && 'text-ink-secondary line-through decoration-ink-muted/60',
          )}
        >
          {task.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-secondary">
          {customerName ? <span className="truncate">{customerName}</span> : null}
          {dealTitle ? <span className="truncate">· {dealTitle}</span> : null}
          {assigneeName ? <span className="truncate">· {assigneeName}</span> : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.due_date ? (
            <span
              className={cn(
                'text-2xs',
                isOverdue ? 'font-medium text-warning' : 'text-ink-muted',
              )}
            >
              {describeDueDate(task.due_date)}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}
