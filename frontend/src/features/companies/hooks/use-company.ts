/**
 * Company and team queries.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { companiesApi, usersApi } from '@/features/companies/api/companies.api'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import type { Assignee, CompanyPayload, EmployeePatch, EmployeePayload } from '@/types/api'

/** The signed-in user's company. */
export function useCompany() {
  return useQuery({
    queryKey: queryKeys.company.me(),
    queryFn: ({ signal }) => companiesApi.get({ signal }),
    staleTime: 5 * 60 * 1000,
  })
}

/** Updates the company profile. */
export function useUpdateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CompanyPayload) => companiesApi.update(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.all })
      toast.success('Company profile updated')
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiError ? error.message : 'Could not update the company profile',
      )
    },
  })
}

/** The company members. Only administrators may call this. */
export function useUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: ({ signal }) => usersApi.list({ signal }),
    enabled,
    staleTime: 60 * 1000,
  })
}

/**
 * The active members of the company.
 *
 * `GET /users/assignees` is readable by every member of the company, so the
 * assignee of a record can always be shown by name — not only to
 * administrators.
 */
export function useAssignees() {
  return useQuery({
    queryKey: queryKeys.users.assignees(),
    queryFn: ({ signal }) => usersApi.assignees({ signal }),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * The people a record can be assigned to.
 *
 * The list comes from the member-readable endpoint, so an employee sees
 * their colleagues as well. The signed-in user is added as a fallback so the
 * picker is never empty while the request is in flight.
 */
export function useAssigneeOptions(): Assignee[] {
  const { user } = useAuth()
  const { data } = useAssignees()

  return useMemo(() => {
    const members = data?.data ?? []
    if (members.length > 0) return members
    return user ? [{ id: user.id, full_name: user.full_name, role: user.role }] : []
  }, [data, user])
}

/** Adds an employee. */
export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: EmployeePayload) => usersApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      toast.success('Team member added')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not add the team member')
    },
  })
}

/** Updates a team member's role, name or active state. */
export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EmployeePatch }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      toast.success('Team member updated')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not update the team member')
    },
  })
}

/** Deactivates a team member. */
export function useDeactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      toast.success('Team member deactivated')
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : 'Could not deactivate the team member')
    },
  })
}
