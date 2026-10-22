// Package users implements user management and authentication handlers.
package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

var (
	errUserNotFound = errors.New("user not found")
	errEmailExists  = errors.New("email already registered")
)

type UserRepo struct {
	q database.Querier
}

func NewUserRepo(q database.Querier) *UserRepo {
	return &UserRepo{q: q}
}

// Register creates a company and its first administrator in a single transaction.
func (r *UserRepo) Register(ctx context.Context, tx database.Querier, companyName, companyEmail, companyPhone, companyWebsite, adminFullName, adminEmail, adminPasswordHash string) (*models.Company, *models.User, error) {
	var exists bool
	if err := tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", adminEmail).Scan(&exists); err != nil {
		return nil, nil, fmt.Errorf("check email: %w", err)
	}
	if exists {
		return nil, nil, errEmailExists
	}

	var companyID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO companies (name, email, phone, website)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
		companyName, nullIfEmpty(companyEmail), nullIfEmpty(companyPhone), nullIfEmpty(companyWebsite),
	).Scan(&companyID); err != nil {
		return nil, nil, fmt.Errorf("create company: %w", err)
	}

	var userID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO users (company_id, full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, 'admin', true)
         RETURNING id`,
		companyID, adminFullName, adminEmail, adminPasswordHash,
	).Scan(&userID); err != nil {
		return nil, nil, fmt.Errorf("create admin: %w", err)
	}

	company, err := fetchCompany(ctx, tx, companyID)
	if err != nil {
		return nil, nil, err
	}
	user, err := fetchUserByID(ctx, tx, userID)
	if err != nil {
		return nil, nil, err
	}
	return &company, &user, nil
}

// CreateEmployee adds an employee to a company.
func (r *UserRepo) CreateEmployee(ctx context.Context, companyID, fullName, email, passwordHash, role string) (models.User, error) {
	var exists bool
	if err := r.q.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email).Scan(&exists); err != nil {
		return models.User{}, err
	}
	if exists {
		return models.User{}, errEmailExists
	}
	var id string
	err := r.q.QueryRow(ctx,
		`INSERT INTO users (company_id, full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
		companyID, fullName, email, passwordHash, role,
	).Scan(&id)
	if err != nil {
		return models.User{}, err
	}
	return fetchUserByID(ctx, r.q, id)
}

// ListByCompany returns all users of a company.
func (r *UserRepo) ListByCompany(ctx context.Context, companyID string) ([]models.User, error) {
	const q = `SELECT id, company_id, full_name, email, role, is_active, created_at, updated_at
               FROM users WHERE company_id = $1 ORDER BY created_at ASC`
	rows, err := r.q.Query(ctx, q, companyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.CompanyID, &u.FullName, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// UpdateUser updates role and/or active state for a user in the given company.
func (r *UserRepo) UpdateUser(ctx context.Context, companyID, id string, role *string, isActive *bool, fullName *string) (models.User, error) {
	const q = `UPDATE users
               SET role = COALESCE($1, role),
                   is_active = COALESCE($2, is_active),
                   full_name = COALESCE($3, full_name)
               WHERE company_id = $4 AND id = $5
               RETURNING id, company_id, full_name, email, role, is_active, created_at, updated_at`
	var u models.User
	err := r.q.QueryRow(ctx, q, role, isActive, fullName, companyID, id).Scan(
		&u.ID, &u.CompanyID, &u.FullName, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return u, errUserNotFound
		}
		return u, err
	}
	return u, nil
}

// Deactivate marks a user inactive.
func (r *UserRepo) Deactivate(ctx context.Context, companyID, id string) error {
	res, err := r.q.Exec(ctx, "UPDATE users SET is_active = false WHERE company_id = $1 AND id = $2", companyID, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errUserNotFound
	}
	return nil
}

func fetchCompany(ctx context.Context, q database.Querier, id string) (models.Company, error) {
	var c models.Company
	var email, phone, website *string
	err := q.QueryRow(ctx,
		`SELECT id, name, email, phone, website, created_at, updated_at FROM companies WHERE id = $1`,
		id,
	).Scan(&c.ID, &c.Name, &email, &phone, &website, &c.CreatedAt, &c.UpdatedAt)
	c.Email = models.NullString(email)
	c.Phone = models.NullString(phone)
	c.Website = models.NullString(website)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c, errUserNotFound
		}
		return c, err
	}
	return c, nil
}

func fetchUserByID(ctx context.Context, q database.Querier, id string) (models.User, error) {
	var u models.User
	err := q.QueryRow(ctx,
		`SELECT id, company_id, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.CompanyID, &u.FullName, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return u, errUserNotFound
		}
		return u, err
	}
	return u, nil
}

func fetchUserByEmail(ctx context.Context, q database.Querier, email string) (models.User, string, error) {
	var u models.User
	var pwHash string
	err := q.QueryRow(ctx,
		`SELECT id, company_id, full_name, email, password_hash, role, is_active, created_at, updated_at FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.CompanyID, &u.FullName, &u.Email, &pwHash, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return u, "", errUserNotFound
		}
		return u, "", err
	}
	return u, pwHash, nil
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// --- Handlers ---

type Handler struct {
	store  *database.Store
	repo   *UserRepo
	hasher *auth.PasswordHasher
	tokens *auth.TokenManager
}

func NewHandler(store *database.Store, hasher *auth.PasswordHasher, tokens *auth.TokenManager) *Handler {
	return &Handler{
		store:  store,
		repo:   NewUserRepo(store),
		hasher: hasher,
		tokens: tokens,
	}
}

// LoadActiveUser implements middleware.UserLoader. It reads the authoritative
// user row so tenant scoping never depends on client-supplied values.
func (h *Handler) LoadActiveUser(ctx context.Context, id string) (middleware.UserRecord, error) {
	var rec middleware.UserRecord
	err := h.store.QueryRow(ctx,
		`SELECT id, company_id, role, email, is_active FROM users WHERE id = $1`,
		id,
	).Scan(&rec.ID, &rec.CompanyID, &rec.Role, &rec.Email, &rec.IsActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return rec, middleware.ErrUserNotFound
		}
		return rec, err
	}
	return rec, nil
}

type registerRequest struct {
	Company struct {
		Name    string `json:"name" validate:"required"`
		Email   string `json:"email,omitempty" validate:"email"`
		Phone   string `json:"phone,omitempty" validate:"phone"`
		Website string `json:"website,omitempty" validate:"max=2048"`
	} `json:"company"`
	Admin struct {
		FullName string `json:"full_name" validate:"required"`
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required,min=8"`
	} `json:"admin"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type authResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token,omitempty"`
	TokenType    string      `json:"token_type"`
	ExpiresIn    int64       `json:"expires_in"`
	User         models.User `json:"user"`
}

type meResponse struct {
	User models.User `json:"user"`
}

// Register creates a company and its first administrator in a transaction.
// @Summary      Register a company and administrator
// @Description  Creates a new company together with its first administrator inside a single transaction.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body  registerRequest  true  "Registration payload"
// @Success      201  {object}  response.Success{data=authResponse}
// @Failure      400  {object}  response.Error
// @Failure      409  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/auth/register  [post]
func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	adminEmail := strings.ToLower(strings.TrimSpace(req.Admin.Email))
	pwHash, err := h.hasher.Hash(req.Admin.Password)
	if err != nil {
		response.InternalErrorf(c, err, "failed to hash password")
		return
	}

	var res *authResponse
	err = h.store.RunInTx(c.Request.Context(), func(q database.Querier) error {
		_, user, err := h.repo.Register(c.Request.Context(), q,
			req.Company.Name,
			req.Company.Email,
			req.Company.Phone,
			req.Company.Website,
			req.Admin.FullName,
			adminEmail,
			pwHash,
		)
		if err != nil {
			return err
		}
		access, refresh, err := h.issueTokens(c, *user)
		if err != nil {
			return err
		}
		if _, err := q.Exec(c.Request.Context(), "UPDATE users SET refresh_token_hash = $1 WHERE id = $2", h.tokens.HashRefreshToken(refresh), user.ID); err != nil {
			return err
		}
		res = &authResponse{
			AccessToken:  access,
			RefreshToken: refresh,
			TokenType:    "Bearer",
			ExpiresIn:    int64(h.tokens.AccessTTL().Seconds()),
			User:         *user,
		}
		return nil
	})
	if err != nil {
		if errors.Is(err, errEmailExists) {
			response.Conflict(c, "email already registered")
			return
		}
		response.InternalErrorf(c, err, "failed to register")
		return
	}
	response.Created(c, res)
}

// Login verifies credentials and returns a token.
// @Summary      Log in
// @Description  Verifies email and password, rejects inactive accounts, and returns an access token.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body  loginRequest  true  "Credentials"
// @Success      200  {object}  response.Success{data=authResponse}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/auth/login  [post]
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	user, pwHash, err := fetchUserByEmail(c.Request.Context(), h.store, email)
	if err != nil {
		if errors.Is(err, errUserNotFound) {
			response.Unauthorized(c, "invalid credentials or inactive account")
			return
		}
		response.InternalErrorf(c, err, "failed to login")
		return
	}
	if !user.IsActive {
		response.Unauthorized(c, "invalid credentials or inactive account")
		return
	}
	ok, err := h.hasher.Verify(req.Password, pwHash)
	if err != nil || !ok {
		response.Unauthorized(c, "invalid credentials or inactive account")
		return
	}
	access, refresh, err := h.issueTokens(c, user)
	if err != nil {
		response.InternalErrorf(c, err, "failed to issue token")
		return
	}
	if _, err := h.store.Exec(c.Request.Context(), "UPDATE users SET refresh_token_hash = $1 WHERE id = $2", h.tokens.HashRefreshToken(refresh), user.ID); err != nil {
		response.InternalErrorf(c, err, "failed to persist refresh token")
		return
	}
	response.JSON(c, 200, &authResponse{
		AccessToken:  access,
		RefreshToken: refresh,
		TokenType:    "Bearer",
		ExpiresIn:    int64(h.tokens.AccessTTL().Seconds()),
		User:         user,
	})
}

// Me returns the current authenticated user (never the password hash).
// @Summary      Get current user
// @Description  Returns the authenticated user profile.
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      200  {object}  response.Success{data=meResponse}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/auth/me  [get]
func (h *Handler) Me(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	if u == nil {
		response.Unauthorized(c, "authentication required")
		return
	}
	user, err := fetchUserByID(c.Request.Context(), h.store, u.UserID)
	if err != nil {
		if errors.Is(err, errUserNotFound) {
			response.NotFound(c, "user not found")
			return
		}
		response.InternalErrorf(c, err, "failed to fetch user")
		return
	}
	response.JSON(c, 200, meResponse{User: user})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// Refresh issues a new access token when the refresh token is valid.
// @Summary      Refresh access token
// @Description  Exchanges a valid refresh token for a new access token.
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body  refreshRequest  true  "Refresh token"
// @Success      200  {object}  response.Success{data=authResponse}
// @Failure      401  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/auth/refresh  [post]
func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	hashed := h.tokens.HashRefreshToken(req.RefreshToken)
	var user models.User
	var storedHash *string
	err := h.store.QueryRow(c.Request.Context(),
		`SELECT id, company_id, full_name, email, role, is_active, created_at, updated_at, refresh_token_hash
         FROM users WHERE refresh_token_hash = $1`,
		hashed,
	).Scan(&user.ID, &user.CompanyID, &user.FullName, &user.Email, &user.Role, &user.IsActive, &user.CreatedAt, &user.UpdatedAt, &storedHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.Unauthorized(c, "invalid or expired refresh token")
			return
		}
		response.InternalErrorf(c, err, "failed to refresh token")
		return
	}
	if storedHash == nil || *storedHash != hashed {
		response.Unauthorized(c, "invalid or expired refresh token")
		return
	}
	if !user.IsActive {
		response.Unauthorized(c, "account is inactive")
		return
	}
	access, err := h.tokens.AccessToken(c.Request.Context(), auth.TokenClaims{
		UserID:    user.ID,
		CompanyID: user.CompanyID,
		Role:      user.Role,
		Email:     user.Email,
	})
	if err != nil {
		response.InternalErrorf(c, err, "failed to issue token")
		return
	}
	response.JSON(c, 200, authResponse{
		AccessToken: access,
		TokenType:   "Bearer",
		ExpiresIn:   int64(h.tokens.AccessTTL().Seconds()),
		User:        user,
	})
}

// Logout revokes the stored refresh token.
// @Summary      Log out
// @Description  Revokes the refresh token associated with the authenticated user.
// @Tags         auth
// @Produce      json
// @Security     BearerAuth
// @Success      204
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/auth/logout  [post]
func (h *Handler) Logout(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	if u == nil {
		response.Unauthorized(c, "authentication required")
		return
	}
	if _, err := h.store.Exec(c.Request.Context(), "UPDATE users SET refresh_token_hash = NULL WHERE id = $1", u.UserID); err != nil {
		response.InternalErrorf(c, err, "failed to logout")
		return
	}
	response.NoContent(c)
}

func (h *Handler) issueTokens(c *gin.Context, user models.User) (string, string, error) {
	access, err := h.tokens.AccessToken(c.Request.Context(), auth.TokenClaims{
		UserID:    user.ID,
		CompanyID: user.CompanyID,
		Role:      user.Role,
		Email:     user.Email,
	})
	if err != nil {
		return "", "", err
	}
	refresh, err := h.tokens.RefreshToken(c.Request.Context())
	if err != nil {
		return "", "", err
	}
	return access, refresh, nil
}

// RegisterRoutes wires auth routes onto the public router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/register", h.Register)
	rg.POST("/login", h.Login)
	rg.POST("/refresh", h.Refresh)
}
