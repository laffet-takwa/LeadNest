//go:build integration

package tests

import (
	"net/http"
	"testing"
)

func TestDealCRUD(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealcrud"))
	customerID := env.createCustomer(t, acc.Token, "Deal Customer", "dealcustomer@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Annual licence",
		"value":       "1500.50",
		"currency":    "TND",
	}, http.StatusCreated)
	data := created.Data()
	dealID, _ := data["id"].(string)
	if dealID == "" {
		t.Fatal("expected a deal id")
	}
	if data["status"] != "new" {
		t.Fatalf("expected the default status to be 'new', got %v", data["status"])
	}
	if data["value"] != "1500.50" {
		t.Fatalf("expected the value to be preserved exactly, got %v", data["value"])
	}

	env.mustDo(t, http.MethodGet, "/api/v1/deals/"+dealID, acc.Token, nil, http.StatusOK)
	env.mustDo(t, http.MethodDelete, "/api/v1/deals/"+dealID, acc.Token, nil, http.StatusNoContent)
	env.mustDo(t, http.MethodGet, "/api/v1/deals/"+dealID, acc.Token, nil, http.StatusNotFound)
}

func TestDealRejectsInvalidAmount(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealbad"))
	customerID := env.createCustomer(t, acc.Token, "Amount Customer", "amount@example.test")

	for _, bad := range []string{"-5", "abc", "1.234"} {
		resp := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
			"customer_id": customerID,
			"title":       "Bad value",
			"value":       bad,
		}, http.StatusUnprocessableEntity)
		if resp.ErrorCode() != "VALIDATION_ERROR" {
			t.Fatalf("expected VALIDATION_ERROR for %q, got %q", bad, resp.ErrorCode())
		}
	}
}

func TestDealRejectsInvalidCurrency(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealcur"))
	customerID := env.createCustomer(t, acc.Token, "Currency Customer", "currency@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Bad currency",
		"value":       "10",
		"currency":    "DOLLARS",
	}, http.StatusUnprocessableEntity)
}

func TestDealRejectsCustomerFromAnotherCompany(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("deala"))
	accB := env.registerCompany(t, uniqueName("dealb"))
	customerA := env.createCustomer(t, accA.Token, "Foreign Customer", "foreign@example.test")

	resp := env.mustDo(t, http.MethodPost, "/api/v1/deals", accB.Token, map[string]any{
		"customer_id": customerA,
		"title":       "Cross tenant deal",
		"value":       "10",
	}, http.StatusNotFound)
	if resp.ErrorCode() != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %q", resp.ErrorCode())
	}
}

func TestDealStatusTransitionToWonRecordsClosedAt(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealwon"))
	customerID := env.createCustomer(t, acc.Token, "Won Customer", "won@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Closed won",
		"value":       "2500.00",
	}, http.StatusCreated)
	dealID, _ := created.Data()["id"].(string)

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, acc.Token, map[string]any{
		"status": "won",
	}, http.StatusOK)
	data := resp.Data()
	if data["status"] != "won" {
		t.Fatalf("expected status won, got %v", data["status"])
	}
	if data["closed_at"] == nil {
		t.Fatal("expected closed_at to be set when the deal transitions to won")
	}
}

func TestDealStatusTransitionToLostRecordsClosedAt(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("deallost"))
	customerID := env.createCustomer(t, acc.Token, "Lost Customer", "lost@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Closed lost",
		"value":       "500.00",
	}, http.StatusCreated)
	dealID, _ := created.Data()["id"].(string)

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, acc.Token, map[string]any{
		"status": "lost",
	}, http.StatusOK)
	if resp.Data()["closed_at"] == nil {
		t.Fatal("expected closed_at to be set when the deal transitions to lost")
	}
}

func TestDealReopenClearsClosedAt(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealreopen"))
	customerID := env.createCustomer(t, acc.Token, "Reopen Customer", "reopen@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Reopened",
		"value":       "100.00",
	}, http.StatusCreated)
	dealID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, acc.Token, map[string]any{
		"status": "won",
	}, http.StatusOK)

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, acc.Token, map[string]any{
		"status": "negotiation",
	}, http.StatusOK)
	if resp.Data()["closed_at"] != nil {
		t.Fatalf("expected closed_at to be cleared when the deal is reopened, got %v", resp.Data()["closed_at"])
	}
}

func TestDealRejectsUnknownStatus(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealstatus"))
	customerID := env.createCustomer(t, acc.Token, "Status Customer", "status@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Bad status",
		"value":       "100.00",
	}, http.StatusCreated)
	dealID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, acc.Token, map[string]any{
		"status": "archived",
	}, http.StatusUnprocessableEntity)
}

func TestDealDatabaseConstraintRejectsInvalidStatus(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealconstraint"))
	customerID := env.createCustomer(t, acc.Token, "Constraint Customer", "constraint@example.test")

	// Bypass the API to prove the database constraint also protects the data.
	_, err := env.store.Exec(t.Context(),
		`INSERT INTO deals (company_id, customer_id, title, value, currency, status)
         VALUES ($1, $2, 'Invalid', 10, 'TND', 'archived')`,
		acc.CompanyID, customerID)
	if err == nil {
		t.Fatal("expected the database to reject an invalid deal status")
	}
}

func TestDealFiltersAndPagination(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dealfilters"))
	customerID := env.createCustomer(t, acc.Token, "Filter Customer", "filter@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Alpha deal",
		"value":       "100.00",
		"status":      "new",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Beta deal",
		"value":       "200.00",
		"status":      "won",
	}, http.StatusCreated)

	byStatus := env.mustDo(t, http.MethodGet, "/api/v1/deals?status=won", acc.Token, nil, http.StatusOK)
	if total := byStatus.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 deal with status won, got %v", total)
	}
	byCustomer := env.mustDo(t, http.MethodGet, "/api/v1/deals?customer_id="+customerID, acc.Token, nil, http.StatusOK)
	if total := byCustomer.Meta()["total"].(float64); total != 2 {
		t.Fatalf("expected 2 deals for the customer, got %v", total)
	}
	bySearch := env.mustDo(t, http.MethodGet, "/api/v1/deals?search=alpha", acc.Token, nil, http.StatusOK)
	if total := bySearch.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 search result, got %v", total)
	}
	byInvalidStatus := env.mustDo(t, http.MethodGet, "/api/v1/deals?status=bogus", acc.Token, nil, http.StatusBadRequest)
	if byInvalidStatus.ErrorCode() != "BAD_REQUEST" {
		t.Fatalf("expected BAD_REQUEST, got %q", byInvalidStatus.ErrorCode())
	}
}

func TestDealIsTenantIsolated(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("dealtena"))
	accB := env.registerCompany(t, uniqueName("dealtenb"))
	customerA := env.createCustomer(t, accA.Token, "Isolated Customer", "isolated@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/deals", accA.Token, map[string]any{
		"customer_id": customerA,
		"title":       "Private deal",
		"value":       "999.99",
	}, http.StatusCreated)
	dealID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodGet, "/api/v1/deals/"+dealID, accB.Token, nil, http.StatusNotFound)
	env.mustDo(t, http.MethodPatch, "/api/v1/deals/"+dealID, accB.Token, map[string]any{
		"title": "Hijacked",
	}, http.StatusNotFound)
	env.mustDo(t, http.MethodDelete, "/api/v1/deals/"+dealID, accB.Token, nil, http.StatusNotFound)

	list := env.mustDo(t, http.MethodGet, "/api/v1/deals", accB.Token, nil, http.StatusOK)
	if total := list.Meta()["total"].(float64); total != 0 {
		t.Fatalf("expected company B to see 0 deals, got %v", total)
	}
}
