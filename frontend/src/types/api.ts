/**
 * Typed API contract.
 *
 * Every field name here mirrors the Go structs in the backend, including the
 * snake_case JSON names. The types are the single source of truth for the
 * frontend's view of the API.
 */

/** Envelope returned by every successful single-resource endpoint. */
export interface ApiSuccess<T> {
  data: T
}

/** Envelope returned by every list endpoint. */
export interface ApiList<T> {
  data: T[]
  meta: {
    total: number
    limit: number
    offset: number
  }
}

/**
 * Machine-readable error codes the backend can return.
 *
 * The `code` field on an error body is typed as `string` because the backend
 * may add codes; this union lists the codes the application reacts to.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'AI_NOT_CONFIGURED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'METHOD_NOT_ALLOWED'
  /** The request was aborted by the caller or by the client timeout. */
  | 'ABORTED'
  /** The request never reached the server. */
  | 'NETWORK_ERROR'

/** Envelope returned by every failing endpoint. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/* -------------------------------------------------------------------------- */
/* Domain models                                                              */
/* -------------------------------------------------------------------------- */

export type Role = 'admin' | 'employee'

export interface User {
  id: string
  company_id: string
  full_name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  email?: string
  phone?: string
  website?: string
  created_at: string
  updated_at: string
}

/**
 * A company member, reduced to what is needed to label a record.
 *
 * `GET /users` is administrator-only, so this projection is what every
 * member of the company can read in order to resolve the assignee ids stored
 * on customers, deals and tasks.
 */
export interface Assignee {
  id: string
  full_name: string
  role: Role
}

export interface Customer {
  id: string
  company_id: string
  assigned_to?: string
  full_name: string
  company?: string
  email?: string
  phone?: string
  source?: string
  notes?: string
  created_at: string
  updated_at: string
}

export type DealStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'

export interface Deal {
  id: string
  company_id: string
  customer_id: string
  assigned_to?: string
  title: string
  description?: string
  /** Decimal string, e.g. "1500.50". Never a float. */
  value: string
  currency: string
  status: DealStatus
  expected_close?: string
  closed_at?: string
  created_at: string
  updated_at: string
}

/** A deal as returned by the list endpoint, enriched with the customer name. */
export interface DealWithCustomer extends Deal {
  customer_name?: string
}

export type TaskStatus = 'pending' | 'completed' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  company_id: string
  assigned_to: string
  customer_id?: string
  deal_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'message' | 'other'

export interface Activity {
  id: string
  company_id: string
  user_id: string
  customer_id?: string
  deal_id?: string
  type: ActivityType
  subject?: string
  description?: string
  occurred_at: string
  created_at: string
  updated_at: string
}

export interface AIInteraction {
  id: string
  company_id: string
  user_id: string
  interaction_type: string
  prompt?: string
  response?: string
  model?: string
  provider?: string
  duration_ms?: number
  created_at: string
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface DashboardMetrics {
  total_customers: number
  open_deals: number
  won_deals: number
  lost_deals: number
  /** Won revenue in TND, as a decimal string. */
  won_revenue_tnd: string
  pending_tasks: number
  overdue_tasks: number
}

export interface StatusBucket {
  status: DealStatus
  currency: string
  count: number
  value: string
}

export interface RevenueByCurrency {
  currency: string
  count: number
  value: string
}

export interface RecentActivity {
  id: string
  type: ActivityType
  subject?: string
  description?: string
  occurred_at: string
  customer_id?: string
  customer_name?: string
  user_id: string
  user_name?: string
}

export interface UpcomingTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  overdue: boolean
  assigned_to: string
  assignee_name?: string
  customer_id?: string
  customer_name?: string
}

export interface DashboardOverview {
  metrics: DashboardMetrics
  deals_by_status: StatusBucket[]
  revenue_by_currency: RevenueByCurrency[]
  recent_activities: RecentActivity[]
  upcoming_tasks: UpcomingTask[]
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

export interface AuthTokens {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  user: User
}

export interface RegisterPayload {
  company: {
    name: string
    email?: string
    phone?: string
    website?: string
  }
  admin: {
    full_name: string
    email: string
    password: string
  }
}

export interface LoginPayload {
  email: string
  password: string
}

/** The payload of the self-service password change. */
export interface ChangePasswordPayload {
  current_password: string
  new_password: string
}

/* -------------------------------------------------------------------------- */
/* Request payloads                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The writable customer fields.
 *
 * The backend replaces every column on update, so an empty string clears the
 * field rather than leaving it alone. Callers therefore send the complete
 * desired state.
 */
export interface CustomerPayload {
  assigned_to?: string
  full_name: string
  company?: string
  email?: string
  phone?: string
  source?: string
  notes?: string
}

export interface DealPayload {
  customer_id: string
  assigned_to?: string
  title: string
  description?: string
  value: string
  currency?: string
  status?: DealStatus
  expected_close?: string
}

export interface DealPatch {
  customer_id?: string
  assigned_to?: string
  title?: string
  description?: string
  value?: string
  currency?: string
  status?: DealStatus
  expected_close?: string
}

export interface TaskPayload {
  assigned_to: string
  customer_id?: string
  deal_id?: string
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string
}

export interface TaskPatch {
  assigned_to?: string
  customer_id?: string
  deal_id?: string
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  due_date?: string
}

export interface ActivityPayload {
  customer_id: string
  deal_id?: string
  type: ActivityType
  subject?: string
  description?: string
  occurred_at?: string
}

export interface CompanyPayload {
  name: string
  email?: string
  phone?: string
  website?: string
}

export interface EmployeePayload {
  full_name: string
  email: string
  password: string
  role?: Role
}

export interface EmployeePatch {
  full_name?: string
  role?: Role
  is_active?: boolean
}

/* -------------------------------------------------------------------------- */
/* AI                                                                         */
/* -------------------------------------------------------------------------- */

export interface EmailDraftPayload {
  customer_id: string
  deal_id?: string
  tone?: string
  language?: string
  notes?: string
}

export interface EmailDraftResult {
  draft: string
  subject: string
  model: string
  provider: string
  warning: string
}

export interface CustomerSummaryPayload {
  customer_id: string
}

export interface CustomerSummaryResult {
  summary: string
  model: string
  provider: string
  warning: string
}

export interface FollowUpPayload {
  limit?: number
}

export interface FollowUpSuggestion {
  customer_id: string
  customer_name: string
  reason: string
  priority: TaskPriority
}

export interface FollowUpResult {
  suggestions: FollowUpSuggestion[]
  model: string
  provider: string
  warning: string
}

/* -------------------------------------------------------------------------- */
/* List query parameters                                                      */
/* -------------------------------------------------------------------------- */

export interface PageParams {
  limit?: number
  offset?: number
}

export interface CustomerListParams extends PageParams {
  search?: string
  assigned_to?: string
  source?: string
  sort?: 'created_at' | 'updated_at' | 'full_name' | 'company' | 'email' | 'source'
  order?: 'asc' | 'desc'
}

export interface DealListParams extends PageParams {
  search?: string
  status?: DealStatus
  assigned_to?: string
  customer_id?: string
  expected_close_from?: string
  expected_close_to?: string
  sort?: 'created_at' | 'updated_at' | 'title' | 'value' | 'expected_close' | 'status'
  order?: 'asc' | 'desc'
}

export interface TaskListParams extends PageParams {
  status?: TaskStatus
  priority?: TaskPriority
  assigned_to?: string
  customer_id?: string
  deal_id?: string
  due_from?: string
  due_to?: string
  overdue?: boolean
  sort?: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'status' | 'title'
  order?: 'asc' | 'desc'
}

export interface ActivityListParams extends PageParams {
  customer_id?: string
  deal_id?: string
  user_id?: string
  type?: ActivityType
  from?: string
  to?: string
}
