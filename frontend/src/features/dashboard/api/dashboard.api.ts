/**
 * Dashboard API.
 */

import { getOne } from '@/lib/api/client'
import type {
  DashboardOverview,
  RecentActivity,
  StatusBucket,
  UpcomingTask,
} from '@/types/api'

export const dashboardApi = {
  /** `GET /dashboard` — the full dashboard payload. */
  overview(options?: { signal?: AbortSignal }) {
    return getOne<DashboardOverview>('/dashboard', options)
  },

  /** `GET /dashboard/sales-pipeline` — deal counts and values by status. */
  pipeline(options?: { signal?: AbortSignal }) {
    return getOne<StatusBucket[]>('/dashboard/sales-pipeline', options)
  },

  /** `GET /dashboard/recent-activities` — the latest activity feed. */
  recentActivities(limit = 8, options?: { signal?: AbortSignal }) {
    return getOne<RecentActivity[]>('/dashboard/recent-activities', {
      ...options,
      query: { limit },
    })
  },

  /** `GET /dashboard/upcoming-tasks` — pending tasks by due date. */
  upcomingTasks(limit = 6, options?: { signal?: AbortSignal }) {
    return getOne<UpcomingTask[]>('/dashboard/upcoming-tasks', {
      ...options,
      query: { limit },
    })
  },
}
