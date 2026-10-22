package config

import (
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func setBaseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("JWT_ACCESS_SECRET", "access-secret")
	t.Setenv("JWT_REFRESH_SECRET", "refresh-secret")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("NEON_DATABASE_URL", "")
	t.Setenv("AWS_ENDPOINT_URL_S3", "")
	t.Setenv("AWS_REGION", "")
	t.Setenv("AWS_ACCESS_KEY_ID", "")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "")
	t.Setenv("S3_BUCKET", "")
}

func TestLoadReadsStorageFromAWSVariables(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("AWS_ENDPOINT_URL_S3", "https://storage.example.test")
	t.Setenv("AWS_REGION", "us-east-2")
	t.Setenv("AWS_ACCESS_KEY_ID", "key-id")
	t.Setenv("AWS_SECRET_ACCESS_KEY", "secret-key")
	t.Setenv("S3_BUCKET", "leadnest")
	t.Setenv("S3_FORCE_PATH_STYLE", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !cfg.Storage.Enabled() {
		t.Fatal("expected storage to be enabled")
	}
	if cfg.Storage.Endpoint != "https://storage.example.test" {
		t.Errorf("unexpected endpoint: %q", cfg.Storage.Endpoint)
	}
	if cfg.Storage.Region != "us-east-2" {
		t.Errorf("unexpected region: %q", cfg.Storage.Region)
	}
	if cfg.Storage.AccessKeyID != "key-id" {
		t.Errorf("unexpected access key id: %q", cfg.Storage.AccessKeyID)
	}
	if cfg.Storage.SecretAccessKey != "secret-key" {
		t.Errorf("unexpected secret access key: %q", cfg.Storage.SecretAccessKey)
	}
	if cfg.Storage.Bucket != "leadnest" {
		t.Errorf("unexpected bucket: %q", cfg.Storage.Bucket)
	}
	if !cfg.Storage.ForcePathStyle {
		t.Error("expected path style addressing to be enabled")
	}
}

func TestStorageDisabledWithoutCredentials(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("AWS_ENDPOINT_URL_S3", "https://storage.example.test")
	t.Setenv("AWS_REGION", "us-east-2")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Storage.Enabled() {
		t.Fatal("expected storage to be disabled without credentials")
	}
}

func TestDatabaseURLOverridesParts(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DB_HOST", "localhost")
	t.Setenv("DB_NAME", "leadnest")
	t.Setenv("DATABASE_URL", "postgresql://owner:secret@db.example.test/neondb?sslmode=require")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := cfg.DSN(); got != "postgresql://owner:secret@db.example.test/neondb?sslmode=require" {
		t.Errorf("unexpected dsn: %q", got)
	}
	if got := cfg.PoolDSN(); got != "postgresql://owner:secret@db.example.test/neondb?sslmode=require" {
		t.Errorf("unexpected pool dsn: %q", got)
	}
}

func TestDSNBuiltFromPartsWhenNoURL(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DB_HOST", "db.example.test")
	t.Setenv("DB_PORT", "5433")
	t.Setenv("DB_NAME", "leadnest")
	t.Setenv("DB_USER", "owner")
	t.Setenv("DB_PASSWORD", "secret")
	t.Setenv("DB_SSLMODE", "require")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dsn := cfg.DSN()
	for _, want := range []string{"host=db.example.test", "port=5433", "dbname=leadnest", "user=owner", "password=secret", "sslmode=require"} {
		if !strings.Contains(dsn, want) {
			t.Errorf("expected dsn %q to contain %q", dsn, want)
		}
	}
}

func TestPoolDSNIsParseable(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DB_HOST", "db.example.test")
	t.Setenv("DB_MAX_CONN_LIFETIME", "5m")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dsn := cfg.PoolDSN()
	if !strings.Contains(dsn, "pool_max_conn_lifetime=5m0s") {
		t.Errorf("expected a duration with a unit, got %q", dsn)
	}
	if _, err := pgxpool.ParseConfig(dsn); err != nil {
		t.Errorf("pool dsn %q is not parseable: %v", dsn, err)
	}
}

func TestValidateRejectsMalformedDatabaseURL(t *testing.T) {
	setBaseEnv(t)
	t.Setenv("DATABASE_URL", "mysql://user:secret@db.example.test/leadnest")

	_, err := Load()
	if err == nil {
		t.Fatal("expected an error for a non postgres DATABASE_URL")
	}
	if !strings.Contains(err.Error(), "DATABASE_URL") {
		t.Errorf("unexpected error message: %v", err)
	}
}
