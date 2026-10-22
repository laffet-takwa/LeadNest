//go:build integration

package tests

import (
	"net/http"
	"testing"
	"time"
)

func TestActivityCreateAndRead(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("activity"))
	customerID := env.createCustomer(t, acc.Token, "Activity Customer", "activitycustomer@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":        "call",
		"subject":     "Intro call",
		"description": "Discussed the new pricing plan.",
	}, http.StatusCreated)
	data := created.Data()
	if data["type"] != "call" {
		t.Fatalf("expected type call, got %v", data["type"])
	}
	// The authenticated user is recorded automatically.
	if data["user_id"] != acc.UserID {
		t.Fatalf("expected the activity to be attributed to %s, got %v", acc.UserID, data["user_id"])
	}
	if data["customer_id"] != customerID {
		t.Fatalf("expected customer_id %s, got %v", customerID, data["customer_id"])
	}

	activityID, _ := data["id"].(string)
	env.mustDo(t, http.MethodGet, "/api/v1/activities/"+activityID, acc.Token, nil, http.StatusOK)
}

func TestActivityRejectsUnknownType(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("activitytype"))
	customerID := env.createCustomer(t, acc.Token, "Type Customer", "typecustomer@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":    "telegram",
		"subject": "Unknown type",
	}, http.StatusUnprocessableEntity)
}

func TestActivityListIsReverseChronological(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("activityorder"))
	customerID := env.createCustomer(t, acc.Token, "Order Customer", "ordercustomer@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":        "email",
		"subject":     "First",
		"occurred_at": time.Now().Add(-48 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":        "note",
		"subject":     "Second",
		"occurred_at": time.Now().Add(-24 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)

	resp := env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerID+"/activities", acc.Token, nil, http.StatusOK)
	items, _ := resp.Body["data"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 activities, got %d", len(items))
	}
	first, _ := items[0].(map[string]any)
	second, _ := items[1].(map[string]any)
	if first["subject"] != "Second" {
		t.Fatalf("expected the most recent activity first, got %v", first["subject"])
	}
	if second["subject"] != "First" {
		t.Fatalf("expected the older activity second, got %v", second["subject"])
	}
}

func TestActivityCanBeLinkedToDeal(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("activitydeal"))
	customerID := env.createCustomer(t, acc.Token, "Deal Link Customer", "deallink@example.test")

	deal := env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Linked deal",
		"value":       "100.00",
	}, http.StatusCreated)
	dealID, _ := deal.Data()["id"].(string)

	resp := env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":    "meeting",
		"subject": "Deal review",
		"deal_id": dealID,
	}, http.StatusCreated)
	if resp.Data()["deal_id"] != dealID {
		t.Fatalf("expected deal_id %s, got %v", dealID, resp.Data()["deal_id"])
	}

	byDeal := env.mustDo(t, http.MethodGet, "/api/v1/activities?deal_id="+dealID, acc.Token, nil, http.StatusOK)
	if total := byDeal.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 activity for the deal, got %v", total)
	}
}

func TestActivityIsTenantIsolated(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("activitytena"))
	accB := env.registerCompany(t, uniqueName("activitytenb"))
	customerA := env.createCustomer(t, accA.Token, "Isolated Activity Customer", "isolatedactivity@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerA+"/activities", accA.Token, map[string]any{
		"type":    "note",
		"subject": "Private note",
	}, http.StatusCreated)
	activityID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodGet, "/api/v1/activities/"+activityID, accB.Token, nil, http.StatusNotFound)
	env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerA+"/activities", accB.Token, nil, http.StatusNotFound)

	list := env.mustDo(t, http.MethodGet, "/api/v1/activities", accB.Token, nil, http.StatusOK)
	if total := list.Meta()["total"].(float64); total != 0 {
		t.Fatalf("expected company B to see 0 activities, got %v", total)
	}
}

func TestActivityCannotReferenceForeignCustomer(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("activityrefa"))
	accB := env.registerCompany(t, uniqueName("activityrefb"))
	customerA := env.createCustomer(t, accA.Token, "Referenced Customer", "referenced@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerA+"/activities", accB.Token, map[string]any{
		"type":    "note",
		"subject": "Should not exist",
	}, http.StatusNotFound)
}
