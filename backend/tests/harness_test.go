//go:build integration

// Package tests contains the end-to-end integration test suite.
//
// These tests require a dedicated PostgreSQL database. Point TEST_DATABASE_URL
// at a throwaway database; the suite truncates every table it touches.
//
//	export TEST_DATABASE_URL=postgres://leadnest:leadnest@localhost:5433/leadnest_test?sslmode=disable
//	go test -tags=integration ./tests/...
package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/ai"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/config"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/server"
)

// testEnv holds the shared state for the integration suite.
type testEnv struct {
	router *gin.Engine
	store  *database.Store
	tokens *auth.TokenManager
}

// The schema is applied once per test run, then each test truncates the
// tables so it starts from a known state.
var (
	schemaOnce   sync.Once
	sharedStore  *database.Store
	schemaErr    error
	truncateStmt = `TRUNCATE TABLE
    ai_interactions, activities, tasks, deals, customers, users, companies
    RESTART IDENTITY CASCADE`
)

// setup provisions a clean test database and builds the HTTP router.
//
// The schema is applied from the repository's own migration files, so the
// integration tests exercise exactly the DDL that production uses.
func setup(t *testing.T) *testEnv {
	t.Helper()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping integration tests")
	}

	gin.SetMode(gin.TestMode)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	schemaOnce.Do(func() {
		store, err := database.NewStore(ctx, dsn, 2, 8, time.Minute)
		if err != nil {
			schemaErr = fmt.Errorf("connect to test database: %w", err)
			return
		}
		if err := applyMigrations(ctx, store); err != nil {
			schemaErr = err
			store.Close()
			return
		}
		sharedStore = store
	})
	if schemaErr != nil {
		t.Fatalf("test database setup failed: %v", schemaErr)
	}

	// Every test starts from an empty database.
	if _, err := sharedStore.Exec(ctx, truncateStmt); err != nil {
		t.Fatalf("truncate tables: %v", err)
	}

	cfg := &config.Config{
		Server: config.ServerConfig{Addr: ":0"},
		Auth: config.AuthConfig{
			AccessSecret:  "integration-access-secret",
			RefreshSecret: "integration-refresh-secret",
			AccessTTL:     time.Hour,
			RefreshTTL:    24 * time.Hour,
		},
		RateLimit: config.RateLimitConfig{RPS: 10000, Burst: 10000},
		CORS:      config.CORSConfig{AllowedOrigins: []string{"*"}},
	}

	tokens := auth.NewTokenManager(cfg.Auth.AccessSecret, cfg.Auth.AccessTTL, cfg.Auth.RefreshTTL)
	router := server.New(server.RouterDeps{
		Config:    cfg,
		Store:     sharedStore,
		Tokens:    tokens,
		Hasher:    auth.NewPasswordHasher(),
		AIService: ai.NewService(config.AIConfig{}),
		Version:   "test",
	})

	return &testEnv{router: router, store: sharedStore, tokens: tokens}
}

// applyMigrations runs the up section of every migration file against the
// test database.
func applyMigrations(ctx context.Context, store *database.Store) error {
	dir := migrationDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		body, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			return fmt.Errorf("read %s: %w", e.Name(), err)
		}
		up := extractUpSection(string(body))
		if strings.TrimSpace(up) == "" {
			continue
		}
		if _, err := store.Exec(ctx, up); err != nil {
			return fmt.Errorf("apply %s: %w", e.Name(), err)
		}
	}
	return nil
}

// migrationDir locates the migrations directory relative to this source file,
// so the tests work regardless of the working directory they are run from.
func migrationDir() string {
	if dir := os.Getenv("MIGRATIONS_DIR"); dir != "" {
		return dir
	}
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		return filepath.Join("..", "migrations")
	}
	return filepath.Join(filepath.Dir(thisFile), "..", "migrations")
}

// extractUpSection returns the part of a migration before the
// "-- +migrate Down" marker.
func extractUpSection(s string) string {
	marker := "-- +migrate Down"
	idx := strings.Index(s, marker)
	if idx < 0 {
		return s
	}
	return s[:idx]
}

// --- HTTP helpers ---

type apiResponse struct {
	Status int
	Body   map[string]any
	Raw    []byte
}

// Data returns the "data" object of a successful response.
func (r apiResponse) Data() map[string]any {
	if d, ok := r.Body["data"].(map[string]any); ok {
		return d
	}
	return nil
}

// Meta returns the pagination metadata of a list response.
func (r apiResponse) Meta() map[string]any {
	if m, ok := r.Body["meta"].(map[string]any); ok {
		return m
	}
	return nil
}

// ErrorCode returns the machine-readable error code of a failed response.
func (r apiResponse) ErrorCode() string {
	e, ok := r.Body["error"].(map[string]any)
	if !ok {
		return ""
	}
	code, _ := e["code"].(string)
	return code
}

func (env *testEnv) do(t *testing.T, method, path, token string, body any) apiResponse {
	t.Helper()
	var reader *strings.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = strings.NewReader(string(raw))
	} else {
		reader = strings.NewReader("")
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rec := httptest.NewRecorder()
	env.router.ServeHTTP(rec, req)

	resp := apiResponse{Status: rec.Code, Raw: rec.Body.Bytes()}
	if len(rec.Body.Bytes()) > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &resp.Body); err != nil {
			t.Fatalf("%s %s: response is not valid JSON: %v (body: %s)",
				method, path, err, string(rec.Body.Bytes()))
		}
	}
	return resp
}

func (env *testEnv) mustDo(t *testing.T, method, path, token string, body any, wantStatus int) apiResponse {
	t.Helper()
	resp := env.do(t, method, path, token, body)
	if resp.Status != wantStatus {
		t.Fatalf("%s %s: expected status %d, got %d (body: %s)",
			method, path, wantStatus, resp.Status, string(resp.Raw))
	}
	return resp
}

// account is a registered company plus its administrator credentials.
type account struct {
	CompanyName  string
	CompanyEmail string
	AdminEmail   string
	AdminPass    string
	Token        string
	CompanyID    string
	UserID       string
}

// registerCompany registers a fresh company and returns its admin credentials.
func (env *testEnv) registerCompany(t *testing.T, name string) account {
	t.Helper()
	acc := account{
		CompanyName:  name + " Company",
		CompanyEmail: strings.ToLower(name) + "@example.com",
		AdminEmail:   "admin@" + strings.ToLower(name) + ".example.com",
		AdminPass:    "IntegrationPass123",
	}
	payload := map[string]any{
		"company": map[string]any{
			"name":    acc.CompanyName,
			"email":   acc.CompanyEmail,
			"phone":   "+21620123456",
			"website": "https://example.com",
		},
		"admin": map[string]any{
			"full_name": "Admin User",
			"email":     acc.AdminEmail,
			"password":  acc.AdminPass,
		},
	}
	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", payload, http.StatusCreated)
	data := resp.Data()
	acc.Token, _ = data["access_token"].(string)
	user, _ := data["user"].(map[string]any)
	acc.UserID, _ = user["id"].(string)
	acc.CompanyID, _ = user["company_id"].(string)
	return acc
}

// createEmployee adds an employee to the given company and returns the
// employee's id, email and an access token for that employee.
func (env *testEnv) createEmployee(t *testing.T, acc account, name string) (string, string, string) {
	t.Helper()
	email := name + "@example.com"
	resp := env.mustDo(t, http.MethodPost, "/api/v1/users", acc.Token, map[string]any{
		"full_name": name,
		"email":     email,
		"password":  "EmployeePass123",
	}, http.StatusCreated)
	data := resp.Data()
	id, _ := data["id"].(string)

	login := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    email,
		"password": "EmployeePass123",
	}, http.StatusOK)
	token, _ := login.Data()["access_token"].(string)
	return id, email, token
}

// createCustomer creates a customer in the given company.
func (env *testEnv) createCustomer(t *testing.T, token, name, email string) string {
	t.Helper()
	resp := env.mustDo(t, http.MethodPost, "/api/v1/customers", token, map[string]any{
		"full_name": name,
		"email":     email,
		"phone":     "+21620123456",
		"source":    "web",
	}, http.StatusCreated)
	id, _ := resp.Data()["id"].(string)
	return id
}

func uniqueName(prefix string) string {
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

// countRows counts the rows of a table. It is used to assert that failed
// transactions leave no partial data behind.
func (env *testEnv) countRows(t *testing.T, table string) int64 {
	t.Helper()
	var n int64
	if err := env.store.QueryRow(t.Context(), "SELECT COUNT(*) FROM "+table).Scan(&n); err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}
