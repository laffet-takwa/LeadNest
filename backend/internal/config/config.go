package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server    ServerConfig
	Database  DatabaseConfig
	Redis     RedisConfig
	Auth      AuthConfig
	AI        AIConfig
	Storage   StorageConfig
	RateLimit RateLimitConfig
	CORS      CORSConfig
}

type ServerConfig struct {
	Addr         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type DatabaseConfig struct {
	Host     string
	Port     int
	Name     string
	User     string
	Password string
	SSLMode  string
	// URL is a full connection string. When set it overrides every other
	// field, which is how a hosted provider such as Neon hands out a
	// single URI instead of separate parts.
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type AuthConfig struct {
	AccessSecret  string
	RefreshSecret string
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
}

type AIConfig struct {
	Provider  string
	APIKey    string
	BaseURL   string
	Model     string
	Timeout   time.Duration
	MaxTokens int
}

// StorageConfig describes the S3-compatible object storage service. The
// field names follow the standard AWS environment variables so the same
// credentials work with any S3 client.
type StorageConfig struct {
	// Endpoint is the service URL, for example an object storage endpoint.
	Endpoint string
	// Region is the region the service reports for its buckets.
	Region string
	// AccessKeyID and SecretAccessKey are the static credentials.
	AccessKeyID     string
	SecretAccessKey string
	// Bucket is the bucket objects are written to.
	Bucket string
	// ForcePathStyle selects path-style bucket addressing. Object storage
	// providers that sit behind a custom endpoint usually require it.
	ForcePathStyle bool
}

// Enabled reports whether enough storage configuration is present to build
// a client.
func (s StorageConfig) Enabled() bool {
	return s.Endpoint != "" && s.Region != "" && s.AccessKeyID != "" && s.SecretAccessKey != ""
}

type RateLimitConfig struct {
	RPS   float64
	Burst int
}

type CORSConfig struct {
	AllowedOrigins []string
}

func Load() (*Config, error) {
	loadEnv()
	cfg := &Config{
		Server: ServerConfig{
			Addr:         env("SERVER_ADDR", ":8080"),
			ReadTimeout:  envDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: envDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
			IdleTimeout:  envDuration("SERVER_IDLE_TIMEOUT", 60*time.Second),
		},
		Database: DatabaseConfig{
			Host:            env("DB_HOST", "localhost"),
			Port:            envInt("DB_PORT", 5432),
			Name:            env("DB_NAME", "leadnest"),
			User:            env("DB_USER", "leadnest"),
			Password:        env("DB_PASSWORD", "leadnest"),
			SSLMode:         env("DB_SSLMODE", "disable"),
			URL:             env("DATABASE_URL", env("NEON_DATABASE_URL", "")),
			MaxConns:        int32(envInt("DB_MAX_CONNS", 25)),
			MinConns:        int32(envInt("DB_MIN_CONNS", 5)),
			MaxConnLifetime: envDuration("DB_MAX_CONN_LIFETIME", 5*time.Minute),
		},
		Redis: RedisConfig{
			Addr:     env("REDIS_ADDR", "localhost:6379"),
			Password: env("REDIS_PASSWORD", ""),
			DB:       envInt("REDIS_DB", 0),
		},
		Auth: AuthConfig{
			AccessSecret:  env("JWT_ACCESS_SECRET", ""),
			RefreshSecret: env("JWT_REFRESH_SECRET", ""),
			AccessTTL:     envDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTTL:    envDuration("JWT_REFRESH_TTL", 7*24*time.Hour),
		},
		AI: AIConfig{
			Provider:  env("AI_PROVIDER", ""),
			APIKey:    env("AI_API_KEY", ""),
			BaseURL:   env("AI_BASE_URL", ""),
			Model:     env("AI_MODEL", "gpt-4o-mini"),
			Timeout:   envDuration("AI_TIMEOUT_MS", 15*time.Second),
			MaxTokens: envInt("AI_MAX_TOKENS", 2048),
		},
		Storage: StorageConfig{
			Endpoint:        env("AWS_ENDPOINT_URL_S3", env("S3_ENDPOINT", "")),
			Region:          env("AWS_REGION", env("S3_REGION", "")),
			AccessKeyID:     env("AWS_ACCESS_KEY_ID", env("S3_ACCESS_KEY_ID", "")),
			SecretAccessKey: env("AWS_SECRET_ACCESS_KEY", env("S3_SECRET_ACCESS_KEY", "")),
			Bucket:          env("S3_BUCKET", ""),
			ForcePathStyle:  envBool("S3_FORCE_PATH_STYLE", true),
		},
		RateLimit: RateLimitConfig{
			RPS:   envFloat("RATE_LIMIT_RPS", 100),
			Burst: envInt("RATE_LIMIT_BURST", 200),
		},
		CORS: CORSConfig{
			AllowedOrigins: split(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		},
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// loadEnv loads the .env file into the process environment.
//
// The file is looked up in the working directory first and then in the
// parent directories, so the backend starts with the same configuration
// whether it is run from the repository root, from the backend directory or
// from a container. Variables that are already set in the environment always
// win over the values in the file.
func loadEnv() {
	if err := godotenv.Load(".env"); err == nil {
		return
	}
	dir, err := os.Getwd()
	if err != nil {
		return
	}
	for i := 0; i < 3; i++ {
		parent := filepath.Dir(dir)
		if parent == dir {
			return
		}
		dir = parent
		if err := godotenv.Load(filepath.Join(dir, ".env")); err == nil {
			return
		}
	}
}

func (c *Config) Validate() error {
	if c.Server.Addr == "" {
		return fmt.Errorf("SERVER_ADDR is required")
	}
	if c.Auth.AccessSecret == "" || c.Auth.RefreshSecret == "" {
		return fmt.Errorf("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required")
	}
	if c.Database.URL != "" && !strings.HasPrefix(c.Database.URL, "postgres://") && !strings.HasPrefix(c.Database.URL, "postgresql://") {
		return fmt.Errorf("DATABASE_URL must be a postgres connection URL")
	}
	return nil
}

// DSN returns a connection string for the database. A full URL from the
// environment wins over the individual parts.
func (c *Config) DSN() string {
	if c.Database.URL != "" {
		return c.Database.URL
	}
	return fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=%s",
		c.Database.Host, c.Database.Port, c.Database.Name,
		c.Database.User, c.Database.Password, c.Database.SSLMode,
	)
}

// PoolDSN returns the connection string used for the pool. Pool limits are
// applied programmatically by the store, so a URL is passed through as is.
func (c *Config) PoolDSN() string {
	if c.Database.URL != "" {
		return c.Database.URL
	}
	return c.DSN() + fmt.Sprintf(
		" pool_max_conns=%d pool_min_conns=%d pool_max_conn_lifetime=%s",
		c.Database.MaxConns, c.Database.MinConns, c.Database.MaxConnLifetime,
	)
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func envFloat(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}

func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func split(s string) []string {
	if s == "" {
		return nil
	}
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
		} else {
			cur += string(r)
		}
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}
