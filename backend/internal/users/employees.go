package users

import (
	"errors"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

type createEmployeeRequest struct {
	FullName string `json:"full_name" validate:"required"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
	Role     string `json:"role,omitempty" validate:"max=20"`
}

type updateUserRequest struct {
	FullName string `json:"full_name,omitempty" validate:"max=200"`
	Role     string `json:"role,omitempty" validate:"max=20"`
	IsActive *bool  `json:"is_active,omitempty"`
}

func validRole(role string) bool {
	return role == models.RoleAdmin || role == models.RoleEmployee
}

// ListEmployees returns all users of the caller's company.
// @Summary      List company users
// @Description  Returns all users belonging to the authenticated user's company. Administrators only.
// @Tags         users
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.ListResponse{data=[]models.User}
// @Failure      401  {object}  response.Error
// @Failure      403  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/users  [get]
func (h *Handler) ListEmployees(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	items, err := h.repo.ListByCompany(c.Request.Context(), u.CompanyID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list users")
		return
	}
	response.List(c, items, int64(len(items)), len(items), 0)
}

// CreateEmployee adds an employee to the caller's company.
// @Summary      Create an employee
// @Description  Adds a new user to the authenticated user's company. Administrators only.
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  createEmployeeRequest  true  "Employee payload"
// @Success      201  {object}  response.Success{data=models.User}
// @Failure      401  {object}  response.Error
// @Failure      403  {object}  response.Error
// @Failure      409  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/users  [post]
func (h *Handler) CreateEmployee(c *gin.Context) {
	var req createEmployeeRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role == "" {
		role = models.RoleEmployee
	}
	if !validRole(role) {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "role", Reason: "must be either 'admin' or 'employee'"},
		})
		return
	}
	pwHash, err := h.hasher.Hash(req.Password)
	if err != nil {
		response.InternalErrorf(c, err, "failed to hash password")
		return
	}
	u := middleware.AuthUserFromContext(c)
	user, err := h.repo.CreateEmployee(c.Request.Context(), u.CompanyID, req.FullName, strings.ToLower(strings.TrimSpace(req.Email)), pwHash, role)
	if err != nil {
		if errors.Is(err, errEmailExists) {
			response.Conflict(c, "email already registered")
			return
		}
		response.InternalErrorf(c, err, "failed to create user")
		return
	}
	response.Created(c, user)
}

// UpdateEmployee updates role, name or active state of a company user.
// @Summary      Update a company user
// @Description  Updates a user of the authenticated user's company. Administrators only.
// @Tags         users
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id    path  string  true  "User ID"
// @Param        body  body  updateUserRequest  true  "User update"
// @Success      200  {object}  response.Success{data=models.User}
// @Failure      401  {object}  response.Error
// @Failure      403  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/users/{id}  [patch]
func (h *Handler) UpdateEmployee(c *gin.Context) {
	id := c.Param("id")
	var req updateUserRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	u := middleware.AuthUserFromContext(c)

	var rolePtr *string
	if req.Role != "" {
		r := strings.ToLower(strings.TrimSpace(req.Role))
		if !validRole(r) {
			response.ValidationError(c, "validation failed", validation.FieldErrors{
				{Field: "role", Reason: "must be either 'admin' or 'employee'"},
			})
			return
		}
		rolePtr = &r
	}
	var namePtr *string
	if req.FullName != "" {
		namePtr = &req.FullName
	}

	// An administrator may not deactivate or demote themselves, which would
	// allow the last administrator to lock the company out.
	if id == u.UserID {
		if req.IsActive != nil && !*req.IsActive {
			response.Forbidden(c, "you cannot deactivate your own account")
			return
		}
		if rolePtr != nil && *rolePtr != models.RoleAdmin {
			response.Forbidden(c, "you cannot demote your own account")
			return
		}
	}

	user, err := h.repo.UpdateUser(c.Request.Context(), u.CompanyID, id, rolePtr, req.IsActive, namePtr)
	if err != nil {
		if errors.Is(err, errUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalErrorf(c, err, "failed to update user")
		return
	}
	response.JSON(c, 200, user)
}

// DeactivateEmployee deactivates a company user.
// @Summary      Deactivate a company user
// @Description  Marks a user of the authenticated user's company as inactive. Administrators only.
// @Tags         users
// @Produce      json
// @Security     BearerAuth
// @Param        id  path  string  true  "User ID"
// @Success      204
// @Failure      401  {object}  response.Error
// @Failure      403  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/users/{id}  [delete]
func (h *Handler) DeactivateEmployee(c *gin.Context) {
	id := c.Param("id")
	u := middleware.AuthUserFromContext(c)
	if id == u.UserID {
		response.Forbidden(c, "you cannot deactivate your own account")
		return
	}
	if err := h.repo.Deactivate(c.Request.Context(), u.CompanyID, id); err != nil {
		if errors.Is(err, errUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalErrorf(c, err, "failed to deactivate user")
		return
	}
	response.NoContent(c)
}

// RegisterUserRoutes wires user-management routes onto an authenticated group.
// Every route is administrator-only and always scoped to the caller's company.
func (h *Handler) RegisterUserRoutes(rg *gin.RouterGroup) {
	admin := middleware.RequireCompanyAdmin()
	rg.GET("", admin, h.ListEmployees)
	rg.POST("", admin, h.CreateEmployee)
	rg.PATCH("/:id", admin, h.UpdateEmployee)
	rg.DELETE("/:id", admin, h.DeactivateEmployee)
	// The assignee list is intentionally not administrator-only: every member
	// needs to resolve the assignee ids stored on CRM records.
	rg.GET("/assignees", h.ListAssignees)
}

var _ = auth.IsAdmin
