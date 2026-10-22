// Command api starts the LeadNest REST API server.
//
// The Swagger metadata for the API lives in internal/server/swagger.go.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/leadnest/backend/internal/ai"
	"github.com/leadnest/backend/internal/auth"
	"github.com/leadnest/backend/internal/config"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/server"
	"github.com/leadnest/backend/internal/storage"
)

// version is the build version, overridable at link time with -ldflags.
var version = "dev"

func main() {
	if err := run(); err != nil {
		slog.Error("server exited with error", slog.String("err", err.Error()))
		os.Exit(1)
	}
}

func run() error {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	store, err := database.NewStore(ctx, cfg.PoolDSN(),
		cfg.Database.MinConns, cfg.Database.MaxConns, cfg.Database.MaxConnLifetime)
	if err != nil {
		return err
	}
	defer store.Close()

	hasher := auth.NewPasswordHasher()
	tokens := auth.NewTokenManager(cfg.Auth.AccessSecret, cfg.Auth.AccessTTL, cfg.Auth.RefreshTTL)
	aiService := ai.NewService(cfg.AI)

	if aiService.Enabled() {
		slog.Info("ai provider configured",
			slog.String("provider", aiService.ProviderName()),
			slog.String("model", aiService.ModelName()))
	} else {
		slog.Warn("ai provider not configured; AI endpoints will respond with 503")
	}

	var storageClient *storage.Client
	if cfg.Storage.Enabled() {
		storageClient, err = storage.New(storage.Config{
			Endpoint:        cfg.Storage.Endpoint,
			Region:          cfg.Storage.Region,
			AccessKeyID:     cfg.Storage.AccessKeyID,
			SecretAccessKey: cfg.Storage.SecretAccessKey,
			Bucket:          cfg.Storage.Bucket,
			ForcePathStyle:  cfg.Storage.ForcePathStyle,
		})
		if err != nil {
			return fmt.Errorf("storage client: %w", err)
		}
		storageCtx, storageCancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer storageCancel()
		if err := storageClient.Ping(storageCtx); err != nil {
			return fmt.Errorf("storage: %w", err)
		}
		slog.Info("connected to object storage",
			slog.String("endpoint", cfg.Storage.Endpoint),
			slog.String("bucket", cfg.Storage.Bucket))
	} else {
		slog.Warn("object storage not configured; storage features are unavailable")
	}

	router := server.New(server.RouterDeps{
		Config:    cfg,
		Store:     store,
		Tokens:    tokens,
		Hasher:    hasher,
		AIService: aiService,
		Storage:   storageClient,
		Version:   version,
	})

	srv := server.NewServer(cfg.Server.Addr, router, &cfg.Server)

	errCh := make(chan error, 1)
	go func() {
		slog.Info("leadnest api listening",
			slog.String("addr", cfg.Server.Addr),
			slog.String("version", version))
		if err := srv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return err
	case sig := <-quit:
		slog.Info("shutdown signal received", slog.String("signal", sig.String()))
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer shutdownCancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return err
		}
		slog.Info("server shut down cleanly")
		return nil
	}
}
