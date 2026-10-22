/**
 * StatusBadge.
 *
 * Statuses are described by configuration, so a new status needs one entry
 * rather than another near-identical component. The label always carries the
 * meaning, so colour is never the only signal.
 */

import { Badge } from '@/components/ui/badge'
import {
  ACTIVITY_TYPES,
  DEAL_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '@/lib/constants/domain'
import {
  ACTIVITY_TYPE_VISUAL,
  DEAL_STATUS_VISUAL,
  PRIORITY_VISUAL,
  TASK_STATUS_VISUAL,
} from '@/lib/constants/status-visual'
import type { ActivityType, DealStatus, TaskPriority, TaskStatus } from '@/types/api'

function labelFor<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

export function DealStatusBadge({ status, className }: { status: DealStatus; className?: string }) {
  return (
    <Badge tone={DEAL_STATUS_VISUAL[status].tone} className={className}>
      {labelFor(DEAL_STATUSES, status)}
    </Badge>
  )
}

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge tone={TASK_STATUS_VISUAL[status].tone} className={className}>
      {labelFor(TASK_STATUSES, status)}
    </Badge>
  )
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  return (
    <Badge tone={PRIORITY_VISUAL[priority].tone} className={className}>
      {labelFor(TASK_PRIORITIES, priority)}
    </Badge>
  )
}

export function ActivityTypeBadge({ type, className }: { type: ActivityType; className?: string }) {
  return (
    <Badge tone={ACTIVITY_TYPE_VISUAL[type].tone} className={className}>
      {labelFor(ACTIVITY_TYPES, type)}
    </Badge>
  )
}
