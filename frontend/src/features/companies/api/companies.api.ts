/**
 * Company and team API.
 */

import { getList, getOne, patch, post, remove } from '@/lib/api/client'
import type {
  Assignee,
  Company,
  CompanyPayload,
  EmployeePatch,
  EmployeePayload,
  User,
} from '@/types/api'

export const companiesApi = {
  /** `GET /companies/me` — the caller's company. */
  get(options?: { signal?: AbortSignal }) {
    return getOne<{ company: Company }>('/companies/me', options).then((data) => data.company)
  },

  /** `PATCH /companies/me` — updates the company. Administrators only. */
  update(payload: CompanyPayload) {
    return patch<Company>('/companies/me', payload)
  },
}

export const usersApi = {
  /** `GET /users` — the company members. Administrators only. */
  list(options?: { signal?: AbortSignal }) {
    return getList<User>('/users', options)
  },

  /**
   * `GET /users/assignees` — the active members of the company.
   *
   * Unlike `/users`, this endpoint is open to every member of the company,
   * because the CRM stores an assignee on its records and the name behind
   * that id has to be readable by everyone.
   */
  assignees(options?: { signal?: AbortSignal }) {
    return getList<Assignee>('/users/assignees', options)
  },

  /** `POST /users` — adds an employee. Administrators only. */
  create(payload: EmployeePayload) {
    return post<User>('/users', payload)
  },

  /** `PATCH /users/:id` — updates a member. Administrators only. */
  update(id: string, payload: EmployeePatch) {
    return patch<User>(`/users/${id}`, payload)
  },

  /** `DELETE /users/:id` — deactivates a member. Administrators only. */
  remove(id: string) {
    return remove(`/users/${id}`)
  },
}
