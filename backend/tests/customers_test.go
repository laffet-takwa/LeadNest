//go:build integration

package tests

import (
	"net/http"
	"testing"
)

func TestCustomerCRUD(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("custcrud"))

	created := env.mustDo(t, http.MethodPost, "/api/v1/customers", acc.Token, map[string]any{
		"full_name": "Acme Corporation",
		"email":     "contact@acme.test",
		"phone":     "+21620123456",
		"source":    "referral",
	}, http.StatusCreated)
	id, _ := created.Data()["id"].(string)
	if id == "" {
		t.Fatal("expected a customer id")
	}

	fetched := env.mustDo(t, http.MethodGet, "/api/v1/customers/"+id, acc.Token, nil, http.StatusOK)
	if fetched.Data()["full_name"] != "Acme Corporation" {
		t.Fatalf("unexpected customer %v", fetched.Data()["full_name"])
	}

	updated := env.mustDo(t, http.MethodPatch, "/api/v1/customers/"+id, acc.Token, map[string]any{
		"full_name": "Acme Corp Renamed",
	}, http.StatusOK)
	if updated.Data()["full_name"] != "Acme Corp Renamed" {
		t.Fatalf("expected the customer to be renamed, got %v", updated.Data()["full_name"])
	}

	env.mustDo(t, http.MethodDelete, "/api/v1/customers/"+id, acc.Token, nil, http.StatusNoContent)
	env.mustDo(t, http.MethodGet, "/api/v1/customers/"+id, acc.Token, nil, http.StatusNotFound)
}

func TestCustomerValidationRejectsBadEmailAndPhone(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("custvalid"))

	resp := env.mustDo(t, http.MethodPost, "/api/v1/customers", acc.Token, map[string]any{
		"full_name": "Bad Contact",
		"email":     "not-an-email",
		"phone":     "abc",
	}, http.StatusUnprocessableEntity)
	if resp.ErrorCode() != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %q", resp.ErrorCode())
	}
}

func TestCustomerSearchAndFilter(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("custsearch"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	env.mustDo(t, http.MethodPost, "/api/v1/customers", acc.Token, map[string]any{
		"full_name": "Searchable Person",
		"email":     "searchable@example.test",
		"phone":     "+21620999999",
		"source":    "web",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/customers", acc.Token, map[string]any{
		"full_name":   "Assigned Person",
		"assigned_to": empID,
		"source":      "phone",
	}, http.StatusCreated)

	byName := env.mustDo(t, http.MethodGet, "/api/v1/customers?search=searchable", acc.Token, nil, http.StatusOK)
	if total := byName.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 search result, got %v", total)
	}
	// A leading "+" must be percent-encoded in a query string, otherwise it
	// is decoded as a space.
	byPhone := env.mustDo(t, http.MethodGet, "/api/v1/customers?search=%2B21620999999", acc.Token, nil, http.StatusOK)
	if total := byPhone.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 phone search result, got %v", total)
	}
	bySource := env.mustDo(t, http.MethodGet, "/api/v1/customers?source=phone", acc.Token, nil, http.StatusOK)
	if total := bySource.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 source filter result, got %v", total)
	}
	byAssignee := env.mustDo(t, http.MethodGet, "/api/v1/customers?assigned_to="+empID, acc.Token, nil, http.StatusOK)
	if total := byAssignee.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 assignee filter result, got %v", total)
	}
}

func TestCustomerPaginationMetadata(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("custpage"))

	for i := 0; i < 3; i++ {
		env.mustDo(t, http.MethodPost, "/api/v1/customers", acc.Token, map[string]any{
			"full_name": uniqueName("Paged Customer"),
		}, http.StatusCreated)
	}

	resp := env.mustDo(t, http.MethodGet, "/api/v1/customers?limit=2&offset=0", acc.Token, nil, http.StatusOK)
	meta := resp.Meta()
	if meta["limit"].(float64) != 2 {
		t.Fatalf("expected limit 2, got %v", meta["limit"])
	}
	if meta["offset"].(float64) != 0 {
		t.Fatalf("expected offset 0, got %v", meta["offset"])
	}
	if meta["total"].(float64) != 3 {
		t.Fatalf("expected total 3, got %v", meta["total"])
	}
	items, _ := resp.Body["data"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 items in the page, got %d", len(items))
	}
}

func TestCustomerDetailsIncludeRelatedRecords(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("custdetails"))
	customerID := env.createCustomer(t, acc.Token, "Detailed Customer", "detailed@example.test")

	deal := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Linked deal",
		"value":       "100.00",
	}, http.StatusCreated)
	dealID, _ := deal.Data()["id"].(string)

	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":    "note",
		"subject": "Relevant note",
	}, http.StatusCreated)

	resp := env.mustDo(t, http.MethodGet,
		"/api/v1/customers/"+customerID+"?include=deals,activities", acc.Token, nil, http.StatusOK)
	data := resp.Data()

	deals, _ := data["deals"].([]any)
	if len(deals) != 1 {
		t.Fatalf("expected 1 related deal, got %d", len(deals))
	}
	firstDeal, _ := deals[0].(map[string]any)
	if firstDeal["id"] != dealID {
		t.Fatalf("expected deal %s, got %v", dealID, firstDeal["id"])
	}

	activities, _ := data["activities"].([]any)
	if len(activities) != 1 {
		t.Fatalf("expected 1 related activity, got %d", len(activities))
	}

	// Without the parameter the related records are omitted.
	plain := env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerID, acc.Token, nil, http.StatusOK)
	if _, present := plain.Data()["deals"]; present {
		t.Fatal("expected the related deals to be omitted when not requested")
	}

	// An unknown include value is rejected.
	env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerID+"?include=invoices", acc.Token, nil, http.StatusBadRequest)
}

func TestCustomerIsTenantIsolated(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("tenanta"))
	accB := env.registerCompany(t, uniqueName("tenantb"))

	customerA := env.createCustomer(t, accA.Token, "Private Person", "private@example.test")

	// Company B must not be able to read, update, or delete company A's customer.
	env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerA, accB.Token, nil, http.StatusNotFound)
	env.mustDo(t, http.MethodPatch, "/api/v1/customers/"+customerA, accB.Token, map[string]any{
		"full_name": "Hijacked",
	}, http.StatusNotFound)
	env.mustDo(t, http.MethodDelete, "/api/v1/customers/"+customerA, accB.Token, nil, http.StatusNotFound)

	list := env.mustDo(t, http.MethodGet, "/api/v1/customers", accB.Token, nil, http.StatusOK)
	if total := list.Meta()["total"].(float64); total != 0 {
		t.Fatalf("expected company B to see 0 customers, got %v", total)
	}
}

func TestCustomerCannotBeAssignedToAnotherCompanyEmployee(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("assigna"))
	accB := env.registerCompany(t, uniqueName("assignb"))
	empB, _, _ := env.createEmployee(t, accB, uniqueName("empb"))

	// The users foreign key alone would accept this id. The service must
	// reject it because the employee belongs to another company.
	resp := env.mustDo(t, http.MethodPost, "/api/v1/customers", accA.Token, map[string]any{
		"full_name":   "Cross Tenant",
		"assigned_to": empB,
	}, http.StatusNotFound)
	if resp.ErrorCode() != "NOT_FOUND" {
		t.Fatalf("expected NOT_FOUND, got %q", resp.ErrorCode())
	}

	// The same rule applies on update.
	customerA := env.createCustomer(t, accA.Token, "Owned Person", "owned@example.test")
	env.mustDo(t, http.MethodPatch, "/api/v1/customers/"+customerA, accA.Token, map[string]any{
		"assigned_to": empB,
	}, http.StatusNotFound)
}
