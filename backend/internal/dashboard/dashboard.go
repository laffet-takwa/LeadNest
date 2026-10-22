// Package dashboard implements company analytics endpoints.
package dashboard

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/pagination"
	"github.com/leadnest/backend/internal/response"
)

var errNotFound = errors.New("dashboard not found")

type Repo struct {
	q database.Querier
}

func NewRepo(q database.Querier) *Repo {
	return &Repo{q: q}
}

// Metrics mirrors the company_dashboard view for a single company.
type Metrics struct {
	TotalCustomers int64  `json:"total_customers"`
	OpenDeals      int64  `json:"open_deals"`
	WonDeals       int64  `json:"won_deals"`
	LostDeals      int64  `json:"lost_deals"`
	WonRevenueTND  string `json:"won_revenue_tnd"`
	PendingTasks   int64  `json:"pending_tasks"`
	OverdueTasks   int64  `json:"overdue_tasks"`
}

// GetMetrics reads the primary dashboard metrics from the company_dashboard view.
func (r *Repo) GetMetrics(ctx context.Context, companyID string) (Metrics, error) {
	const q = `SELECT total_customers, open_deals, won_deals, lost_deals,
                     won_revenue_tnd::text, pending_tasks, overdue_tasks
              FROM company_dashboard WHERE company_id = $1`
	var m Metrics
	err := r.q.QueryRow(ctx, q, companyID).Scan(
		&m.TotalCustomers, &m.OpenDeals, &m.WonDeals, &m.LostDeals,
		&m.WonRevenueTND, &m.PendingTasks, &m.OverdueTasks,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return m, errNotFound
		}
		return m, err
	}
	return m, nil
}

// StatusBucket is the deal count and value for one status and currency.
type StatusBucket struct {
	Status   string `json:"status"`
	Currency string `json:"currency"`
	Count    int64  `json:"count"`
	Value    string `json:"value"`
}

// Pipeline returns deal counts and values grouped by status and currency.
// Values are never summed across different currencies.
func (r *Repo) Pipeline(ctx context.Context, companyID string) ([]StatusBucket, error) {
	const q = `SELECT status, currency, COUNT(*)::bigint, COALESCE(SUM(value), 0)::text
              FROM deals
              WHERE company_id = $1
              GROUP BY status, currency
              ORDER BY status, currency`
	rows, err := r.q.Query(ctx, q, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []StatusBucket{}
	for rows.Next() {
		var b StatusBucket
		if err := rows.Scan(&b.Status, &b.Currency, &b.Count, &b.Value); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// RevenueByCurrency returns won revenue grouped by currency.
type RevenueByCurrency struct {
	Currency string `json:"currency"`
	Count    int64  `json:"count"`
	Value    string `json:"value"`
}

func (r *Repo) RevenueByCurrency(ctx context.Context, companyID string) ([]RevenueByCurrency, error) {
	const q = `SELECT currency, COUNT(*)::bigint, COALESCE(SUM(value), 0)::text
              FROM deals
              WHERE company_id = $1 AND status = 'won'
              GROUP BY currency
              ORDER BY currency`
	rows, err := r.q.Query(ctx, q, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RevenueByCurrency{}
	for rows.Next() {
		var b RevenueByCurrency
		if err := rows.Scan(&b.Currency, &b.Count, &b.Value); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// RecentActivity is a compact activity entry for the dashboard feed.
type RecentActivity struct {
	ID           string    `json:"id"`
	Type         string    `json:"type"`
	Subject      string    `json:"subject,omitempty"`
	Description  string    `json:"description,omitempty"`
	OccurredAt   time.Time `json:"occurred_at"`
	CustomerID   string    `json:"customer_id,omitempty"`
	CustomerName string    `json:"customer_name,omitempty"`
	UserID       string    `json:"user_id"`
	UserName     string    `json:"user_name,omitempty"`
}

func (r *Repo) RecentActivities(ctx context.Context, companyID string, limit int) ([]RecentActivity, error) {
	const q = `SELECT a.id, a.type, COALESCE(a.subject, ''), COALESCE(a.description, ''), a.occurred_at,
                     COALESCE(a.customer_id::text, ''), COALESCE(c.full_name, ''),
                     a.user_id, COALESCE(u.full_name, '')
              FROM activities a
              LEFT JOIN customers c ON c.id = a.customer_id
              LEFT JOIN users u ON u.id = a.user_id
              WHERE a.company_id = $1
              ORDER BY a.occurred_at DESC, a.created_at DESC
              LIMIT $2`
	rows, err := r.q.Query(ctx, q, companyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RecentActivity{}
	for rows.Next() {
		var a RecentActivity
		if err := rows.Scan(&a.ID, &a.Type, &a.Subject, &a.Description, &a.OccurredAt,
			&a.CustomerID, &a.CustomerName, &a.UserID, &a.UserName); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// UpcomingTask is a compact task entry for the dashboard list.
type UpcomingTask struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	Status       string     `json:"status"`
	Priority     string     `json:"priority"`
	DueDate      *time.Time `json:"due_date,omitempty"`
	Overdue      bool       `json:"overdue"`
	AssignedTo   string     `json:"assigned_to"`
	AssigneeName string     `json:"assignee_name,omitempty"`
	CustomerID   string     `json:"customer_id,omitempty"`
	CustomerName string     `json:"customer_name,omitempty"`
}

func (r *Repo) UpcomingTasks(ctx context.Context, companyID string, limit int) ([]UpcomingTask, error) {
	const q = `SELECT t.id, t.title, t.status, t.priority, t.due_date,
                     (t.status = 'pending' AND t.due_date IS NOT NULL AND t.due_date < NOW()),
                     t.assigned_to, COALESCE(u.full_name, ''),
                     COALESCE(t.customer_id::text, ''), COALESCE(c.full_name, '')
              FROM tasks t
              LEFT JOIN users u ON u.id = t.assigned_to
              LEFT JOIN customers c ON c.id = t.customer_id
              WHERE t.company_id = $1 AND t.status = 'pending'
              ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC
              LIMIT $2`
	rows, err := r.q.Query(ctx, q, companyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UpcomingTask{}
	for rows.Next() {
		var t UpcomingTask
		if err := rows.Scan(&t.ID, &t.Title, &t.Status, &t.Priority, &t.DueDate, &t.Overdue,
			&t.AssignedTo, &t.AssigneeName, &t.CustomerID, &t.CustomerName); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// --- Handler ---

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

// Overview is the full dashboard payload.
type Overview struct {
	Metrics           Metrics             `json:"metrics"`
	DealsByStatus     []StatusBucket      `json:"deals_by_status"`
	RevenueByCurrency []RevenueByCurrency `json:"revenue_by_currency"`
	RecentActivities  []RecentActivity    `json:"recent_activities"`
	UpcomingTasks     []UpcomingTask      `json:"upcoming_tasks"`
}

// Get returns the full dashboard for the caller's company.
// @Summary      Get dashboard
// @Description  Returns tenant-scoped dashboard metrics, deal pipeline, recent activities and upcoming tasks.
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.Success{data=Overview}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/dashboard  [get]
func (h *Handler) Get(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	ctx := c.Request.Context()

	metrics, err := h.repo.GetMetrics(ctx, u.CompanyID)
	if err != nil {
		if errors.Is(err, errNotFound) {
			// A company with no rows in the view still has valid zero metrics.
			metrics = Metrics{WonRevenueTND: "0"}
		} else {
			response.InternalErrorf(c, err, "failed to load dashboard")
			return
		}
	}
	pipeline, err := h.repo.Pipeline(ctx, u.CompanyID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load dashboard")
		return
	}
	revenue, err := h.repo.RevenueByCurrency(ctx, u.CompanyID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load dashboard")
		return
	}
	activities, err := h.repo.RecentActivities(ctx, u.CompanyID, 10)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load dashboard")
		return
	}
	tasks, err := h.repo.UpcomingTasks(ctx, u.CompanyID, 10)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load dashboard")
		return
	}
	response.JSON(c, 200, Overview{
		Metrics:           metrics,
		DealsByStatus:     pipeline,
		RevenueByCurrency: revenue,
		RecentActivities:  activities,
		UpcomingTasks:     tasks,
	})
}

// Pipeline returns deal counts and values grouped by status and currency.
// @Summary      Get sales pipeline
// @Description  Returns deal counts and values grouped by status and currency. Amounts are never combined across currencies.
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.Success{data=[]StatusBucket}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/dashboard/sales-pipeline  [get]
func (h *Handler) Pipeline(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	buckets, err := h.repo.Pipeline(c.Request.Context(), u.CompanyID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load sales pipeline")
		return
	}
	response.JSON(c, 200, buckets)
}

// RecentActivities returns the latest activity feed for the caller's company.
// @Summary      Get recent activities
// @Description  Returns the most recent activities of the authenticated user's company.
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query  int  false  "Maximum number of activities"
// @Success      200  {object}  response.Success{data=[]RecentActivity}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/dashboard/recent-activities  [get]
func (h *Handler) RecentActivities(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	limit := pagination.Clamp(c.Query("limit"), 10)
	items, err := h.repo.RecentActivities(c.Request.Context(), u.CompanyID, limit)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load recent activities")
		return
	}
	response.JSON(c, 200, items)
}

// UpcomingTasks returns pending tasks ordered by due date.
// @Summary      Get upcoming tasks
// @Description  Returns pending tasks of the authenticated user's company ordered by due date.
// @Tags         dashboard
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query  int  false  "Maximum number of tasks"
// @Success      200  {object}  response.Success{data=[]UpcomingTask}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/dashboard/upcoming-tasks  [get]
func (h *Handler) UpcomingTasks(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	limit := pagination.Clamp(c.Query("limit"), 10)
	items, err := h.repo.UpcomingTasks(c.Request.Context(), u.CompanyID, limit)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load upcoming tasks")
		return
	}
	response.JSON(c, 200, items)
}

// RegisterRoutes wires dashboard routes onto an authenticated router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.Get)
	rg.GET("/sales-pipeline", h.Pipeline)
	rg.GET("/recent-activities", h.RecentActivities)
	rg.GET("/upcoming-tasks", h.UpcomingTasks)
}
