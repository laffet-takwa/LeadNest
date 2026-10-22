/**
 * Task queries and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { tasksApi } from '@/features/tasks/api/tasks.api'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { TaskListParams, TaskPatch, TaskPayload } from '@/types/api'

/** A paginated list of tasks. */
export function useTasks(params: TaskListParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: ({ signal }) => tasksApi.list(params, { signal }),
    placeholderData: (previous) => previous,
    staleTime: 15 * 1000,
  })
}

/** Creates a task. */
export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TaskPayload) => tasksApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task created')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not create the task')
    },
  })
}

/** Updates a task, including completing it. */
export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskPatch }) =>
      tasksApi.update(id, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success(variables.payload.status === 'completed' ? 'Task completed' : 'Task updated')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the task')
    },
  })
}

/** Deletes a task. */
export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Task deleted')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete the task')
    },
  })
}
