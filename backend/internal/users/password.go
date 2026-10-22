package users

import (
	"context"
	"database/sql"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8,max=128"`
}

// UpdatePasswordHash replaces the stored password hash of a user.
func (r *UserRepo) UpdatePasswordHash(ctx context.Context, userID, passwordHash string) error {
	_, err := r.q.Exec(ctx, "UPDATE users SET password_hash = $1 WHERE id = $2", passwordHash, userID)
	return err
}

// PasswordHashFor returns the stored password hash of a user.
func (r *UserRepo) PasswordHashFor(ctx context.Context, userID string) (string, error) {
	var hash string
	err := r.q.QueryRow(ctx, "SELECT password_hash FROM users WHERE id = $1", userID).Scan(&hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", errUserNotFound
		}
		return "", err
	}
	return hash, nil
}

// ChangePassword lets the authenticated user change their own password.
//
// The current password must be supplied, the new password must differ from it,
// and the stored refresh token is rotated on success so the session stays
// alive while any token captured before the change stops working.
func (h *Handler) ChangePassword(c *gin.Context) {
	var req changePasswordRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	u := middleware.AuthUserFromContext(c)
	ctx := c.Request.Context()

	hash, err := h.repo.PasswordHashFor(ctx, u.UserID)
	if err != nil {
		if errors.Is(err, errUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalErrorf(c, err, "failed to load account")
		return
	}

	ok, err := h.hasher.Verify(req.CurrentPassword, hash)
	if err != nil || !ok {
		response.BadRequest(c, "the current password is incorrect")
		return
	}

	// A new password that is identical to the old one is rejected, so the
	// change cannot be a no-op.
	same, err := h.hasher.Verify(req.NewPassword, hash)
	if err == nil && same {
		response.ValidationError(c, "validation failed", validation.FieldErrors{
			{Field: "new_password", Reason: "must be different from the current password"},
		})
		return
	}

	newHash, err := h.hasher.Hash(req.NewPassword)
	if err != nil {
		response.InternalErrorf(c, err, "failed to hash password")
		return
	}
	if err := h.repo.UpdatePasswordHash(ctx, u.UserID, newHash); err != nil {
		response.InternalErrorf(c, err, "failed to update password")
		return
	}

	// Rotate the session so the caller keeps working without a new sign-in.
	user, err := fetchUserByID(ctx, h.store, u.UserID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load account")
		return
	}
	access, refresh, err := h.issueTokens(c, user)
	if err != nil {
		response.InternalErrorf(c, err, "failed to issue token")
		return
	}
	if _, err := h.store.Exec(ctx, "UPDATE users SET refresh_token_hash = $1 WHERE id = $2", h.tokens.HashRefreshToken(refresh), user.ID); err != nil {
		response.InternalErrorf(c, err, "failed to persist refresh token")
		return
	}

	response.JSON(c, 200, authResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		TokenType:    "Bearer",
		ExpiresIn:    int64(h.tokens.AccessTTL().Seconds()),
		User:         user,
	})
}
