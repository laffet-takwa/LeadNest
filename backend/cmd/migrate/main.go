// Command migrate applies the versioned SQL migrations in ./migrations.
//
// Migrations are applied in filename order and recorded in the
// schema_migrations table. A migration is only marked as applied when it
// commits, so a failure leaves the database on the last good version.
//
// Usage:
//
//	migrate -dir migrations -action up
//	migrate -dir migrations -action down
//	migrate -dir migrations -action status
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/leadnest/backend/internal/config"
)

func main() {
	dir := flag.String("dir", "migrations", "directory containing .sql migration files")
	action := flag.String("action", "up", "action to run: up, down, or status")
	flag.Parse()

	if err := run(*dir, *action); err != nil {
		fmt.Fprintf(os.Stderr, "migration failed: %v\n", err)
		os.Exit(1)
	}
}

func run(dir, action string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	conn, err := pgx.Connect(ctx, cfg.DSN())
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer conn.Close(context.Background())

	if err := ensureMigrationsTable(ctx, conn); err != nil {
		return err
	}

	migrations, err := loadMigrations(dir)
	if err != nil {
		return err
	}

	switch action {
	case "up":
		return applyUp(ctx, conn, migrations)
	case "down":
		return applyDown(ctx, conn, migrations)
	case "status":
		return printStatus(ctx, conn, migrations)
	default:
		return fmt.Errorf("unknown action %q (use up, down, or status)", action)
	}
}

func ensureMigrationsTable(ctx context.Context, conn *pgx.Conn) error {
	const q = `CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
	if _, err := conn.Exec(ctx, q); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	return nil
}

type migration struct {
	version string
	path    string
}

func loadMigrations(dir string) ([]migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}
	out := []migration{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		out = append(out, migration{
			version: strings.TrimSuffix(e.Name(), ".sql"),
			path:    filepath.Join(dir, e.Name()),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].version < out[j].version })
	return out, nil
}

func appliedVersions(ctx context.Context, conn *pgx.Conn) (map[string]bool, error) {
	rows, err := conn.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out[v] = true
	}
	return out, rows.Err()
}

func applyUp(ctx context.Context, conn *pgx.Conn, migrations []migration) error {
	applied, err := appliedVersions(ctx, conn)
	if err != nil {
		return err
	}
	for _, m := range migrations {
		if applied[m.version] {
			slog.Info("migration already applied, skipping", slog.String("version", m.version))
			continue
		}
		body, err := os.ReadFile(m.path)
		if err != nil {
			return fmt.Errorf("read %s: %w", m.path, err)
		}
		sqlText := stripComments(extractUpSection(string(body)))
		if strings.TrimSpace(sqlText) == "" {
			slog.Warn("migration has no executable statements, marking applied", slog.String("version", m.version))
		} else {
			if err := runInTransaction(ctx, conn, sqlText); err != nil {
				return fmt.Errorf("apply %s: %w", m.version, err)
			}
		}
		if _, err := conn.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", m.version); err != nil {
			return fmt.Errorf("record %s: %w", m.version, err)
		}
		slog.Info("migration applied", slog.String("version", m.version))
	}
	return nil
}

func applyDown(ctx context.Context, conn *pgx.Conn, migrations []migration) error {
	applied, err := appliedVersions(ctx, conn)
	if err != nil {
		return err
	}
	// Roll back the most recently applied migration only.
	for i := len(migrations) - 1; i >= 0; i-- {
		m := migrations[i]
		if !applied[m.version] {
			continue
		}
		body, err := os.ReadFile(m.path)
		if err != nil {
			return fmt.Errorf("read %s: %w", m.path, err)
		}
		down := stripComments(extractDownSection(string(body)))
		if strings.TrimSpace(down) == "" {
			return fmt.Errorf(
				"migration %s has no executable down section; roll it back manually before removing the record",
				m.version)
		}
		if err := runInTransaction(ctx, conn, down); err != nil {
			return fmt.Errorf("rollback %s: %w", m.version, err)
		}
		if _, err := conn.Exec(ctx, "DELETE FROM schema_migrations WHERE version = $1", m.version); err != nil {
			return fmt.Errorf("unrecord %s: %w", m.version, err)
		}
		slog.Info("migration rolled back", slog.String("version", m.version))
		return nil
	}
	slog.Info("no applied migrations to roll back")
	return nil
}

func printStatus(ctx context.Context, conn *pgx.Conn, migrations []migration) error {
	applied, err := appliedVersions(ctx, conn)
	if err != nil {
		return err
	}
	for _, m := range migrations {
		state := "pending"
		if applied[m.version] {
			state = "applied"
		}
		fmt.Printf("%-40s %s\n", m.version, state)
	}
	return nil
}

func runInTransaction(ctx context.Context, conn *pgx.Conn, sqlText string) error {
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback(context.Background())
			panic(r)
		}
	}()
	tag, err := tx.Exec(ctx, sqlText)
	if err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	slog.Info("executed migration statements",
		slog.String("rows_affected", tag.String()))
	return tx.Commit(ctx)
}

// stripComments removes line comments so a migration made only of comments is
// not treated as executable.
func stripComments(s string) string {
	var b strings.Builder
	for _, line := range strings.Split(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		b.WriteString(line)
		b.WriteString("\n")
	}
	return b.String()
}

// extractUpSection returns the part of the migration before the
// "-- +migrate Down" marker. Everything after the marker is the rollback
// section and must never run as part of an "up" migration.
func extractUpSection(s string) string {
	marker := "-- +migrate Down"
	idx := strings.Index(s, marker)
	if idx < 0 {
		return s
	}
	return s[:idx]
}

// extractDownSection returns the statements under the "-- +migrate Down"
// marker, or an empty string when the migration has no down section.
func extractDownSection(s string) string {
	marker := "-- +migrate Down"
	idx := strings.Index(s, marker)
	if idx < 0 {
		return ""
	}
	down := s[idx+len(marker):]
	// Stop at a second section marker if present.
	if end := strings.Index(down, "-- +migrate "); end >= 0 {
		down = down[:end]
	}
	var b strings.Builder
	for _, line := range strings.Split(down, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		b.WriteString(line)
		b.WriteString("\n")
	}
	return b.String()
}

var _ = sql.ErrNoRows
