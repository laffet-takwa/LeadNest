// Package tasks implements follow-up task CRUD.
package tasks

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

var (
	errNotFound         = errors.New("task not found")
	errAssigneeNotFound = errors.New("assignee not found")
	errCustomerNotFound = errors.New("customer not found")
	errDealNotFound     = errors.New("deal not found")
)

// Statuses lists the supported task statuses.
var Statuses = []string{models.TaskPending, models.TaskCompleted, models.TaskCancelled}

// Priorities lists the supported task priorities.
var Priorities = []string{models.PriorityLow, models.PriorityMedium, models.PriorityHigh}

// IsValidStatus reports whether s is a supported task status.
func IsValidStatus(s string) bool {
	for _, v := range Statuses {
		if v == s {
			return true
		}
	}
	return false
}

// IsValidPriority reports whether s is a supported task priority.
func IsValidPriority(s string) bool {
	for _, v := range Priorities {
		if v == s {
			return true
		}
	}
	return false
}

type Repo struct {
	q database.Querier
}

func NewRepo(q database.Querier) *Repo {
	return &Repo{q: q}
}

// ListFilter captures the supported list query parameters.
type ListFilter struct {
	Status     string
	Priority   string
	AssignedTo string
	CustomerID string
	DealID     string
	DueFrom    *time.Time
	DueTo      *time.Time
	Overdue    bool
	Sort       string
	Order      string
	Limit      int
	Offset     int
}

func (r *Repo) List(ctx context.Context, companyID string, f ListFilter) ([]models.Task, int64, error) {
	filters := []string{"company_id = $1"}
	args := []any{companyID}
	i := 2
	if f.Status != "" {
		filters = append(filters, fmt.Sprintf("status = $%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.Priority != "" {
		filters = append(filters, fmt.Sprintf("priority = $%d", i))
		args = append(args, f.Priority)
		i++
	}
	if f.AssignedTo != "" {
		filters = append(filters, fmt.Sprintf("assigned_to = $%d", i))
		args = append(args, f.AssignedTo)
		i++
	}
	if f.CustomerID != "" {
		filters = append(filters, fmt.Sprintf("customer_id = $%d", i))
		args = append(args, f.CustomerID)
		i++
	}
	if f.DealID != "" {
		filters = append(filters, fmt.Sprintf("deal_id = $%d", i))
		args = append(args, f.DealID)
		i++
	}
	if f.DueFrom != nil {
		filters = append(filters, fmt.Sprintf("due_date >= $%d", i))
		args = append(args, *f.DueFrom)
		i++
	}
	if f.DueTo != nil {
		filters = append(filters, fmt.Sprintf("due_date <= $%d", i))
		args = append(args, *f.DueTo)
		i++
	}
	if f.Overdue {
		filters = append(filters, "due_date < NOW()", "status = 'pending'")
	}
	where := strings.Join(filters, " AND ")

	var total int64
	if err := r.q.QueryRow(ctx, "SELECT COUNT(*) FROM tasks WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	orderCol := map[string]string{
		"created_at": "created_at",
		"updated_at": "updated_at",
		"due_date":   "due_date",
		"priority":   "priority",
		"status":     "status",
		"title":      "title",
	}[f.Sort]
	if orderCol == "" {
		orderCol = "created_at"
	}
	orderDir := "DESC"
	if strings.EqualFold(f.Order, "asc") {
		orderDir = "ASC"
	}

	query := fmt.Sprintf(
		`SELECT id, company_id, assigned_to, customer_id, deal_id, title, description,
                status, priority, due_date, completed_at, created_at, updated_at
         FROM tasks WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, orderCol, orderDir, i, i+1,
	)
	args = append(args, f.Limit, f.Offset)
	rows, err := r.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []models.Task{}
	for rows.Next() {
		var t models.Task
		var customerID, dealID, description *string
		if err := rows.Scan(
			&t.ID, &t.CompanyID, &t.AssignedTo, &customerID, &dealID, &t.Title, &description,
			&t.Status, &t.Priority, &t.DueDate, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		if customerID != nil {
			t.CustomerID = *customerID
		}
		if dealID != nil {
			t.DealID = *dealID
		}
		t.Description = models.NullString(description)
		out = append(out, t)
	}
	return out, total, rows.Err()
}

func (r *Repo) GetByID(ctx context.Context, companyID, id string) (models.Task, error) {
	const q = `SELECT id, company_id, assigned_to, customer_id, deal_id, title, description,
                     status, priority, due_date, completed_at, created_at, updated_at
              FROM tasks WHERE company_id = $1 AND id = $2`
	t := models.Task{}
	var customerID, dealID, description *string
	err := r.q.QueryRow(ctx, q, companyID, id).Scan(
		&t.ID, &t.CompanyID, &t.AssignedTo, &customerID, &dealID, &t.Title, &description,
		&t.Status, &t.Priority, &t.DueDate, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if customerID != nil {
		t.CustomerID = *customerID
	}
	if dealID != nil {
		t.DealID = *dealID
	}
	t.Description = models.NullString(description)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return t, errNotFound
		}
		return t, err
	}
	return t, nil
}

// Create inserts a new task, validating every foreign reference belongs to the
// caller's company.
func (r *Repo) Create(ctx context.Context, companyID, assignedTo, customerID, dealID, title, description, status, priority string, dueDate *time.Time) (models.Task, error) {
	if err := r.assertUser(ctx, companyID, assignedTo); err != nil {
		return models.Task{}, err
	}
	if customerID != "" {
		if err := r.assertCustomer(ctx, companyID, customerID); err != nil {
			return models.Task{}, err
		}
	}
	if dealID != "" {
		if err := r.assertDeal(ctx, companyID, dealID); err != nil {
			return models.Task{}, err
		}
	}
	var completedAt any
	if status == models.TaskCompleted {
		completedAt = time.Now().UTC()
	}
	const q = `INSERT INTO tasks (company_id, assigned_to, customer_id, deal_id, title, description, status, priority, due_date, completed_at)
               VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6::text, $7, $8, $9::timestamptz, $10::timestamptz)
               RETURNING id, company_id, assigned_to, customer_id, deal_id, title, description,
                         status, priority, due_date, completed_at, created_at, updated_at`
	t := models.Task{}
	var cID, dID, outDescription *string
	err := r.q.QueryRow(ctx, q, companyID, assignedTo, nullIfEmpty(customerID), nullIfEmpty(dealID),
		title, nullIfEmpty(description), status, priority, dueDate, completedAt).Scan(
		&t.ID, &t.CompanyID, &t.AssignedTo, &cID, &dID, &t.Title, &outDescription,
		&t.Status, &t.Priority, &t.DueDate, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if cID != nil {
		t.CustomerID = *cID
	}
	if dID != nil {
		t.DealID = *dID
	}
	t.Description = models.NullString(outDescription)
	if err != nil {
		return t, err
	}
	return t, nil
}

// UpdateFields holds the optional fields of a task update.
type UpdateFields struct {
	AssignedTo  *string
	CustomerID  *string
	DealID      *string
	Title       *string
	Description *string
	Status      *string
	Priority    *string
	DueDate     *time.Time
}

// Update applies a partial update, setting completed_at on completion and
// clearing it when a task is reopened.
func (r *Repo) Update(ctx context.Context, companyID, id string, f UpdateFields) (models.Task, error) {
	current, err := r.GetByID(ctx, companyID, id)
	if err != nil {
		return models.Task{}, err
	}
	if f.AssignedTo != nil && *f.AssignedTo != "" && *f.AssignedTo != current.AssignedTo {
		if err := r.assertUser(ctx, companyID, *f.AssignedTo); err != nil {
			return models.Task{}, err
		}
	}
	if f.CustomerID != nil && *f.CustomerID != "" && *f.CustomerID != current.CustomerID {
		if err := r.assertCustomer(ctx, companyID, *f.CustomerID); err != nil {
			return models.Task{}, err
		}
	}
	if f.DealID != nil && *f.DealID != "" && *f.DealID != current.DealID {
		if err := r.assertDeal(ctx, companyID, *f.DealID); err != nil {
			return models.Task{}, err
		}
	}
	if f.Status != nil && *f.Status != "" && !IsValidStatus(*f.Status) {
		return models.Task{}, fmt.Errorf("invalid status %q", *f.Status)
	}
	if f.Priority != nil && *f.Priority != "" && !IsValidPriority(*f.Priority) {
		return models.Task{}, fmt.Errorf("invalid priority %q", *f.Priority)
	}

	// A task that moves into the completed state gets a closing timestamp; a
	// task that is reopened has it cleared. Without a status change the
	// existing value is preserved.
	setCompleted := f.Status != nil && *f.Status == models.TaskCompleted && current.CompletedAt == nil
	clearCompleted := f.Status != nil && *f.Status != models.TaskCompleted
	var completedAt any
	if setCompleted {
		completedAt = time.Now().UTC()
	}

	const q = `UPDATE tasks SET
                 assigned_to = COALESCE($1, assigned_to),
                 customer_id = COALESCE($2::uuid, customer_id),
                 deal_id = COALESCE($3::uuid, deal_id),
                 title = COALESCE($4, title),
                 description = COALESCE($5, description),
                 status = COALESCE($6, status),
                 priority = COALESCE($7, priority),
                 due_date = COALESCE($8::timestamptz, due_date),
                 completed_at = CASE WHEN $9 THEN $10::timestamptz
                                     WHEN $11 THEN NULL
                                     ELSE completed_at END
               WHERE company_id = $12 AND id = $13
               RETURNING id, company_id, assigned_to, customer_id, deal_id, title, description,
                         status, priority, due_date, completed_at, created_at, updated_at`
	t := models.Task{}
	var cID, dID, description *string
	err = r.q.QueryRow(ctx, q, f.AssignedTo, f.CustomerID, f.DealID, f.Title, f.Description,
		f.Status, f.Priority, f.DueDate, setCompleted, completedAt, clearCompleted, companyID, id).Scan(
		&t.ID, &t.CompanyID, &t.AssignedTo, &cID, &dID, &t.Title, &description,
		&t.Status, &t.Priority, &t.DueDate, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if cID != nil {
		t.CustomerID = *cID
	}
	if dID != nil {
		t.DealID = *dID
	}
	t.Description = models.NullString(description)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return t, errNotFound
		}
		return t, err
	}
	return t, nil
}

func (r *Repo) Delete(ctx context.Context, companyID, id string) error {
	res, err := r.q.Exec(ctx, "DELETE FROM tasks WHERE company_id = $1 AND id = $2", companyID, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (r *Repo) assertUser(ctx context.Context, companyID, userID string) error {
	if userID == "" {
		return errAssigneeNotFound
	}
	var exists bool
	if err := r.q.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE company_id = $1 AND id = $2 AND is_active = true)",
		companyID, userID,
	).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errAssigneeNotFound
	}
	return nil
}

func (r *Repo) assertCustomer(ctx context.Context, companyID, customerID string) error {
	var exists bool
	if err := r.q.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM customers WHERE company_id = $1 AND id = $2)",
		companyID, customerID,
	).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errCustomerNotFound
	}
	return nil
}

func (r *Repo) assertDeal(ctx context.Context, companyID, dealID string) error {
	var exists bool
	if err := r.q.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM deals WHERE company_id = $1 AND id = $2)",
		companyID, dealID,
	).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errDealNotFound
	}
	return nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// --- Handler ---

type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

type createRequest struct {
	AssignedTo  string  `json:"assigned_to" validate:"required,uuid"`
	CustomerID  string  `json:"customer_id,omitempty" validate:"uuid"`
	DealID      string  `json:"deal_id,omitempty" validate:"uuid"`
	Title       string  `json:"title" validate:"required,max=255"`
	Description string  `json:"description,omitempty" validate:"max=5000"`
	Status      string  `json:"status,omitempty" validate:"max=20"`
	Priority    string  `json:"priority,omitempty" validate:"max=20"`
	DueDate     *string `json:"due_date,omitempty"`
}

type updateRequest struct {
	AssignedTo  *string `json:"assigned_to,omitempty" validate:"uuid"`
	CustomerID  *string `json:"customer_id,omitempty" validate:"uuid"`
	DealID      *string `json:"deal_id,omitempty" validate:"uuid"`
	Title       *string `json:"title,omitempty" validate:"max=255"`
	Description *string `json:"description,omitempty" validate:"max=5000"`
	Status      *string `json:"status,omitempty" validate:"max=20"`
	Priority    *string `json:"priority,omitempty" validate:"max=20"`
	DueDate     *string `json:"due_date,omitempty"`
}

func parseDateTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return &t, nil
		}
	}
	return nil, fmt.Errorf("invalid datetime")
}

// List returns tasks for the caller's company.
// @Summary      List tasks
// @Description  Returns a paginated and filtered list of follow-up tasks for the authenticated user's company.
// @Tags         tasks
// @Produce      json
// @Security     BearerAuth
// @Param        limit             query  int     false  "Page size"
// @Param        offset            query  int     false  "Page offset"
// @Param        status            query  string  false  "Filter by status"
// @Param        priority          query  string  false  "Filter by priority"
// @Param        assigned_to       query  string  false  "Filter by assignee"
// @Param        customer_id       query  string  false  "Filter by customer"
// @Param        deal_id           query  string  false  "Filter by deal"
// @Param        due_from          query  string  false  "Due date lower bound (RFC3339 or YYYY-MM-DD)"
// @Param        due_to            query  string  false  "Due date upper bound (RFC3339 or YYYY-MM-DD)"
// @Param        overdue           query  bool    false  "Only return overdue pending tasks"
// @Param        sort              query  string  false  "Sort field"
// @Param        order             query  string  false  "Sort order (asc/desc)"
// @Success      200  {object}  response.ListResponse{data=[]models.Task}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/tasks  [get]
func (h *Handler) List(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	f := ListFilter{
		Status:     c.Query("status"),
		Priority:   c.Query("priority"),
		AssignedTo: c.Query("assigned_to"),
		CustomerID: c.Query("customer_id"),
		DealID:     c.Query("deal_id"),
		Sort:       c.Query("sort"),
		Order:      c.Query("order"),
		Limit:      clampInt(c.Query("limit"), 1, 100, 20),
		Offset:     maxInt(0, parseInt(c.Query("offset"))),
	}
	if f.Status != "" && !IsValidStatus(f.Status) {
		response.BadRequest(c, "invalid status filter")
		return
	}
	if f.Priority != "" && !IsValidPriority(f.Priority) {
		response.BadRequest(c, "invalid priority filter")
		return
	}
	if v := c.Query("overdue"); v == "true" || v == "1" {
		f.Overdue = true
	}
	dueFrom, err := parseDateTime(c.Query("due_from"))
	if err != nil {
		response.BadRequest(c, "due_from must be an RFC3339 timestamp or YYYY-MM-DD date")
		return
	}
	dueTo, err := parseDateTime(c.Query("due_to"))
	if err != nil {
		response.BadRequest(c, "due_to must be an RFC3339 timestamp or YYYY-MM-DD date")
		return
	}
	f.DueFrom, f.DueTo = dueFrom, dueTo

	items, total, err := h.repo.List(c.Request.Context(), u.CompanyID, f)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list tasks")
		return
	}
	response.List(c, items, total, f.Limit, f.Offset)
}

// Create creates a task.
// @Summary      Create a task
// @Description  Creates a follow-up task assigned to a company employee.
// @Tags         tasks
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  createRequest  true  "Task payload"
// @Success      201  {object}  response.Success{data=models.Task}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/tasks  [post]
func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = models.TaskPending
	}
	if !IsValidStatus(status) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "status", Reason: "must be one of pending, completed, cancelled"},
		})
		return
	}
	priority := strings.ToLower(strings.TrimSpace(req.Priority))
	if priority == "" {
		priority = models.PriorityMedium
	}
	if !IsValidPriority(priority) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "priority", Reason: "must be one of low, medium, high"},
		})
		return
	}
	var dueDate *time.Time
	if req.DueDate != nil && *req.DueDate != "" {
		t, err := parseDateTime(*req.DueDate)
		if err != nil {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "due_date", Reason: "must be an RFC3339 timestamp or YYYY-MM-DD date"},
			})
			return
		}
		dueDate = t
	}

	u := middleware.AuthUserFromContext(c)
	task, err := h.repo.Create(c.Request.Context(), u.CompanyID, req.AssignedTo, req.CustomerID,
		req.DealID, req.Title, req.Description, status, priority, dueDate)
	if err != nil {
		switch {
		case errors.Is(err, errAssigneeNotFound):
			response.NotFound(c, "assignee not found in this company")
		case errors.Is(err, errCustomerNotFound):
			response.NotFound(c, "customer not found")
		case errors.Is(err, errDealNotFound):
			response.NotFound(c, "deal not found")
		default:
			response.InternalErrorf(c, err, "failed to create task")
		}
		return
	}
	response.Created(c, task)
}

// Get returns a single task.
// @Summary      Get a task
// @Description  Returns a task of the authenticated user's company.
// @Tags         tasks
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Task ID"
// @Success      200  {object}  response.Success{data=models.Task}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/tasks/{id}  [get]
func (h *Handler) Get(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	task, err := h.repo.GetByID(c.Request.Context(), u.CompanyID, c.Param("id"))
	if err != nil {
		if errors.Is(err, errNotFound) {
			response.NotFound(c, "task not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch task")
		return
	}
	response.JSON(c, 200, task)
}

// Update updates a task.
// @Summary      Update a task
// @Description  Updates a task. Completing a task sets its completed_at timestamp.
// @Tags         tasks
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  string  true  "Task ID"
// @Param        body  body  updateRequest  true  "Task update"
// @Success      200  {object}  response.Success{data=models.Task}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/tasks/{id}  [patch]
func (h *Handler) Update(c *gin.Context) {
	var req updateRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	f := UpdateFields{
		AssignedTo:  req.AssignedTo,
		CustomerID:  req.CustomerID,
		DealID:      req.DealID,
		Title:       req.Title,
		Description: req.Description,
	}
	if req.Status != nil && *req.Status != "" {
		s := strings.ToLower(strings.TrimSpace(*req.Status))
		if !IsValidStatus(s) {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "status", Reason: "must be one of pending, completed, cancelled"},
			})
			return
		}
		f.Status = &s
	}
	if req.Priority != nil && *req.Priority != "" {
		p := strings.ToLower(strings.TrimSpace(*req.Priority))
		if !IsValidPriority(p) {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "priority", Reason: "must be one of low, medium, high"},
			})
			return
		}
		f.Priority = &p
	}
	if req.DueDate != nil {
		t, err := parseDateTime(*req.DueDate)
		if err != nil {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "due_date", Reason: "must be an RFC3339 timestamp or YYYY-MM-DD date"},
			})
			return
		}
		f.DueDate = t
	}

	u := middleware.AuthUserFromContext(c)
	task, err := h.repo.Update(c.Request.Context(), u.CompanyID, c.Param("id"), f)
	if err != nil {
		switch {
		case errors.Is(err, errNotFound):
			response.NotFound(c, "task not found")
		case errors.Is(err, errAssigneeNotFound):
			response.NotFound(c, "assignee not found in this company")
		case errors.Is(err, errCustomerNotFound):
			response.NotFound(c, "customer not found")
		case errors.Is(err, errDealNotFound):
			response.NotFound(c, "deal not found")
		default:
			response.InternalErrorf(c, err, "failed to update task")
		}
		return
	}
	response.JSON(c, 200, task)
}

// Delete removes a task.
// @Summary      Delete a task
// @Description  Permanently removes a task of the authenticated user's company.
// @Tags         tasks
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Task ID"
// @Success      204
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/tasks/{id}  [delete]
func (h *Handler) Delete(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	if err := h.repo.Delete(c.Request.Context(), u.CompanyID, c.Param("id")); err != nil {
		if errors.Is(err, errNotFound) {
			response.NotFound(c, "task not found")
			return
		}
		response.InternalErrorf(c, err, "failed to delete task")
		return
	}
	response.NoContent(c)
}

// RegisterRoutes wires task routes onto an authenticated router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.POST("", h.Create)
	rg.GET("/:id", h.Get)
	rg.PATCH("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
}

func clampInt(v string, minv, maxv, def int) int {
	n := def
	if v != "" {
		if x := parseInt(v); x > 0 {
			n = x
		}
	}
	if n < minv {
		n = minv
	}
	if n > maxv {
		n = maxv
	}
	return n
}

func parseInt(s string) int {
	if s == "" {
		return 0
	}
	n := 0
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0
		}
		n = n*10 + int(s[i]-'0')
		if n > 1_000_000_000 {
			return 0
		}
	}
	return n
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
