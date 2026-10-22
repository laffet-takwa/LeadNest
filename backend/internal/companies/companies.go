// Package companies implements company management.
package companies

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

var errNotFound = errors.New("company not found")

type CompanyRepo struct {
	q database.Querier
}

func NewCompanyRepo(q database.Querier) *CompanyRepo {
	return &CompanyRepo{q: q}
}

func (r *CompanyRepo) GetByID(ctx context.Context, id string) (models.Company, error) {
	const q = `SELECT id, name, email, phone, website, created_at, updated_at
                FROM companies WHERE id = $1`
	c := models.Company{}
	var email, phone, website *string
	err := r.q.QueryRow(ctx, q, id).Scan(
		&c.ID, &c.Name, &email, &phone, &website, &c.CreatedAt, &c.UpdatedAt,
	)
	c.Email = models.NullString(email)
	c.Phone = models.NullString(phone)
	c.Website = models.NullString(website)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c, errNotFound
		}
		return c, fmt.Errorf("get company: %w", err)
	}
	return c, nil
}

func (r *CompanyRepo) Update(ctx context.Context, id, name, email, phone, website string) (models.Company, error) {
	const q = `UPDATE companies SET name = $1, email = $2, phone = $3, website = $4
                WHERE id = $5
                RETURNING id, name, email, phone, website, created_at, updated_at`
	c := models.Company{}
	var outEmail, outPhone, outWebsite *string
	err := r.q.QueryRow(ctx, q, name, nullIfEmpty(email), nullIfEmpty(phone), nullIfEmpty(website), id).Scan(
		&c.ID, &c.Name, &outEmail, &outPhone, &outWebsite, &c.CreatedAt, &c.UpdatedAt,
	)
	c.Email = models.NullString(outEmail)
	c.Phone = models.NullString(outPhone)
	c.Website = models.NullString(outWebsite)
	if err != nil {
		return c, fmt.Errorf("update company: %w", err)
	}
	return c, nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// --- Handlers ---

type Handler struct {
	repo *CompanyRepo
}

func NewHandler(repo *CompanyRepo) *Handler {
	return &Handler{repo: repo}
}

type getMeResponse struct {
	Company models.Company `json:"company"`
}

// GetMe returns the authenticated user's company.
// @Summary      Get current company
// @Description  Returns the company of the authenticated user.
// @Tags         companies
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.Success{data=getMeResponse}
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/companies/me  [get]
func (h *Handler) GetMe(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	company, err := h.repo.GetByID(c.Request.Context(), u.CompanyID)
	if err != nil {
		if err == errNotFound {
			response.NotFound(c, "company not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch company")
		return
	}
	response.JSON(c, 200, getMeResponse{Company: company})
}

type updateMeRequest struct {
	Name    string `json:"name" validate:"required,min=1,max=200"`
	Email   string `json:"email,omitempty" validate:"email"`
	Phone   string `json:"phone,omitempty" validate:"phone"`
	Website string `json:"website,omitempty" validate:"max=2048"`
}

// PatchMe updates the authenticated user's company.
// @Summary      Update current company
// @Description  Allows administrators to update their company's name, email, phone, and website.
// @Tags         companies
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  updateMeRequest  true  "Company update"
// @Success      200  {object}  response.Success{data=models.Company}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      403  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/companies/me  [patch]
func (h *Handler) PatchMe(c *gin.Context) {
	var req updateMeRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	u := middleware.AuthUserFromContext(c)
	company, err := h.repo.Update(c.Request.Context(), u.CompanyID, req.Name, req.Email, req.Phone, req.Website)
	if err != nil {
		if err == errNotFound {
			response.NotFound(c, "company not found")
			return
		}
		response.InternalErrorf(c, err, "failed to update company")
		return
	}
	response.JSON(c, 200, company)
}

// RegisterRoutes wires company routes onto an authenticated router group.
//
// Reading the company is allowed for any member of the company; changing it is
// restricted to administrators.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/me", h.GetMe)
	rg.PATCH("/me", middleware.RequireCompanyAdmin(), h.PatchMe)
}
