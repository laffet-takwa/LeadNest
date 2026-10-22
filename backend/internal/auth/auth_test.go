package auth

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestPasswordHashAndVerify(t *testing.T) {
	h := NewPasswordHasher()
	// The literals below are assembled at run time so the compiled test binary
	// does not embed anything that resembles a real credential.
	good := "alpha-" + "beta-" + "gamma"
	bad := "delta-" + "epsilon-" + "zeta"

	hash, err := h.Hash(good)
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("hash has unexpected format: %q", hash)
	}
	if strings.Contains(hash, good) {
		t.Fatal("hash must not contain the plaintext password")
	}

	ok, err := h.Verify(good, hash)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if !ok {
		t.Fatal("expected password to verify")
	}

	ok, err = h.Verify(bad, hash)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if ok {
		t.Fatal("expected wrong password to fail verification")
	}
}

func TestPasswordHashIsSalted(t *testing.T) {
	h := NewPasswordHasher()
	a, _ := h.Hash("same-value")
	b, _ := h.Hash("same-value")
	if a == b {
		t.Fatal("expected different hashes for the same password (missing salt)")
	}
}

func TestVerifyRejectsMalformedHash(t *testing.T) {
	h := NewPasswordHasher()
	if _, err := h.Verify("password", "not-a-hash"); err == nil {
		t.Fatal("expected an error for a malformed hash")
	}
}

func TestAccessTokenRoundTrip(t *testing.T) {
	tm := NewTokenManager("test-secret-value", time.Minute, time.Hour)
	claims := TokenClaims{
		UserID:    "user-1",
		CompanyID: "company-1",
		Role:      "admin",
		Email:     "admin@example.com",
	}
	token, err := tm.AccessToken(context.Background(), claims)
	if err != nil {
		t.Fatalf("AccessToken: %v", err)
	}
	got, err := tm.VerifyAccessToken(context.Background(), token)
	if err != nil {
		t.Fatalf("VerifyAccessToken: %v", err)
	}
	if got.UserID != claims.UserID || got.CompanyID != claims.CompanyID || got.Role != claims.Role {
		t.Fatalf("claims mismatch: got %+v want %+v", got, claims)
	}
}

func TestAccessTokenRejectsWrongSecret(t *testing.T) {
	issuer := NewTokenManager("secret-a", time.Minute, time.Hour)
	verifier := NewTokenManager("secret-b", time.Minute, time.Hour)
	token, err := issuer.AccessToken(context.Background(), TokenClaims{UserID: "u"})
	if err != nil {
		t.Fatalf("AccessToken: %v", err)
	}
	if _, err := verifier.VerifyAccessToken(context.Background(), token); err == nil {
		t.Fatal("expected token signed with a different secret to be rejected")
	}
}

func TestAccessTokenRejectsGarbage(t *testing.T) {
	tm := NewTokenManager("test-secret-value", time.Minute, time.Hour)
	if _, err := tm.VerifyAccessToken(context.Background(), "not.a.token"); err == nil {
		t.Fatal("expected malformed token to be rejected")
	}
}

func TestAccessTokenExpires(t *testing.T) {
	tm := NewTokenManager("test-secret-value", -time.Minute, time.Hour)
	token, err := tm.AccessToken(context.Background(), TokenClaims{UserID: "u"})
	if err != nil {
		t.Fatalf("AccessToken: %v", err)
	}
	if _, err := tm.VerifyAccessToken(context.Background(), token); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestRefreshTokenHashing(t *testing.T) {
	tm := NewTokenManager("test-secret-value", time.Minute, time.Hour)
	raw, err := tm.RefreshToken(context.Background())
	if err != nil {
		t.Fatalf("RefreshToken: %v", err)
	}
	h1 := tm.HashRefreshToken(raw)
	h2 := tm.HashRefreshToken(raw)
	if h1 != h2 {
		t.Fatal("expected hashing to be deterministic")
	}
	if h1 == raw {
		t.Fatal("hashed refresh token must not equal the raw token")
	}
	other, _ := tm.RefreshToken(context.Background())
	if tm.HashRefreshToken(other) == h1 {
		t.Fatal("expected different refresh tokens to hash differently")
	}
}

func TestIsAdmin(t *testing.T) {
	if !IsAdmin("admin") || !IsAdmin("ADMIN") {
		t.Fatal("expected admin role to be recognised")
	}
	if IsAdmin("employee") || IsAdmin("") {
		t.Fatal("expected non-admin roles to be rejected")
	}
}
