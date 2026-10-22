/**
 * Task API.
 */

import { getList, getOne, patch, post, remove } from '@/lib/api/client'
import type { Task, TaskListParams, TaskPatch, TaskPayload } from '@/types/api'

export const tasksApi = {
  /** `GET /tasks` — a paginated, filtered list. */
  list(params: TaskListParams = {}, options?: { signal?: AbortSignal }) {
    return getList<Task>('/tasks', { ...options, query: { ...params } })
  },

  /** `GET /tasks/:id` — a single task. */
  get(id: string, options?: { signal?: AbortSignal }) {
    return getOne<Task>(`/tasks/${id}`, options)
  },

  /** `POST /tasks` — creates a task. */
  create(payload: TaskPayload) {
    return post<Task>('/tasks', payload)
  },

  /** `PATCH /tasks/:id` — updates a task, including completing it. */
  update(id: string, payload: TaskPatch) {
    return patch<Task>(`/tasks/${id}`, payload)
  },

  /** `DELETE /tasks/:id` — removes a task. */
  remove(id: string) {
    return remove(`/tasks/${id}`)
  },
}
