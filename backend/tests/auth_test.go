//go:build integration

package tests

import (
	"net/http"
	"testing"
)

func TestRegisterCreatesCompanyAndAdmin(t *testing.T) {
	env := setup(t)
	name := uniqueName("reg")

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"company": map[string]any{"name": name + " Ltd"},
		"admin": map[string]any{
			"full_name": "Owner",
			"email":     name + "@example.com",
			"password":  "ValidPass123",
		},
	}, http.StatusCreated)

	data := resp.Data()
	if data == nil {
		t.Fatal("expected a data payload")
	}
	token, _ := data["access_token"].(string)
	if token == "" {
		t.Fatal("expected an access token")
	}
	user, _ := data["user"].(map[string]any)
	if user["role"] != "admin" {
		t.Fatalf("expected the first user to be an admin, got %v", user["role"])
	}
	if user["company_id"] == "" {
		t.Fatal("expected the user to carry a company_id")
	}
	// The response must never contain a password hash.
	if _, present := user["password_hash"]; present {
		t.Fatal("response must not expose the password hash")
	}
}

func TestRegisterRejectsDuplicateEmail(t *testing.T) {
	env := setup(t)
	name := uniqueName("dup")
	payload := map[string]any{
		"company": map[string]any{"name": name + " Ltd"},
		"admin": map[string]any{
			"full_name": "Owner",
			"email":     name + "@example.com",
			"password":  "ValidPass123",
		},
	}
	env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", payload, http.StatusCreated)

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", payload, http.StatusConflict)
	if resp.ErrorCode() != "CONFLICT" {
		t.Fatalf("expected CONFLICT, got %q", resp.ErrorCode())
	}
}

func TestRegisterRollsBackOnFailure(t *testing.T) {
	env := setup(t)
	name := uniqueName("rollback")

	// A company name that is fine, but the admin email duplicates an existing
	// one. The transaction must roll back so no orphan company is left behind.
	existing := env.registerCompany(t, name)
	before := env.countRows(t, "companies")

	env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"company": map[string]any{"name": "Rolled Back Ltd"},
		"admin": map[string]any{
			"full_name": "Owner",
			"email":     existing.AdminEmail,
			"password":  "ValidPass123",
		},
	}, http.StatusConflict)

	after := env.countRows(t, "companies")
	if after != before {
		t.Fatalf("expected the company count to stay at %d after a rolled-back registration, got %d", before, after)
	}
}

func TestRegisterValidatesPayload(t *testing.T) {
	env := setup(t)

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"company": map[string]any{"name": ""},
		"admin": map[string]any{
			"full_name": "Owner",
			"email":     "not-an-email",
			"password":  "short",
		},
	}, http.StatusUnprocessableEntity)
	if resp.ErrorCode() != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %q", resp.ErrorCode())
	}
}

func TestLoginAndMe(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("login"))

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    acc.AdminEmail,
		"password": acc.AdminPass,
	}, http.StatusOK)

	data := resp.Data()
	token, _ := data["access_token"].(string)
	if token == "" {
		t.Fatal("expected an access token")
	}
	user, _ := data["user"].(map[string]any)
	if _, present := user["password_hash"]; present {
		t.Fatal("login response must not expose the password hash")
	}

	me := env.mustDo(t, http.MethodGet, "/api/v1/auth/me", token, nil, http.StatusOK)
	meUser, _ := me.Data()["user"].(map[string]any)
	if meUser["email"] != acc.AdminEmail {
		t.Fatalf("expected the authenticated user, got %v", meUser["email"])
	}
}

func TestLoginRejectsWrongPassword(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("wrongpw"))

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    acc.AdminEmail,
		"password": "TotallyWrongValue",
	}, http.StatusUnauthorized)
	if resp.ErrorCode() != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %q", resp.ErrorCode())
	}
}

func TestLoginRejectsInactiveAccount(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("inactive"))
	employeeID, employeeEmail, _ := env.createEmployee(t, acc, uniqueName("emp"))

	env.mustDo(t, http.MethodDelete, "/api/v1/users/"+employeeID, acc.Token, nil, http.StatusNoContent)

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    employeeEmail,
		"password": "EmployeePass123",
	}, http.StatusUnauthorized)
	if resp.ErrorCode() != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %q", resp.ErrorCode())
	}
}

func TestMeRequiresToken(t *testing.T) {
	env := setup(t)
	resp := env.mustDo(t, http.MethodGet, "/api/v1/auth/me", "", nil, http.StatusUnauthorized)
	if resp.ErrorCode() != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %q", resp.ErrorCode())
	}
}

func TestMeRejectsInvalidToken(t *testing.T) {
	env := setup(t)
	env.mustDo(t, http.MethodGet, "/api/v1/auth/me", "not.a.real.token", nil, http.StatusUnauthorized)
}

func TestRefreshIssuesNewAccessToken(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("refresh"))

	login := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    acc.AdminEmail,
		"password": acc.AdminPass,
	}, http.StatusOK)
	refresh, _ := login.Data()["refresh_token"].(string)
	if refresh == "" {
		t.Fatal("expected a refresh token")
	}

	resp := env.mustDo(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{
		"refresh_token": refresh,
	}, http.StatusOK)
	newToken, _ := resp.Data()["access_token"].(string)
	if newToken == "" {
		t.Fatal("expected a new access token")
	}
	env.mustDo(t, http.MethodGet, "/api/v1/auth/me", newToken, nil, http.StatusOK)
}

func TestRefreshRejectsUnknownToken(t *testing.T) {
	env := setup(t)
	env.mustDo(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{
		"refresh_token": "totally-bogus-refresh-token",
	}, http.StatusUnauthorized)
}

func TestLogoutRevokesRefreshToken(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("logout"))

	login := env.mustDo(t, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
		"email":    acc.AdminEmail,
		"password": acc.AdminPass,
	}, http.StatusOK)
	refresh, _ := login.Data()["refresh_token"].(string)

	env.mustDo(t, http.MethodPost, "/api/v1/auth/logout", acc.Token, nil, http.StatusNoContent)

	env.mustDo(t, http.MethodPost, "/api/v1/auth/refresh", "", map[string]any{
		"refresh_token": refresh,
	}, http.StatusUnauthorized)
}

func TestEmployeeCannotManageUsers(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("rbac"))
	_, _, empToken := env.createEmployee(t, acc, uniqueName("emp"))

	resp := env.mustDo(t, http.MethodGet, "/api/v1/users", empToken, nil, http.StatusForbidden)
	if resp.ErrorCode() != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %q", resp.ErrorCode())
	}
}

func TestEmployeeCannotPromoteSelf(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("promote"))
	empID, _, empToken := env.createEmployee(t, acc, uniqueName("emp"))

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/users/"+empID, empToken, map[string]any{
		"role": "admin",
	}, http.StatusForbidden)
	if resp.ErrorCode() != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %q", resp.ErrorCode())
	}
}

func TestAdminCannotDeactivateSelf(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("selfdeact"))

	resp := env.mustDo(t, http.MethodDelete, "/api/v1/users/"+acc.UserID, acc.Token, nil, http.StatusForbidden)
	if resp.ErrorCode() != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %q", resp.ErrorCode())
	}
}

func TestAdminCannotModifyAnotherCompanyUser(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("tenanta"))
	accB := env.registerCompany(t, uniqueName("tenantb"))
	userB, _, _ := env.createEmployee(t, accB, uniqueName("empb"))

	// Admin A tries to modify a user that belongs to company B.
	resp := env.mustDo(t, http.MethodPatch, "/api/v1/users/"+userB, accA.Token, map[string]any{
		"role": "admin",
	}, http.StatusNotFound)
	if resp.ErrorCode() != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %q", resp.ErrorCode())
	}
}

func TestCompanyMeIsTenantScoped(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("companyme"))

	resp := env.mustDo(t, http.MethodGet, "/api/v1/companies/me", acc.Token, nil, http.StatusOK)
	company, _ := resp.Data()["company"].(map[string]any)
	if company["name"] != acc.CompanyName {
		t.Fatalf("expected company %q, got %v", acc.CompanyName, company["name"])
	}

	// An employee of the same company may read the company but not edit it.
	_, _, empToken := env.createEmployee(t, acc, uniqueName("emp"))
	env.mustDo(t, http.MethodGet, "/api/v1/companies/me", empToken, nil, http.StatusOK)
	env.mustDo(t, http.MethodPatch, "/api/v1/companies/me", empToken, map[string]any{
		"name": "Hijacked",
	}, http.StatusForbidden)
}

func TestAdminCanUpdateCompany(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("companyupd"))

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/companies/me", acc.Token, map[string]any{
		"name":    "Renamed Company",
		"email":   "new@example.com",
		"phone":   "+21620123456",
		"website": "https://new.example.com",
	}, http.StatusOK)
	company := resp.Data()
	if company["name"] != "Renamed Company" {
		t.Fatalf("expected the company to be renamed, got %v", company["name"])
	}
}
