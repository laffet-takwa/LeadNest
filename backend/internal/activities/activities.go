// Package activities implements the activity timeline.
package activities

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
	errNotFound         = errors.New("activity not found")
	errCustomerNotFound = errors.New("customer not found")
	errDealNotFound     = errors.New("deal not found")
)

// Types lists the supported activity types.
var Types = []string{
	models.ActCall, models.ActEmail, models.ActMeeting,
	models.ActNote, models.ActMessage, models.ActOther,
}

// IsValidType reports whether s is a supported activity type.
func IsValidType(s string) bool {
	for _, v := range Types {
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
	CustomerID string
	DealID     string
	UserID     string
	Type       string
	From       *time.Time
	To         *time.Time
	Limit      int
	Offset     int
}

func (r *Repo) List(ctx context.Context, companyID string, f ListFilter) ([]models.Activity, int64, error) {
	filters := []string{"company_id = $1"}
	args := []any{companyID}
	i := 2
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
	if f.UserID != "" {
		filters = append(filters, fmt.Sprintf("user_id = $%d", i))
		args = append(args, f.UserID)
		i++
	}
	if f.Type != "" {
		filters = append(filters, fmt.Sprintf("type = $%d", i))
		args = append(args, f.Type)
		i++
	}
	if f.From != nil {
		filters = append(filters, fmt.Sprintf("occurred_at >= $%d", i))
		args = append(args, *f.From)
		i++
	}
	if f.To != nil {
		filters = append(filters, fmt.Sprintf("occurred_at <= $%d", i))
		args = append(args, *f.To)
		i++
	}
	where := strings.Join(filters, " AND ")

	var total int64
	if err := r.q.QueryRow(ctx, "SELECT COUNT(*) FROM activities WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Activities are always returned in reverse chronological order.
	query := fmt.Sprintf(
		`SELECT id, company_id, user_id, customer_id, deal_id, type, subject, description,
                occurred_at, created_at, updated_at
         FROM activities WHERE %s ORDER BY occurred_at DESC, created_at DESC LIMIT $%d OFFSET $%d`,
		where, i, i+1,
	)
	args = append(args, f.Limit, f.Offset)
	rows, err := r.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []models.Activity{}
	for rows.Next() {
		var a models.Activity
		var customerID, dealID, subject, description *string
		if err := rows.Scan(
			&a.ID, &a.CompanyID, &a.UserID, &customerID, &dealID, &a.Type,
			&subject, &description, &a.OccurredAt, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		a.CustomerID = models.NullString(customerID)
		a.DealID = models.NullString(dealID)
		a.Subject = models.NullString(subject)
		a.Description = models.NullString(description)
		out = append(out, a)
	}
	return out, total, rows.Err()
}

func (r *Repo) GetByID(ctx context.Context, companyID, id string) (models.Activity, error) {
	const q = `SELECT id, company_id, user_id, customer_id, deal_id, type, subject, description,
                     occurred_at, created_at, updated_at
              FROM activities WHERE company_id = $1 AND id = $2`
	a := models.Activity{}
	var customerID, dealID, subject, description *string
	err := r.q.QueryRow(ctx, q, companyID, id).Scan(
		&a.ID, &a.CompanyID, &a.UserID, &customerID, &dealID, &a.Type,
		&subject, &description, &a.OccurredAt, &a.CreatedAt, &a.UpdatedAt,
	)
	a.CustomerID = models.NullString(customerID)
	a.DealID = models.NullString(dealID)
	a.Subject = models.NullString(subject)
	a.Description = models.NullString(description)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return a, errNotFound
		}
		return a, err
	}
	return a, nil
}

// Create records an activity. The user_id is always the authenticated caller.
func (r *Repo) Create(ctx context.Context, companyID, userID, customerID, dealID, actType, subject, description string, occurredAt *time.Time) (models.Activity, error) {
	if customerID != "" {
		if err := r.assertCustomer(ctx, companyID, customerID); err != nil {
			return models.Activity{}, err
		}
	}
	if dealID != "" {
		if err := r.assertDeal(ctx, companyID, dealID); err != nil {
			return models.Activity{}, err
		}
	}
	when := time.Now().UTC()
	if occurredAt != nil {
		when = *occurredAt
	}
	const q = `INSERT INTO activities (company_id, user_id, customer_id, deal_id, type, subject, description, occurred_at)
               VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6::text, $7::text, $8)
               RETURNING id, company_id, user_id, customer_id, deal_id, type, subject, description,
                         occurred_at, created_at, updated_at`
	a := models.Activity{}
	var cID, dID, outSubject, outDescription *string
	err := r.q.QueryRow(ctx, q, companyID, userID, nullIfEmpty(customerID), nullIfEmpty(dealID),
		actType, nullIfEmpty(subject), nullIfEmpty(description), when).Scan(
		&a.ID, &a.CompanyID, &a.UserID, &cID, &dID, &a.Type,
		&outSubject, &outDescription, &a.OccurredAt, &a.CreatedAt, &a.UpdatedAt,
	)
	a.CustomerID = models.NullString(cID)
	a.DealID = models.NullString(dID)
	a.Subject = models.NullString(outSubject)
	a.Description = models.NullString(outDescription)
	if err != nil {
		return a, err
	}
	return a, nil
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
	DealID      string  `json:"deal_id,omitempty" validate:"uuid"`
	Type        string  `json:"type" validate:"required"`
	Subject     string  `json:"subject,omitempty" validate:"max=255"`
	Description string  `json:"description,omitempty" validate:"max=10000"`
	OccurredAt  *string `json:"occurred_at,omitempty"`
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

// List returns activities for the caller's company.
// @Summary      List activities
// @Description  Returns activities of the authenticated user's company in reverse chronological order.
// @Tags         activities
// @Produce      json
// @Security     BearerAuth
// @Param        limit        query  int     false  "Page size"
// @Param        offset       query  int     false  "Page offset"
// @Param        customer_id  query  string  false  "Filter by customer"
// @Param        deal_id      query  string  false  "Filter by deal"
// @Param        user_id      query  string  false  "Filter by author"
// @Param        type         query  string  false  "Filter by activity type"
// @Param        from         query  string  false  "Lower bound on occurred_at"
// @Param        to           query  string  false  "Upper bound on occurred_at"
// @Success      200  {object}  response.ListResponse{data=[]models.Activity}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/activities  [get]
func (h *Handler) List(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	f := ListFilter{
		CustomerID: c.Query("customer_id"),
		DealID:     c.Query("deal_id"),
		UserID:     c.Query("user_id"),
		Type:       c.Query("type"),
		Limit:      clampInt(c.Query("limit"), 1, 100, 20),
		Offset:     maxInt(0, parseInt(c.Query("offset"))),
	}
	if f.Type != "" && !IsValidType(f.Type) {
		response.BadRequest(c, "invalid type filter")
		return
	}
	from, err := parseDateTime(c.Query("from"))
	if err != nil {
		response.BadRequest(c, "from must be an RFC3339 timestamp or YYYY-MM-DD date")
		return
	}
	to, err := parseDateTime(c.Query("to"))
	if err != nil {
		response.BadRequest(c, "to must be an RFC3339 timestamp or YYYY-MM-DD date")
		return
	}
	f.From, f.To = from, to

	items, total, err := h.repo.List(c.Request.Context(), u.CompanyID, f)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list activities")
		return
	}
	response.List(c, items, total, f.Limit, f.Offset)
}

// Get returns a single activity.
// @Summary      Get an activity
// @Description  Returns an activity of the authenticated user's company.
// @Tags         activities
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Activity ID"
// @Success      200  {object}  response.Success{data=models.Activity}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/activities/{id}  [get]
func (h *Handler) Get(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	a, err := h.repo.GetByID(c.Request.Context(), u.CompanyID, c.Param("id"))
	if err != nil {
		if errors.Is(err, errNotFound) {
			response.NotFound(c, "activity not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch activity")
		return
	}
	response.JSON(c, 200, a)
}

// ListForCustomer returns the timeline of a customer.
// @Summary      List customer activities
// @Description  Returns the activity timeline of a customer in reverse chronological order.
// @Tags         activities
// @Produce      json
// @Security     BearerAuth
// @Param        id     path   string  true   "Customer ID"
// @Param        limit  query  int     false  "Page size"
// @Param        offset query  int     false  "Page offset"
// @Success      200  {object}  response.ListResponse{data=[]models.Activity}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers/{id}/activities  [get]
func (h *Handler) ListForCustomer(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	customerID := c.Param("id")
	// Confirm the customer belongs to the caller's company before listing.
	if err := h.repo.assertCustomer(c.Request.Context(), u.CompanyID, customerID); err != nil {
		if errors.Is(err, errCustomerNotFound) {
			response.NotFound(c, "customer not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch activities")
		return
	}
	limit := clampInt(c.Query("limit"), 1, 100, 20)
	offset := maxInt(0, parseInt(c.Query("offset")))
	items, total, err := h.repo.List(c.Request.Context(), u.CompanyID, ListFilter{
		CustomerID: customerID,
		Limit:      limit,
		Offset:     offset,
	})
	if err != nil {
		response.InternalErrorf(c, err, "failed to list activities")
		return
	}
	response.List(c, items, total, limit, offset)
}

// CreateForCustomer records an activity against a customer.
// @Summary      Create a customer activity
// @Description  Records an activity on a customer timeline. The authenticated user is recorded as the author.
// @Tags         activities
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  string          true  "Customer ID"
// @Param        body  body  createRequest   true  "Activity payload"
// @Success      201  {object}  response.Success{data=models.Activity}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers/{id}/activities  [post]
func (h *Handler) CreateForCustomer(c *gin.Context) {
	var req createRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	actType := strings.ToLower(strings.TrimSpace(req.Type))
	if !IsValidType(actType) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "type", Reason: "must be one of call, email, meeting, note, message, other"},
		})
		return
	}
	var occurredAt *time.Time
	if req.OccurredAt != nil && *req.OccurredAt != "" {
		t, err := parseDateTime(*req.OccurredAt)
		if err != nil {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "occurred_at", Reason: "must be an RFC3339 timestamp or YYYY-MM-DD date"},
			})
			return
		}
		occurredAt = t
	}

	u := middleware.AuthUserFromContext(c)
	a, err := h.repo.Create(c.Request.Context(), u.CompanyID, u.UserID, c.Param("id"),
		req.DealID, actType, req.Subject, req.Description, occurredAt)
	if err != nil {
		switch {
		case errors.Is(err, errCustomerNotFound):
			response.NotFound(c, "customer not found")
		case errors.Is(err, errDealNotFound):
			response.NotFound(c, "deal not found")
		default:
			response.InternalErrorf(c, err, "failed to create activity")
		}
		return
	}
	response.Created(c, a)
}

// RegisterRoutes wires activity routes onto an authenticated router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.GET("/:id", h.Get)
}

// RegisterCustomerRoutes wires the customer-scoped activity routes.
func (h *Handler) RegisterCustomerRoutes(rg *gin.RouterGroup) {
	rg.GET("/:id/activities", h.ListForCustomer)
	rg.POST("/:id/activities", h.CreateForCustomer)
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
