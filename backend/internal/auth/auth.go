// Package auth provides password hashing (Argon2id) and JWT token
// generation/verification.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/argon2"
)

var hashRe = regexp.MustCompile(
	`^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$`,
)

// PasswordHasher hashes and verifies passwords using Argon2id.
type PasswordHasher struct {
	time    uint32
	memory  uint32
	threads uint8
	keyLen  uint32
	saltLen uint32
}

// NewPasswordHasher returns a hasher with OWASP-recommended parameters.
func NewPasswordHasher() *PasswordHasher {
	return &PasswordHasher{
		time:    1,
		memory:  64 * 1024, // 64 MiB
		threads: 4,
		keyLen:  32,
		saltLen: 16,
	}
}

// Hash encodes a password into a modular argon2 hash string.
func (h *PasswordHasher) Hash(password string) (string, error) {
	salt := make([]byte, h.saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("salt: %w", err)
	}
	hash := argon2.IDKey([]byte(password), salt, h.time, h.memory, h.threads, h.keyLen)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, h.memory, h.time, h.threads,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

// Verify returns true if password matches the encoded hash.
//
// The encoded form follows the standard PHC string format:
// $argon2id$v=19$m=65536,t=1,p=4$<salt>$<hash>.
// The parameters are read back from the hash so a hash created with different
// parameters still verifies.
func (h *PasswordHasher) Verify(password, encoded string) (bool, error) {
	m := hashRe.FindStringSubmatch(encoded)
	if m == nil {
		return false, errors.New("invalid hash format")
	}
	version, err := strconv.ParseUint(m[1], 10, 32)
	if err != nil {
		return false, fmt.Errorf("parse version: %w", err)
	}
	if version != argon2.Version {
		return false, fmt.Errorf("unsupported argon2 version %d", version)
	}
	memory, err := strconv.ParseUint(m[2], 10, 32)
	if err != nil {
		return false, fmt.Errorf("parse memory: %w", err)
	}
	timeCost, err := strconv.ParseUint(m[3], 10, 32)
	if err != nil {
		return false, fmt.Errorf("parse time: %w", err)
	}
	parallel, err := strconv.ParseUint(m[4], 10, 8)
	if err != nil {
		return false, fmt.Errorf("parse parallelism: %w", err)
	}
	salt, err := base64.RawStdEncoding.DecodeString(m[5])
	if err != nil {
		return false, fmt.Errorf("decode salt: %w", err)
	}
	hash, err := base64.RawStdEncoding.DecodeString(m[6])
	if err != nil {
		return false, fmt.Errorf("decode hash: %w", err)
	}
	if len(hash) == 0 {
		return false, errors.New("hash is empty")
	}
	computed := argon2.IDKey([]byte(password), salt, uint32(timeCost), uint32(memory), uint8(parallel), uint32(len(hash)))
	if subtleConstantTimeCompare(computed, hash) == 1 {
		return true, nil
	}
	return false, nil
}

func subtleConstantTimeCompare(a, b []byte) int {
	if len(a) != len(b) {
		return 0
	}
	var diff uint8
	for i := 0; i < len(a); i++ {
		diff |= a[i] ^ b[i]
	}
	if diff == 0 {
		return 1
	}
	return 0
}

// TokenClaims are the JWT claims embedded in access tokens.
type TokenClaims struct {
	UserID    string `json:"user_id"`
	CompanyID string `json:"company_id"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	jwt.RegisteredClaims
}

// TokenManager issues and verifies JWT access tokens.
type TokenManager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

// NewTokenManager creates a JWT manager.
func NewTokenManager(secret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		secret:     []byte(secret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

// AccessTTL returns the configured access-token lifetime.
func (m *TokenManager) AccessTTL() time.Duration {
	return m.accessTTL
}

// RefreshTTL returns the configured refresh-token lifetime.
func (m *TokenManager) RefreshTTL() time.Duration {
	return m.refreshTTL
}

// AccessToken issues a short-lived JWT.
func (m *TokenManager) AccessToken(ctx context.Context, claims TokenClaims) (string, error) {
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.accessTTL)),
		Issuer:    "leadnest",
		Subject:   claims.UserID,
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", err
	}
	return tok, nil
}

// RefreshToken issues a long-lived opaque refresh token.
func (m *TokenManager) RefreshToken(ctx context.Context) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// HashRefreshToken returns a SHA-256 digest of the refresh token for storage.
func (m *TokenManager) HashRefreshToken(raw string) string {
	d := sha256.Sum256([]byte(raw))
	return base64.URLEncoding.EncodeToString(d[:])
}

// VerifyAccessToken parses and validates a JWT, returning the claims.
func (m *TokenManager) VerifyAccessToken(ctx context.Context, tokenString string) (*TokenClaims, error) {
	tok, err := jwt.ParseWithClaims(
		tokenString,
		&TokenClaims{},
		func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Method)
			}
			return m.secret, nil
		},
		jwt.WithIssuer("leadnest"),
	)
	if err != nil {
		return nil, fmt.Errorf("verify token: %w", err)
	}
	claims, ok := tok.Claims.(*TokenClaims)
	if !ok || !tok.Valid {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

// PasswordMinLength is the minimum acceptable password length.
const PasswordMinLength = 8

// IsAdmin returns true if the role is an administrator.
func IsAdmin(role string) bool {
	return strings.EqualFold(role, "admin")
}
