/**
 * Dashboard queries.
 *
 * Each panel is fetched separately so a failure in one does not blank the
 * whole page, and every panel can be retried on its own.
 */

import { useQuery } from '@tanstack/react-query'

import { dashboardApi } from '@/features/dashboard/api/dashboard.api'
import { queryKeys } from '@/lib/query-keys'

/** The headline numbers. */
export function useDashboardOverview() {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: ({ signal }) => dashboardApi.overview({ signal }),
    staleTime: 30 * 1000,
  })
}

/** Deal counts and values by status. */
export function useSalesPipeline() {
  return useQuery({
    queryKey: queryKeys.dashboard.pipeline(),
    queryFn: ({ signal }) => dashboardApi.pipeline({ signal }),
    staleTime: 30 * 1000,
  })
}

/** The latest activity feed. */
export function useRecentActivities(limit = 8) {
  return useQuery({
    queryKey: queryKeys.dashboard.recentActivities(limit),
    queryFn: ({ signal }) => dashboardApi.recentActivities(limit, { signal }),
    staleTime: 30 * 1000,
  })
}

/** Pending tasks by due date. */
export function useUpcomingTasks(limit = 6) {
  return useQuery({
    queryKey: queryKeys.dashboard.upcomingTasks(limit),
    queryFn: ({ signal }) => dashboardApi.upcomingTasks(limit, { signal }),
    staleTime: 30 * 1000,
  })
}
