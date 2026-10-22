// Package server wires the HTTP router, middleware and module handlers.
package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/activities"
	"github.com/leadnest/backend/internal/ai"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/companies"
	"github.com/leadnest/backend/internal/config"
	"github.com/leadnest/backend/internal/customers"
	"github.com/leadnest/backend/internal/dashboard"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/deals"
	"github.com/leadnest/backend/internal/health"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/storage"
	"github.com/leadnest/backend/internal/tasks"
	"github.com/leadnest/backend/internal/users"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/leadnest/backend/docs"
)

// RouterDeps holds everything the router needs to build handlers.
type RouterDeps struct {
	Config    *config.Config
	Store     *database.Store
	Tokens    *auth.TokenManager
	Hasher    *auth.PasswordHasher
	AIService *ai.Service
	// Storage is the optional object storage client. It is nil when
	// object storage is not configured.
	Storage *storage.Client
	Version string
}

// New builds the HTTP router with all routes registered.
func New(deps RouterDeps) *gin.Engine {
	if deps.Config.Server.ReadTimeout > 0 {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(middleware.Recover())
	r.Use(middleware.RequestLogger())
	r.Use(middleware.CORS(deps.Config.CORS.AllowedOrigins))
	r.Use(middleware.RateLimit(deps.Config.RateLimit.RPS, deps.Config.RateLimit.Burst))

	r.MaxMultipartMemory = 1 << 20

	// Health probes live outside the API prefix and need no authentication.
	// The storage checker is kept as a nil interface when object storage is
	// not configured, so the readiness probe reports it as disabled.
	var storageChecker health.StorageChecker
	if deps.Storage != nil {
		storageChecker = deps.Storage
	}
	healthHandler := health.NewHandler(deps.Store, storageChecker, deps.Version)
	healthHandler.RegisterRoutes(r)

	// The OpenAPI description is served from the generated docs package, so
	// the running server always documents the endpoints it actually exposes.
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.GET("/openapi.json", func(c *gin.Context) {
		c.JSON(http.StatusOK, docs.SwaggerInfo)
	})

	api := r.Group("/api/v1")
	api.Use(func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Next()
	})

	// Public routes.
	usersHandler := users.NewHandler(deps.Store, deps.Hasher, deps.Tokens)
	usersHandler.RegisterRoutes(api.Group("/auth"))
	api.GET("/auth/me", middleware.RequireAuth(deps.Tokens, usersHandler), usersHandler.Me)
	api.PATCH("/auth/me/password", middleware.RequireAuth(deps.Tokens, usersHandler), usersHandler.ChangePassword)
	api.POST("/auth/logout", middleware.RequireAuth(deps.Tokens, usersHandler), usersHandler.Logout)

	// Authenticated routes. The tenant scope comes from the verified user row.
	authed := api.Group("")
	authed.Use(middleware.RequireAuth(deps.Tokens, usersHandler))
	authed.Use(middleware.TenantIsolation())

	companies.NewHandler(companies.NewCompanyRepo(deps.Store)).RegisterRoutes(authed.Group("/companies"))
	usersHandler.RegisterUserRoutes(authed.Group("/users"))

	customersHandler := customers.NewHandler(customers.NewRepo(deps.Store))
	customersHandler.RegisterRoutes(authed.Group("/customers"))

	activitiesHandler := activities.NewHandler(activities.NewRepo(deps.Store))
	activitiesHandler.RegisterRoutes(authed.Group("/activities"))
	activitiesHandler.RegisterCustomerRoutes(authed.Group("/customers"))

	deals.NewHandler(deals.NewRepo(deps.Store)).RegisterRoutes(authed.Group("/deals"))
	tasks.NewHandler(tasks.NewRepo(deps.Store)).RegisterRoutes(authed.Group("/tasks"))
	dashboard.NewHandler(dashboard.NewRepo(deps.Store)).RegisterRoutes(authed.Group("/dashboard"))

	ai.NewHandler(deps.Store, deps.AIService).RegisterRoutes(authed.Group("/ai"))

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NOT_FOUND",
				"message": "the requested endpoint does not exist",
			},
		})
	})
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error": gin.H{
				"code":    "METHOD_NOT_ALLOWED",
				"message": "the requested method is not allowed for this endpoint",
			},
		})
	})

	return r
}

// Server wraps the router with timeouts.
type Server struct {
	httpServer *http.Server
}

// NewServer builds an http.Server with the configured timeouts.
func NewServer(addr string, handler http.Handler, cfg *config.ServerConfig) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadTimeout:       cfg.ReadTimeout,
			ReadHeaderTimeout: 10 * time.Second,
			WriteTimeout:      cfg.WriteTimeout,
			IdleTimeout:       cfg.IdleTimeout,
		},
	}
}

// Start begins serving requests.
func (s *Server) Start() error {
	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully stops the server.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
