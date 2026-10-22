package users

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/response"
)

// Assignee is the minimal projection of a company member that the frontend
// needs to label a record: who owns it and what role they hold.
//
// It deliberately exposes no email address and no credential material, so the
// endpoint can be opened to every member of the company rather than to
// administrators only.
type Assignee struct {
	ID       string `json:"id"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

// ListAssignees returns the active members of the caller's company.
//
// The full user list under `GET /users` stays administrator-only because it
// exposes email addresses and activation state. Records across the CRM
// reference an assignee by id, so every member needs to be able to resolve
// those ids to a name; otherwise non-admin users see an empty "Assigned to"
// column for their colleagues' records.
func (r *UserRepo) ListAssignees(ctx context.Context, companyID string) ([]Assignee, error) {
	const q = `SELECT id, full_name, role FROM users
                WHERE company_id = $1 AND is_active = true
                ORDER BY full_name ASC`
	rows, err := r.q.Query(ctx, q, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Assignee{}
	for rows.Next() {
		var a Assignee
		if err := rows.Scan(&a.ID, &a.FullName, &a.Role); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListAssignees returns the active company members available for assignment.
// @Summary      List company assignees
// @Description  Returns the id, name and role of every active member of the authenticated user's company. Available to every company member, not only administrators.
// @Tags         users
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.ListResponse{data=[]Assignee}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/users/assignees  [get]
func (h *Handler) ListAssignees(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	items, err := h.repo.ListAssignees(c.Request.Context(), u.CompanyID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to list assignees")
		return
	}
	response.List(c, items, int64(len(items)), len(items), 0)
}
