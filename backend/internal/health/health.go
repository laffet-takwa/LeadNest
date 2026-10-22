// Package health provides liveness and readiness endpoints.
package health

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/response"
)

// Handler serves health and readiness probes.
type Handler struct {
	store *database.Store
	// storage is the optional object storage dependency. It is nil when
	// object storage is not configured.
	storage StorageChecker
	// version is reported in the health payload for diagnostics.
	version string
	// startedAt is the process start time.
	startedAt time.Time
}

// StorageChecker reports whether the object storage dependency is reachable.
type StorageChecker interface {
	Ping(ctx context.Context) error
}

// NewHandler builds a health handler. The storage checker may be nil, in
// which case object storage is reported as disabled.
func NewHandler(store *database.Store, storage StorageChecker, version string) *Handler {
	return &Handler{
		store:     store,
		storage:   storage,
		version:   version,
		startedAt: time.Now(),
	}
}

// Health is the liveness probe. It never touches the database so a transient
// database outage does not cause the orchestrator to restart the process.
// @Summary      Liveness probe
// @Description  Returns process liveness information.
// @Tags         health
// @Produce      json
// @Success      200  {object}  response.Success{data=healthResponse}
// @Failure      500  {object}  response.Error
// @Router       /health  [get]
func (h *Handler) Health(c *gin.Context) {
	response.JSON(c, http.StatusOK, healthResponse{
		Status:    "ok",
		Version:   h.version,
		UptimeSec: int(time.Since(h.startedAt).Seconds()),
	})
}

// Ready is the readiness probe. It verifies database connectivity and, when
// object storage is configured, that the bucket is reachable.
// @Summary      Readiness probe
// @Description  Verifies that the service can reach its database dependency.
// @Tags         health
// @Produce      json
// @Success      200  {object}  response.Success{data=readyResponse}
// @Failure      503  {object}  response.Error
// @Router       /ready  [get]
func (h *Handler) Ready(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()
	if err := h.store.Ping(ctx); err != nil {
		response.ErrorResponse(c, http.StatusServiceUnavailable, "NOT_READY", "database is not reachable")
		return
	}
	result := readyResponse{Status: "ready", Database: "ok"}
	if h.storage == nil {
		result.Storage = "disabled"
		response.JSON(c, http.StatusOK, result)
		return
	}
	if err := h.storage.Ping(ctx); err != nil {
		response.ErrorResponse(c, http.StatusServiceUnavailable, "NOT_READY", "object storage is not reachable")
		return
	}
	result.Storage = "ok"
	response.JSON(c, http.StatusOK, result)
}

// RegisterRoutes wires the health routes.
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", h.Health)
	r.GET("/ready", h.Ready)
}

type healthResponse struct {
	Status    string `json:"status"`
	Version   string `json:"version"`
	UptimeSec int    `json:"uptime_seconds"`
}

type readyResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Storage  string `json:"storage"`
}
