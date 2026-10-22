// Package database provides connection management and a transactional helper
// layer built on pgx. All queries use parameterized SQL to prevent injection.
package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Pooler interface {
	Close()
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, arguments ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, arguments ...any) pgx.Row
	Ping(ctx context.Context) error
	BeginTx(ctx context.Context, txOptions pgx.TxOptions) (pgx.Tx, error)
}

// Querier is satisfied by both the connection pool and active transactions.
// It is intentionally minimal so repositories can be unit-tested with fakes.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Store wraps a pgx connection pool.
type Store struct {
	Pool *pgxpool.Pool
}

// NewStore opens a connection pool with sane defaults and pings it.
func NewStore(ctx context.Context, dsn string, minConns, maxConns int32, maxLifetime time.Duration) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	cfg.MinConns = minConns
	cfg.MaxConns = maxConns
	cfg.MaxConnLifetime = maxLifetime
	cfg.HealthCheckPeriod = time.Minute
	cfg.ConnConfig.OnNotice = func(_ *pgconn.PgConn, n *pgconn.Notice) {
		slog.Debug("postgres notice", slog.String("message", n.Message))
	}

	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := p.Ping(ctx); err != nil {
		p.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	slog.Info("connected to postgres")
	return &Store{Pool: p}, nil
}

// Close shuts down the pool.
func (s *Store) Close() {
	if s.Pool != nil {
		s.Pool.Close()
	}
}

// Ping checks connectivity.
func (s *Store) Ping(ctx context.Context) error {
	return s.Pool.Ping(ctx)
}

// Exec delegates to the pool.
func (s *Store) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return s.Pool.Exec(ctx, sql, args...)
}

// Query delegates to the pool.
func (s *Store) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return s.Pool.Query(ctx, sql, args...)
}

// QueryRow delegates to the pool.
func (s *Store) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return s.Pool.QueryRow(ctx, sql, args...)
}

// RunInTx executes fn inside a read-committed transaction. On error the
// transaction is rolled back automatically.
func (s *Store) RunInTx(ctx context.Context, fn func(q Querier) error) error {
	tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if r := recover(); r != nil {
			_ = tx.Rollback(ctx)
			panic(r)
		}
	}()
	if err := fn(&txQuerier{tx}); err != nil {
		if rbErr := tx.Rollback(ctx); rbErr != nil {
			slog.Error("rollback failed", slog.String("err", rbErr.Error()))
		}
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

type txQuerier struct {
	tx pgx.Tx
}

func (q *txQuerier) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return q.tx.Exec(ctx, sql, args...)
}
func (q *txQuerier) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return q.tx.Query(ctx, sql, args...)
}
func (q *txQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return q.tx.QueryRow(ctx, sql, args...)
}

// PoolQuerier adapts the pool so it can be passed wherever a Querier is needed.
type PoolQuerier struct{ P *pgxpool.Pool }

func (q PoolQuerier) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return q.P.Exec(ctx, sql, args...)
}
func (q PoolQuerier) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return q.P.Query(ctx, sql, args...)
}
func (q PoolQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return q.P.QueryRow(ctx, sql, args...)
}
