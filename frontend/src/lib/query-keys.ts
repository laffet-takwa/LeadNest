/**
 * Query keys.
 *
 * Centralised so a mutation can invalidate exactly the queries it affects.
 */

import type {
  ActivityListParams,
  CustomerListParams,
  DealListParams,
  TaskListParams,
} from '@/types/api'

export const queryKeys = {
  customers: {
    all: ['customers'] as const,
    list: (params: CustomerListParams) => ['customers', 'list', params] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  deals: {
    all: ['deals'] as const,
    list: (params: DealListParams) => ['deals', 'list', params] as const,
    detail: (id: string) => ['deals', 'detail', id] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (params: TaskListParams) => ['tasks', 'list', params] as const,
  },
  activities: {
    all: ['activities'] as const,
    list: (params: ActivityListParams) => ['activities', 'list', params] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    overview: () => ['dashboard', 'overview'] as const,
    pipeline: () => ['dashboard', 'pipeline'] as const,
    recentActivities: (limit: number) => ['dashboard', 'recent-activities', limit] as const,
    upcomingTasks: (limit: number) => ['dashboard', 'upcoming-tasks', limit] as const,
  },
  company: {
    all: ['company'] as const,
    me: () => ['company', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
    assignees: () => ['users', 'assignees'] as const,
  },
  ai: {
    all: ['ai'] as const,
    history: (params: { limit?: number; offset?: number; type?: string }) =>
      ['ai', 'history', params] as const,
  },
} as const
