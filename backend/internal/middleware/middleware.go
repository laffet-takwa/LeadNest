// Package middleware provides HTTP middleware for the LeadNest API.
package middleware

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/response"
)

// AuthUser is the authenticated user stored on the gin.Context.
// CompanyID is always read from the verified database record, never from a
// client-supplied header, query parameter, or request body.
type AuthUser struct {
	UserID    string
	CompanyID string
	Role      string
	Email     string
}

// UserRecord is the verified user row used for authorization decisions.
type UserRecord struct {
	ID        string
	CompanyID string
	Role      string
	Email     string
	IsActive  bool
}

// UserLoader loads a user by id from the authoritative database.
type UserLoader interface {
	LoadActiveUser(ctx context.Context, id string) (UserRecord, error)
}

// ErrUserNotFound is returned by a UserLoader when the id does not exist.
var ErrUserNotFound = errors.New("user not found")

const userKey = "leadnest.auth.user"

// RequireAuth validates the Authorization: Bearer <token> header, confirms the
// referenced account still exists and is active, and injects the verified user
// into the request context.
func RequireAuth(tm *auth.TokenManager, loader UserLoader) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			response.Unauthorized(c, "missing or malformed Authorization header")
			c.Abort()
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
		claims, err := tm.VerifyAccessToken(c.Request.Context(), token)
		if err != nil {
			response.Unauthorized(c, "invalid or expired token")
			c.Abort()
			return
		}
		rec, err := loader.LoadActiveUser(c.Request.Context(), claims.UserID)
		if err != nil {
			if errors.Is(err, ErrUserNotFound) {
				response.Unauthorized(c, "invalid or expired token")
			} else {
				response.InternalErrorf(c, err, "failed to verify account")
			}
			c.Abort()
			return
		}
		if !rec.IsActive {
			response.Unauthorized(c, "account is inactive")
			c.Abort()
			return
		}
		c.Set(userKey, &AuthUser{
			UserID:    rec.ID,
			CompanyID: rec.CompanyID,
			Role:      rec.Role,
			Email:     rec.Email,
		})
		c.Next()
	}
}

// AuthUserFromContext returns the authenticated user, or nil if unauthenticated.
func AuthUserFromContext(c *gin.Context) *AuthUser {
	v, ok := c.Value(userKey).(*AuthUser)
	if !ok {
		return nil
	}
	return v
}

// RequireRole returns middleware that rejects callers whose role is not in the
// allowed set. Administrators are always allowed.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		u := AuthUserFromContext(c)
		if u == nil {
			response.Unauthorized(c, "authentication required")
			c.Abort()
			return
		}
		if auth.IsAdmin(u.Role) {
			c.Next()
			return
		}
		for _, r := range allowedRoles {
			if strings.EqualFold(u.Role, r) {
				c.Next()
				return
			}
		}
		response.Forbidden(c, "insufficient permissions")
		c.Abort()
	}
}

// RequireCompanyAdmin ensures the caller is an administrator of their own company.
func RequireCompanyAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := AuthUserFromContext(c)
		if u == nil {
			response.Unauthorized(c, "authentication required")
			c.Abort()
			return
		}
		if !auth.IsAdmin(u.Role) {
			response.Forbidden(c, "administrator role required")
			c.Abort()
			return
		}
		c.Next()
	}
}

// TenantIsolation is a no-op marker middleware; the repositories enforce
// scoping by company_id from the authenticated user.
func TenantIsolation() gin.HandlerFunc {
	return func(c *gin.Context) {
		u := AuthUserFromContext(c)
		if u != nil && u.CompanyID == "" {
			response.InternalError(c, "tenant context missing")
			c.Abort()
			return
		}
		c.Next()
	}
}

// Recover converts panics into 500 responses.
func Recover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("panic recovered",
					slog.Any("panic", r),
					slog.String("method", c.Request.Method),
					slog.String("path", c.Request.URL.Path),
				)
				response.InternalError(c, "internal server error")
				c.Abort()
			}
		}()
		c.Next()
	}
}

// CORS adds permissive CORS headers for configured origins.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowAll := len(allowedOrigins) == 0
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if allowAll {
			c.Header("Access-Control-Allow-Origin", "*")
		} else {
			for _, o := range allowedOrigins {
				if o == origin {
					c.Header("Access-Control-Allow-Origin", origin)
					c.Header("Access-Control-Allow-Credentials", "true")
					break
				}
			}
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

// RequestLogger emits structured logs for every request.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		u := AuthUserFromContext(c)
		uid := "-"
		if u != nil {
			uid = u.UserID
		}
		slog.Info("http request",
			slog.String("method", c.Request.Method),
			slog.String("path", c.Request.URL.Path),
			slog.Int("status", c.Writer.Status()),
			slog.Duration("latency", time.Since(start)),
			slog.String("user", uid),
			slog.String("ip", c.ClientIP()),
		)
	}
}
