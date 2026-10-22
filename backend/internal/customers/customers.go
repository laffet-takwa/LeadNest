// Package customers implements customer CRUD.
package customers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

var (
	errNotFound         = errors.New("customer not found")
	errAssigneeNotFound = errors.New("assignee not found")
)

type Repo struct {
	q database.Querier
}

func NewRepo(q database.Querier) *Repo {
	return &Repo{q: q}
}

// ListFilter captures the supported list query parameters.
type ListFilter struct {
	Search     string
	AssignedTo string
	Source     string
	Sort       string
	Order      string
	Limit      int
	Offset     int
}

func (r *Repo) List(ctx context.Context, companyID string, f ListFilter) ([]models.Customer, int64, error) {
	filters := []string{"company_id = $1"}
	args := []any{companyID}
	i := 2
	if f.Search != "" {
		s := "%" + strings.ToLower(f.Search) + "%"
		filters = append(filters, fmt.Sprintf(
			"(lower(full_name) LIKE $%d OR lower(company) LIKE $%d OR lower(email) LIKE $%d OR phone LIKE $%d)", i, i, i, i))
		args = append(args, s)
		i++
	}
	if f.AssignedTo != "" {
		filters = append(filters, fmt.Sprintf("assigned_to = $%d", i))
		args = append(args, f.AssignedTo)
		i++
	}
	if f.Source != "" {
		filters = append(filters, fmt.Sprintf("source = $%d", i))
		args = append(args, f.Source)
		i++
	}
	where := strings.Join(filters, " AND ")

	countQuery := "SELECT COUNT(*) FROM customers WHERE " + where
	var total int64
	if err := r.q.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// The sortable columns are whitelisted so the ORDER BY clause cannot be
	// influenced by request input.
	orderCol := map[string]string{
		"created_at": "created_at",
		"updated_at": "updated_at",
		"full_name":  "full_name",
		"company":    "company",
		"email":      "email",
		"source":     "source",
	}[f.Sort]
	if orderCol == "" {
		orderCol = "created_at"
	}
	orderDir := "DESC"
	if strings.EqualFold(f.Order, "asc") {
		orderDir = "ASC"
	}

	query := fmt.Sprintf(
		`SELECT id, company_id, assigned_to, full_name, company, email, phone, source, notes, created_at, updated_at
         FROM customers WHERE %s ORDER BY %s %s, full_name ASC LIMIT $%d OFFSET $%d`,
		where, orderCol, orderDir, i, i+1,
	)
	args = append(args, f.Limit, f.Offset)
	rows, err := r.q.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []models.Customer
	for rows.Next() {
		var c models.Customer
		var assigned, company, email, phone, source, notes *string
		if err := rows.Scan(&c.ID, &c.CompanyID, &assigned, &c.FullName, &company, &email, &phone,
			&source, &notes, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		c.AssignedTo = models.NullString(assigned)
		c.Company = models.NullString(company)
		c.Email = models.NullString(email)
		c.Phone = models.NullString(phone)
		c.Source = models.NullString(source)
		c.Notes = models.NullString(notes)
		out = append(out, c)
	}
	return out, total, rows.Err()
}

func (r *Repo) GetByID(ctx context.Context, companyID, id string) (models.Customer, error) {
	const q = `SELECT id, company_id, assigned_to, full_name, company, email, phone, source, notes, created_at, updated_at
                FROM customers WHERE company_id = $1 AND id = $2`
	c := models.Customer{}
	var assigned, company, email, phone, source, notes *string
	err := r.q.QueryRow(ctx, q, companyID, id).Scan(
		&c.ID, &c.CompanyID, &assigned, &c.FullName, &company, &email, &phone, &source, &notes,
		&c.CreatedAt, &c.UpdatedAt)
	c.AssignedTo = models.NullString(assigned)
	c.Company = models.NullString(company)
	c.Email = models.NullString(email)
	c.Phone = models.NullString(phone)
	c.Source = models.NullString(source)
	c.Notes = models.NullString(notes)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c, errNotFound
		}
		return c, err
	}
	return c, nil
}

// CustomerFields holds the writable customer columns.
type CustomerFields struct {
	AssignedTo string
	FullName   string
	Company    string
	Email      string
	Phone      string
	Source     string
	Notes      string
}

func (r *Repo) Create(ctx context.Context, companyID string, f CustomerFields) (models.Customer, error) {
	if err := r.assertAssignee(ctx, companyID, f.AssignedTo); err != nil {
		return models.Customer{}, err
	}
	const q = `INSERT INTO customers (company_id, assigned_to, full_name, company, email, phone, source, notes)
                VALUES ($1, $2::uuid, $3, $4::text, $5::text, $6::text, $7::text, $8::text)
                RETURNING id, company_id, assigned_to, full_name, company, email, phone, source, notes, created_at, updated_at`
	c := models.Customer{}
	var assigned, company, email, phone, source, notes *string
	err := r.q.QueryRow(ctx, q, companyID, nullIfEmpty(f.AssignedTo), f.FullName,
		nullIfEmpty(f.Company), nullIfEmpty(f.Email), nullIfEmpty(f.Phone),
		nullIfEmpty(f.Source), nullIfEmpty(f.Notes)).Scan(
		&c.ID, &c.CompanyID, &assigned, &c.FullName, &company, &email, &phone, &source, &notes,
		&c.CreatedAt, &c.UpdatedAt)
	c.AssignedTo = models.NullString(assigned)
	c.Company = models.NullString(company)
	c.Email = models.NullString(email)
	c.Phone = models.NullString(phone)
	c.Source = models.NullString(source)
	c.Notes = models.NullString(notes)
	if err != nil {
		return c, err
	}
	return c, nil
}

func (r *Repo) Update(ctx context.Context, companyID, id string, f CustomerFields) (models.Customer, error) {
	if err := r.assertAssignee(ctx, companyID, f.AssignedTo); err != nil {
		return models.Customer{}, err
	}
	const q = `UPDATE customers SET assigned_to = $1::uuid, full_name = $2, company = $3::text,
                     email = $4::text, phone = $5::text, source = $6::text, notes = $7::text
                WHERE company_id = $8 AND id = $9
                RETURNING id, company_id, assigned_to, full_name, company, email, phone, source, notes, created_at, updated_at`
	c := models.Customer{}
	var assigned, company, email, phone, source, notes *string
	err := r.q.QueryRow(ctx, q, nullIfEmpty(f.AssignedTo), f.FullName,
		nullIfEmpty(f.Company), nullIfEmpty(f.Email), nullIfEmpty(f.Phone),
		nullIfEmpty(f.Source), nullIfEmpty(f.Notes), companyID, id).Scan(
		&c.ID, &c.CompanyID, &assigned, &c.FullName, &company, &email, &phone, &source, &notes,
		&c.CreatedAt, &c.UpdatedAt,
	)
	c.AssignedTo = models.NullString(assigned)
	c.Company = models.NullString(company)
	c.Email = models.NullString(email)
	c.Phone = models.NullString(phone)
	c.Source = models.NullString(source)
	c.Notes = models.NullString(notes)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c, errNotFound
		}
		return c, err
	}
	return c, nil
}

// assertAssignee verifies that the assignee, when set, is an active employee
// of the same company. The users foreign key alone does not guarantee this.
func (r *Repo) assertAssignee(ctx context.Context, companyID, userID string) error {
	if userID == "" {
		return nil
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

func (r *Repo) Delete(ctx context.Context, companyID, id string) error {
	res, err := r.q.Exec(ctx, "DELETE FROM customers WHERE company_id = $1 AND id = $2", companyID, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errNotFound
	}
	return nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// CustomerWithDetails is a customer together with the related records the
// caller asked for.
type CustomerWithDetails struct {
	models.Customer
	Deals      []models.Deal     `json:"deals,omitempty"`
	Activities []models.Activity `json:"activities,omitempty"`
}

// ListDeals returns the deals of a customer, most recently created first.
func (r *Repo) ListDeals(ctx context.Context, companyID, customerID string) ([]models.Deal, error) {
	const q = `SELECT id, company_id, customer_id, assigned_to, title, description, value::text, currency,
                     status, expected_close, closed_at, created_at, updated_at
              FROM deals WHERE company_id = $1 AND customer_id = $2
              ORDER BY created_at DESC`
	rows, err := r.q.Query(ctx, q, companyID, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Deal{}
	for rows.Next() {
		var d models.Deal
		var assigned, description *string
		if err := rows.Scan(
			&d.ID, &d.CompanyID, &d.CustomerID, &assigned, &d.Title, &description, &d.Value,
			&d.Currency, &d.Status, &d.ExpectedClose, &d.ClosedAt, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, err
		}
		d.AssignedTo = models.NullString(assigned)
		d.Description = models.NullString(description)
		out = append(out, d)
	}
	return out, rows.Err()
}

// ListActivities returns the most recent activities of a customer.
func (r *Repo) ListActivities(ctx context.Context, companyID, customerID string, limit int) ([]models.Activity, error) {
	const q = `SELECT id, company_id, user_id, customer_id, deal_id, type,
                     COALESCE(subject, ''), COALESCE(description, ''),
                     occurred_at, created_at, updated_at
              FROM activities WHERE company_id = $1 AND customer_id = $2
              ORDER BY occurred_at DESC, created_at DESC LIMIT $3`
	rows, err := r.q.Query(ctx, q, companyID, customerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Activity{}
	for rows.Next() {
		var a models.Activity
		var customer, deal, subject, description *string
		if err := rows.Scan(
			&a.ID, &a.CompanyID, &a.UserID, &customer, &deal, &a.Type,
			&subject, &description, &a.OccurredAt, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		a.CustomerID = models.NullString(customer)
		a.DealID = models.NullString(deal)
		a.Subject = models.NullString(subject)
		a.Description = models.NullString(description)
		out = append(out, a)
	}
	return out, rows.Err()
}

// Handler
type Handler struct {
	repo *Repo
}

func NewHandler(repo *Repo) *Handler {
	return &Handler{repo: repo}
}

type createReq struct {
	AssignedTo string `json:"assigned_to,omitempty" validate:"uuid"`
	FullName   string `json:"full_name" validate:"required"`
	Company    string `json:"company,omitempty" validate:"max=200"`
	Email      string `json:"email,omitempty" validate:"email"`
	Phone      string `json:"phone,omitempty" validate:"phone"`
	Source     string `json:"source,omitempty" validate:"max=200"`
	Notes      string `json:"notes,omitempty" validate:"max=5000"`
}
type updateReq struct {
	AssignedTo string `json:"assigned_to,omitempty" validate:"uuid"`
	FullName   string `json:"full_name,omitempty"`
	Company    string `json:"company,omitempty" validate:"max=200"`
	Email      string `json:"email,omitempty" validate:"email"`
	Phone      string `json:"phone,omitempty" validate:"phone"`
	Source     string `json:"source,omitempty" validate:"max=200"`
	Notes      string `json:"notes,omitempty" validate:"max=5000"`
}

// fields converts the request payload into the writable repository fields.
func (r createReq) fields() CustomerFields {
	return CustomerFields{
		AssignedTo: r.AssignedTo,
		FullName:   r.FullName,
		Company:    r.Company,
		Email:      r.Email,
		Phone:      r.Phone,
		Source:     r.Source,
		Notes:      r.Notes,
	}
}

func (r updateReq) fields() CustomerFields {
	return CustomerFields{
		AssignedTo: r.AssignedTo,
		FullName:   r.FullName,
		Company:    r.Company,
		Email:      r.Email,
		Phone:      r.Phone,
		Source:     r.Source,
		Notes:      r.Notes,
	}
}

// List returns the customers of the caller's company.
// @Summary      List customers
// @Description  Returns a paginated, searchable and filterable list of customers for the authenticated user's company.
// @Tags         customers
// @Produce      json
// @Security     BearerAuth
// @Param        limit        query  int     false  "Page size"
// @Param        offset       query  int     false  "Page offset"
// @Param        search       query  string  false  "Search by name, email or phone"
// @Param        assigned_to  query  string  false  "Filter by assigned employee"
// @Param        source       query  string  false  "Filter by source"
// @Success      200  {object}  response.ListResponse{data=[]models.Customer}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers  [get]
func (h *Handler) List(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	f := ListFilter{
		Search:     c.Query("search"),
		AssignedTo: c.Query("assigned_to"),
		Source:     c.Query("source"),
		Sort:       c.Query("sort"),
		Order:      c.Query("order"),
		Limit:      clamp(c.Query("limit"), 1, 100, 10),
		Offset:     max(0, parseInt(c.Query("offset"))),
	}
	items, total, err := h.repo.List(c.Request.Context(), u.CompanyID, f)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list customers")
		return
	}
	response.List(c, items, total, f.Limit, f.Offset)
}

// Create creates a customer.
// @Summary      Create a customer
// @Description  Creates a customer for the authenticated user's company.
// @Tags         customers
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  createReq  true  "Customer payload"
// @Success      201  {object}  response.Success{data=models.Customer}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers  [post]
func (h *Handler) Create(c *gin.Context) {
	var req createReq
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	u := middleware.AuthUserFromContext(c)
	cust, err := h.repo.Create(c.Request.Context(), u.CompanyID, req.fields())
	if err != nil {
		if err == errAssigneeNotFound {
			response.NotFound(c, "assignee not found in this company")
			return
		}
		response.InternalErrorf(c, err, "failed to create customer")
		return
	}
	response.Created(c, cust)
}

// Get returns a single customer.
// @Summary      Get a customer
// @Description  Returns a customer of the authenticated user's company. Use the include parameter to also return the customer's deals and recent activities.
// @Tags         customers
// @Produce      json
// @Security     BearerAuth
// @Param        id       path   string  true   "Customer ID"
// @Param        include  query  string  false  "Comma separated related records to include: deals, activities"
// @Success      200  {object}  response.Success{data=CustomerWithDetails}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers/{id}  [get]
func (h *Handler) Get(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	id := c.Param("id")

	includeDeals, includeActivities, err := parseInclude(c.Query("include"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	cust, err := h.repo.GetByID(c.Request.Context(), u.CompanyID, id)
	if err != nil {
		if err == errNotFound {
			response.NotFound(c, "customer not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch customer")
		return
	}

	if !includeDeals && !includeActivities {
		response.JSON(c, 200, cust)
		return
	}

	details := CustomerWithDetails{Customer: cust}
	if includeDeals {
		deals, err := h.repo.ListDeals(c.Request.Context(), u.CompanyID, id)
		if err != nil {
			response.InternalErrorf(c, err, "failed to fetch customer deals")
			return
		}
		details.Deals = deals
	}
	if includeActivities {
		activities, err := h.repo.ListActivities(c.Request.Context(), u.CompanyID, id, 20)
		if err != nil {
			response.InternalErrorf(c, err, "failed to fetch customer activities")
			return
		}
		details.Activities = activities
	}
	response.JSON(c, 200, details)
}

// parseInclude reads the include query parameter.
func parseInclude(raw string) (deals bool, activities bool, err error) {
	if strings.TrimSpace(raw) == "" {
		return false, false, nil
	}
	for _, part := range strings.Split(raw, ",") {
		switch strings.ToLower(strings.TrimSpace(part)) {
		case "":
		case "deals":
			deals = true
		case "activities":
			activities = true
		default:
			return false, false, fmt.Errorf("unknown include value %q: use 'deals' and/or 'activities'", part)
		}
	}
	return deals, activities, nil
}

// Update updates a customer.
// @Summary      Update a customer
// @Description  Updates a customer of the authenticated user's company.
// @Tags         customers
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  string     true  "Customer ID"
// @Param        body  body  updateReq  true  "Customer update"
// @Success      200  {object}  response.Success{data=models.Customer}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers/{id}  [patch]
func (h *Handler) Update(c *gin.Context) {
	id := c.Param("id")
	var req updateReq
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	u := middleware.AuthUserFromContext(c)
	cust, err := h.repo.Update(c.Request.Context(), u.CompanyID, id, req.fields())
	if err != nil {
		if err == errNotFound {
			response.NotFound(c, "customer not found")
			return
		}
		if err == errAssigneeNotFound {
			response.NotFound(c, "assignee not found in this company")
			return
		}
		response.InternalErrorf(c, err, "failed to update customer")
		return
	}
	response.JSON(c, 200, cust)
}

// Delete removes a customer.
// @Summary      Delete a customer
// @Description  Permanently removes a customer of the authenticated user's company, together with its deals, tasks and activities.
// @Tags         customers
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "Customer ID"
// @Success      204
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/customers/{id}  [delete]
func (h *Handler) Delete(c *gin.Context) {
	id := c.Param("id")
	u := middleware.AuthUserFromContext(c)
	if err := h.repo.Delete(c.Request.Context(), u.CompanyID, id); err != nil {
		if err == errNotFound {
			response.NotFound(c, "customer not found")
			return
		}
		response.InternalErrorf(c, err, "failed to delete customer")
		return
	}
	response.NoContent(c)
}
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.List)
	rg.POST("", h.Create)
	rg.GET("/:id", h.Get)
	rg.PATCH("/:id", h.Update)
	rg.DELETE("/:id", h.Delete)
}

func clamp(v string, minv, maxv, def int) int {
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
	var n int
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			n = n*10 + int(s[i]-'0')
		} else {
			return 0
		}
	}
	return n
}
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
