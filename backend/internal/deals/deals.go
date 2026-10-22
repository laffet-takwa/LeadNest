// Package deals implements sales-deal CRUD with status transitions.
package deals

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
	errNotFound         = errors.New("deal not found")
	errCustomerNotFound = errors.New("customer not found")
	errAssigneeNotFound = errors.New("assignee not found")
)

// Statuses lists the deal statuses supported by the schema.
var Statuses = []string{
	models.DealNew, models.DealContacted, models.DealQualified,
	models.DealProposal, models.DealNegotiation, models.DealWon, models.DealLost,
}

// IsValidStatus reports whether s is a supported deal status.
func IsValidStatus(s string) bool {
	for _, v := range Statuses {
		if v == s {
			return true
		}
	}
	return false
}

// IsClosed reports whether a status is a terminal one (won/lost).
func IsClosed(s string) bool {
	return s == models.DealWon || s == models.DealLost
}

type Repo struct {
	q database.Querier
}

func NewRepo(q database.Querier) *Repo {
	return &Repo{q: q}
}

// ListFilter captures the supported list query parameters.
type ListFilter struct {
	Search            string
	Status            string
	AssignedTo        string
	CustomerID        string
	ExpectedCloseFrom *string
	ExpectedCloseTo   *string
	Sort              string
	Order             string
	Limit             int
	Offset            int
}

// DealWithCustomer is a deal enriched with its parent customer name.
type DealWithCustomer struct {
	models.Deal
	CustomerName string `json:"customer_name,omitempty"`
}

func (r *Repo) List(ctx context.Context, companyID string, f ListFilter) ([]DealWithCustomer, int64, error) {
	filters := []string{"d.company_id = $1"}
	args := []any{companyID}
	i := 2
	if f.Search != "" {
		s := "%" + strings.ToLower(f.Search) + "%"
		filters = append(filters, fmt.Sprintf("(lower(d.title) LIKE $%d OR lower(c.full_name) LIKE $%d)", i, i))
		args = append(args, s)
		i++
	}
	if f.Status != "" {
		filters = append(filters, fmt.Sprintf("d.status = $%d", i))
		args = append(args, f.Status)
		i++
	}
	if f.AssignedTo != "" {
		filters = append(filters, fmt.Sprintf("d.assigned_to = $%d", i))
		args = append(args, f.AssignedTo)
		i++
	}
	if f.CustomerID != "" {
		filters = append(filters, fmt.Sprintf("d.customer_id = $%d", i))
		args = append(args, f.CustomerID)
		i++
	}
	if f.ExpectedCloseFrom != nil {
		filters = append(filters, fmt.Sprintf("d.expected_close >= $%d", i))
		args = append(args, *f.ExpectedCloseFrom)
		i++
	}
	if f.ExpectedCloseTo != nil {
		filters = append(filters, fmt.Sprintf("d.expected_close <= $%d", i))
		args = append(args, *f.ExpectedCloseTo)
		i++
	}
	where := strings.Join(filters, " AND ")

	var total int64
	if err := r.q.QueryRow(ctx,
		"SELECT COUNT(*) FROM deals d JOIN customers c ON c.id = d.customer_id WHERE "+where,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Whitelist sortable columns to avoid SQL injection through ORDER BY.
	orderCol := map[string]string{
		"created_at":     "d.created_at",
		"updated_at":     "d.updated_at",
		"title":          "d.title",
		"value":          "d.value",
		"expected_close": "d.expected_close",
		"status":         "d.status",
	}[f.Sort]
	if orderCol == "" {
		orderCol = "d.created_at"
	}
	orderDir := "DESC"
	if strings.EqualFold(f.Order, "asc") {
		orderDir = "ASC"
	}

	query := fmt.Sprintf(
		`SELECT d.id, d.company_id, d.customer_id, d.assigned_to, d.title, d.description, d.value::text,
                d.currency, d.status, d.expected_close, d.closed_at, d.created_at, d.updated_at,
                c.full_name
         FROM deals d JOIN customers c ON c.id = d.customer_id
         WHERE %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, orderCol, orderDir, i, i+1,
	)
	args = append(args, f.Limit, f.Offset)
	rows, err := r.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []DealWithCustomer{}
	for rows.Next() {
		var d DealWithCustomer
		var assigned, description *string
		if err := rows.Scan(
			&d.ID, &d.CompanyID, &d.CustomerID, &assigned, &d.Title, &description, &d.Value,
			&d.Currency, &d.Status, &d.ExpectedClose, &d.ClosedAt, &d.CreatedAt, &d.UpdatedAt,
			&d.CustomerName,
		); err != nil {
			return nil, 0, err
		}
		d.AssignedTo = models.NullString(assigned)
		d.Description = models.NullString(description)
		out = append(out, d)
	}
	return out, total, rows.Err()
}

func (r *Repo) GetByID(ctx context.Context, companyID, id string) (models.Deal, error) {
	const q = `SELECT id, company_id, customer_id, assigned_to, title, description, value::text, currency,
                     status, expected_close, closed_at, created_at, updated_at
              FROM deals WHERE company_id = $1 AND id = $2`
	d := models.Deal{}
	var assigned, description *string
	err := r.q.QueryRow(ctx, q, companyID, id).Scan(
		&d.ID, &d.CompanyID, &d.CustomerID, &assigned, &d.Title, &description, &d.Value,
		&d.Currency, &d.Status, &d.ExpectedClose, &d.ClosedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	d.AssignedTo = models.NullString(assigned)
	d.Description = models.NullString(description)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return d, errNotFound
		}
		return d, err
	}
	return d, nil
}

// Create inserts a new deal. The customer and assignee are validated to
// belong to the same company as the deal.
// DealFields holds the writable deal columns.
type DealFields struct {
	CustomerID    string
	AssignedTo    string
	Title         string
	Description   string
	Value         string
	Currency      string
	Status        string
	ExpectedClose *time.Time
}

// Create inserts a new deal. The customer and assignee are validated to
// belong to the same company as the deal.
func (r *Repo) Create(ctx context.Context, companyID string, f DealFields) (models.Deal, error) {
	if err := r.assertCustomer(ctx, companyID, f.CustomerID); err != nil {
		return models.Deal{}, err
	}
	if f.AssignedTo != "" {
		if err := r.assertUser(ctx, companyID, f.AssignedTo); err != nil {
			return models.Deal{}, err
		}
	}
	closedAt := any(nil)
	if IsClosed(f.Status) {
		closedAt = time.Now().UTC()
	}
	const q = `INSERT INTO deals (company_id, customer_id, assigned_to, title, description, value, currency, status, expected_close, closed_at)
               VALUES ($1, $2, $3::uuid, $4, $5::text, $6, $7, $8, $9::date, $10::timestamptz)
               RETURNING id, company_id, customer_id, assigned_to, title, description, value::text, currency,
                         status, expected_close, closed_at, created_at, updated_at`
	d := models.Deal{}
	var assigned, description *string
	err := r.q.QueryRow(ctx, q, companyID, f.CustomerID, nullIfEmpty(f.AssignedTo), f.Title,
		nullIfEmpty(f.Description), f.Value, f.Currency, f.Status, f.ExpectedClose, closedAt).Scan(
		&d.ID, &d.CompanyID, &d.CustomerID, &assigned, &d.Title, &description, &d.Value,
		&d.Currency, &d.Status, &d.ExpectedClose, &d.ClosedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	d.AssignedTo = models.NullString(assigned)
	d.Description = models.NullString(description)
	if err != nil {
		return d, err
	}
	return d, nil
}

// Update applies a partial update and records closed_at on terminal transitions.
func (r *Repo) Update(ctx context.Context, companyID, id string, f UpdateFields) (models.Deal, error) {
	current, err := r.GetByID(ctx, companyID, id)
	if err != nil {
		return models.Deal{}, err
	}
	if f.CustomerID != nil && *f.CustomerID != "" && *f.CustomerID != current.CustomerID {
		if err := r.assertCustomer(ctx, companyID, *f.CustomerID); err != nil {
			return models.Deal{}, err
		}
	}
	if f.AssignedTo != nil && *f.AssignedTo != "" && *f.AssignedTo != current.AssignedTo {
		if err := r.assertUser(ctx, companyID, *f.AssignedTo); err != nil {
			return models.Deal{}, err
		}
	}
	if f.Status != nil && *f.Status != "" {
		if !IsValidStatus(*f.Status) {
			return models.Deal{}, fmt.Errorf("invalid status %q", *f.Status)
		}
	}
	// A deal that moves into a terminal state gets a closing timestamp; a deal
	// that is reopened gets it cleared. Without a status change the existing
	// value is preserved.
	setClosed := f.Status != nil && IsClosed(*f.Status) && current.ClosedAt == nil
	clearClosed := f.Status != nil && !IsClosed(*f.Status)
	var closedAt any
	if setClosed {
		closedAt = time.Now().UTC()
	}

	const q = `UPDATE deals SET
                 customer_id = COALESCE($1, customer_id),
                 assigned_to = COALESCE($2::uuid, assigned_to),
                 title = COALESCE($3, title),
                 description = COALESCE($4::text, description),
                 value = COALESCE($5, value),
                 currency = COALESCE($6, currency),
                 status = COALESCE($7, status),
                 expected_close = COALESCE($8::date, expected_close),
                 closed_at = CASE WHEN $9 THEN $10::timestamptz
                                  WHEN $11 THEN NULL
                                  ELSE closed_at END
               WHERE company_id = $12 AND id = $13
               RETURNING id, company_id, customer_id, assigned_to, title, description, value::text, currency,
                         status, expected_close, closed_at, created_at, updated_at`
	d := models.Deal{}
	var assigned, description *string
	err = r.q.QueryRow(ctx, q,
		f.CustomerID, f.AssignedTo, f.Title, f.Description, f.Value, f.Currency, f.Status, f.ExpectedClose,
		setClosed, closedAt, clearClosed, companyID, id,
	).Scan(
		&d.ID, &d.CompanyID, &d.CustomerID, &assigned, &d.Title, &description, &d.Value,
		&d.Currency, &d.Status, &d.ExpectedClose, &d.ClosedAt, &d.CreatedAt, &d.UpdatedAt,
	)
	d.AssignedTo = models.NullString(assigned)
	d.Description = models.NullString(description)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return d, errNotFound
		}
		return d, err
	}
	return d, nil
}

// UpdateFields holds the optional fields of a deal update.
type UpdateFields struct {
	CustomerID    *string
	AssignedTo    *string
	Title         *string
	Description   *string
	Value         *string
	Currency      *string
	Status        *string
	ExpectedClose *time.Time
}

func (r *Repo) Delete(ctx context.Context, companyID, id string) error {
	res, err := r.q.Exec(ctx, "DELETE FROM deals WHERE company_id = $1 AND id = $2", companyID, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func (r *Repo) assertCustomer(ctx context.Context, companyID, customerID string) error {
	if customerID == "" {
		return errCustomerNotFound
	}
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
	CustomerID    string  `json:"customer_id" validate:"required,uuid"`
	AssignedTo    string  `json:"assigned_to,omitempty" validate:"uuid"`
	Title         string  `json:"title" validate:"required,max=255"`
	Description   string  `json:"description,omitempty" validate:"max=5000"`
	Value         string  `json:"value" validate:"required"`
	Currency      string  `json:"currency,omitempty" validate:"currency"`
	Status        string  `json:"status,omitempty" validate:"max=20"`
	ExpectedClose *string `json:"expected_close,omitempty"`
}

type updateRequest struct {
	CustomerID    *string `json:"customer_id,omitempty" validate:"uuid"`
	AssignedTo    *string `json:"assigned_to,omitempty" validate:"uuid"`
	Title         *string `json:"title,omitempty" validate:"max=255"`
	Description   *string `json:"description,omitempty" validate:"max=5000"`
	Value         *string `json:"value,omitempty"`
	Currency      *string `json:"currency,omitempty" validate:"currency"`
	Status        *string `json:"status,omitempty" validate:"max=20"`
	ExpectedClose *string `json:"expected_close,omitempty"`
}

func parseDate(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List returns deals for the caller's company.
// @Summary      List deals
// @Description  Returns a paginated, filtered and sorted list of deals for the authenticated user's company.
// @Tags         deals
// @Produce      json
// @Security     BearerAuth
// @Param        limit          query  int     false  "Page size"
// @Param        offset         query  int     false  "Page offset"
// @Param        search         query  string  false  "Search by title or customer name"
// @Param        status         query  string  false  "Filter by status"
// @Param        assigned_to    query  string  false  "Filter by assigned employee"
// @Param        customer_id    query  string  false  "Filter by customer"
// @Param        expected_close_from query string false "Expected close date lower bound (YYYY-MM-DD)"
// @Param        expected_close_to   query string false "Expected close date upper bound (YYYY-MM-DD)"
// @Param        sort           query  string  false  "Sort field"
// @Param        order          query  string  false  "Sort order (asc/desc)"
// @Success      200  {object}  response.ListResponse{data=[]DealWithCustomer}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/deals  [get]
func (h *Handler) List(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	f := ListFilter{
		Search:     c.Query("search"),
		Status:     c.Query("status"),
		AssignedTo: c.Query("assigned_to"),
		CustomerID: c.Query("customer_id"),
		Sort:       c.Query("sort"),
		Order:      c.Query("order"),
		Limit:      clampInt(c.Query("limit"), 1, 100, 20),
		Offset:     maxInt(0, parseInt(c.Query("offset"))),
	}
	if f.Status != "" && !IsValidStatus(f.Status) {
		response.BadRequest(c, "invalid status filter")
		return
	}
	from, err := parseDate(c.Query("expected_close_from"))
	if err != nil {
		response.BadRequest(c, "expected_close_from must be a YYYY-MM-DD date")
		return
	}
	to, err := parseDate(c.Query("expected_close_to"))
	if err != nil {
		response.BadRequest(c, "expected_close_to must be a YYYY-MM-DD date")
		return
	}
	if from != nil {
		s := from.Format("2006-01-02")
		f.ExpectedCloseFrom = &s
	}
	if to != nil {
		s := to.Format("2006-01-02")
		f.ExpectedCloseTo = &s
	}

	items, total, err := h.repo.List(c.Request.Context(), u.CompanyID, f)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list deals")
		return
	}
	response.List(c, items, total, f.Limit, f.Offset)
}

// Create creates a deal.
// @Summary      Create a deal
// @Description  Creates a deal linked to a customer of the authenticated user's company.
// @Tags         deals
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  createRequest  true  "Deal payload"
// @Success      201  {object}  response.Success{data=models.Deal}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/deals  [post]
func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	value, errs := validateAmount(req.Value)
	if len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	currency := strings.ToUpper(strings.TrimSpace(req.Currency))
	if currency == "" {
		currency = "TND"
	}
	if !validation.Currency(currency) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "currency", Reason: "must be a 3-letter ISO 4217 code"},
		})
		return
	}
	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = models.DealNew
	}
	if !IsValidStatus(status) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "status", Reason: "is not a supported deal status"},
		})
		return
	}
	var expectedClose *time.Time
	if req.ExpectedClose != nil && *req.ExpectedClose != "" {
		t, err := parseDate(*req.ExpectedClose)
		if err != nil {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "expected_close", Reason: "must be a YYYY-MM-DD date"},
			})
			return
		}
		expectedClose = t
	}

	u := middleware.AuthUserFromContext(c)
	deal, err := h.repo.Create(c.Request.Context(), u.CompanyID, DealFields{
		CustomerID:    req.CustomerID,
		AssignedTo:    req.AssignedTo,
		Title:         req.Title,
		Description:   req.Description,
		Value:         value,
		Currency:      currency,
		Status:        status,
		ExpectedClose: expectedClose,
	})
	if err != nil {
		switch {
		case errors.Is(err, errCustomerNotFound):
			response.NotFound(c, "customer not found")
		case errors.Is(err, errAssigneeNotFound):
			response.NotFound(c, "assignee not found in this company")
		default:
			response.InternalErrorf(c, err, "failed to create deal")
		}
		return
	}
	response.Created(c, deal)
}

// Get returns a single deal.
// @Summary      Get a deal
// @Description  Returns a deal of the authenticated user's company.
// @Tags         deals
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Deal ID"
// @Success      200  {object}  response.Success{data=models.Deal}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/deals/{id}  [get]
func (h *Handler) Get(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	deal, err := h.repo.GetByID(c.Request.Context(), u.CompanyID, c.Param("id"))
	if err != nil {
		if errors.Is(err, errNotFound) {
			response.NotFound(c, "deal not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch deal")
		return
	}
	response.JSON(c, 200, deal)
}

// Update updates a deal.
// @Summary      Update a deal
// @Description  Updates a deal. Moving to won or lost records the closing timestamp.
// @Tags         deals
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  string  true  "Deal ID"
// @Param        body  body  updateRequest  true  "Deal update"
// @Success      200  {object}  response.Success{data=models.Deal}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/deals/{id}  [patch]
func (h *Handler) Update(c *gin.Context) {
	var req updateRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	f := UpdateFields{
		CustomerID:  req.CustomerID,
		AssignedTo:  req.AssignedTo,
		Title:       req.Title,
		Description: req.Description,
	}
	if req.Value != nil {
		value, errs := validateAmount(*req.Value)
		if len(errs) > 0 {
			response.ValidationError(c, "validation failed", errs)
			return
		}
		f.Value = &value
	}
	if req.Currency != nil && *req.Currency != "" {
		cur := strings.ToUpper(strings.TrimSpace(*req.Currency))
		if !validation.Currency(cur) {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "currency", Reason: "must be a 3-letter ISO 4217 code"},
			})
			return
		}
		f.Currency = &cur
	}
	if req.Status != nil && *req.Status != "" {
		st := strings.ToLower(strings.TrimSpace(*req.Status))
		if !IsValidStatus(st) {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "status", Reason: "is not a supported deal status"},
			})
			return
		}
		f.Status = &st
	}
	if req.ExpectedClose != nil && *req.ExpectedClose != "" {
		t, err := parseDate(*req.ExpectedClose)
		if err != nil {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "expected_close", Reason: "must be a YYYY-MM-DD date"},
			})
			return
		}
		f.ExpectedClose = t
	}

	u := middleware.AuthUserFromContext(c)
	deal, err := h.repo.Update(c.Request.Context(), u.CompanyID, c.Param("id"), f)
	if err != nil {
		switch {
		case errors.Is(err, errNotFound):
			response.NotFound(c, "deal not found")
		case errors.Is(err, errCustomerNotFound):
			response.NotFound(c, "customer not found")
		case errors.Is(err, errAssigneeNotFound):
			response.NotFound(c, "assignee not found in this company")
		default:
			response.InternalErrorf(c, err, "failed to update deal")
		}
		return
	}
	response.JSON(c, 200, deal)
}

// Delete removes a deal.
// @Summary      Delete a deal
// @Description  Permanently removes a deal of the authenticated user's company.
// @Tags         deals
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Deal ID"
// @Success      204
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/deals/{id}  [delete]
func (h *Handler) Delete(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	if err := h.repo.Delete(c.Request.Context(), u.CompanyID, c.Param("id")); err != nil {
		if errors.Is(err, errNotFound) {
			response.NotFound(c, "deal not found")
			return
		}
		response.InternalErrorf(c, err, "failed to delete deal")
		return
	}
	response.NoContent(c)
}

// RegisterRoutes wires deal routes onto an authenticated router group.
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
