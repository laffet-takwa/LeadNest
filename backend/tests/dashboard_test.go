//go:build integration

package tests

import (
	"net/http"
	"testing"
	"time"
)

func TestDashboardMetrics(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dash"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	// Two customers.
	c1 := env.createCustomer(t, acc.Token, "Dash Customer One", "dashone@example.test")
	c2 := env.createCustomer(t, acc.Token, "Dash Customer Two", "dashtwo@example.test")
	_ = c2

	// One won deal worth 1000 TND, one open deal worth 500 TND, one lost deal.
	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": c1,
		"title":       "Won deal",
		"value":       "1000.00",
		"currency":    "TND",
		"status":      "won",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": c1,
		"title":       "Open deal",
		"value":       "500.00",
		"currency":    "TND",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": c1,
		"title":       "Lost deal",
		"value":       "300.00",
		"currency":    "TND",
		"status":      "lost",
	}, http.StatusCreated)

	// Two pending tasks: one overdue, one in the future.
	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Overdue task",
		"due_date":    time.Now().Add(-48 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Future task",
		"due_date":    time.Now().Add(48 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)

	resp := env.mustDo(t, http.MethodGet, "/api/v1/dashboard", acc.Token, nil, http.StatusOK)
	data := resp.Data()
	metrics, _ := data["metrics"].(map[string]any)

	if metrics["total_customers"].(float64) != 2 {
		t.Fatalf("expected 2 customers, got %v", metrics["total_customers"])
	}
	if metrics["open_deals"].(float64) != 1 {
		t.Fatalf("expected 1 open deal, got %v", metrics["open_deals"])
	}
	if metrics["won_deals"].(float64) != 1 {
		t.Fatalf("expected 1 won deal, got %v", metrics["won_deals"])
	}
	if metrics["lost_deals"].(float64) != 1 {
		t.Fatalf("expected 1 lost deal, got %v", metrics["lost_deals"])
	}
	if metrics["pending_tasks"].(float64) != 2 {
		t.Fatalf("expected 2 pending tasks, got %v", metrics["pending_tasks"])
	}
	if metrics["overdue_tasks"].(float64) != 1 {
		t.Fatalf("expected 1 overdue task, got %v", metrics["overdue_tasks"])
	}
	revenue := metrics["won_revenue_tnd"].(string)
	if revenue != "1000.00" {
		t.Fatalf("expected won revenue 1000.00, got %q", revenue)
	}
}

func TestDashboardGroupsRevenueByCurrency(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dashcur"))
	customerID := env.createCustomer(t, acc.Token, "Currency Customer", "dashcurrency@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "TND deal",
		"value":       "100.00",
		"currency":    "TND",
		"status":      "won",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "USD deal",
		"value":       "250.00",
		"currency":    "USD",
		"status":      "won",
	}, http.StatusCreated)

	dash := env.mustDo(t, http.MethodGet, "/api/v1/dashboard", acc.Token, nil, http.StatusOK)
	byCurrency, _ := dash.Data()["revenue_by_currency"].([]any)
	if len(byCurrency) != 2 {
		t.Fatalf("expected 2 currency buckets, got %d", len(byCurrency))
	}
	seen := map[string]string{}
	for _, raw := range byCurrency {
		bucket, _ := raw.(map[string]any)
		cur, _ := bucket["currency"].(string)
		val, _ := bucket["value"].(string)
		seen[cur] = val
	}
	if seen["TND"] != "100.00" {
		t.Fatalf("expected TND revenue 100.00, got %q", seen["TND"])
	}
	if seen["USD"] != "250.00" {
		t.Fatalf("expected USD revenue 250.00, got %q", seen["USD"])
	}
	// The TND-only figure in the metrics must not include the USD amount.
	metrics, _ := dash.Data()["metrics"].(map[string]any)
	if metrics["won_revenue_tnd"].(string) != "100.00" {
		t.Fatalf("expected won_revenue_tnd 100.00, got %q", metrics["won_revenue_tnd"].(string))
	}
}

func TestDashboardIsTenantIsolated(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("dashtena"))
	accB := env.registerCompany(t, uniqueName("dashtenb"))
	env.createCustomer(t, accA.Token, "Company A Customer", "companyacustomer@example.test")

	resp := env.mustDo(t, http.MethodGet, "/api/v1/dashboard", accB.Token, nil, http.StatusOK)
	metrics, _ := resp.Data()["metrics"].(map[string]any)
	if metrics["total_customers"].(float64) != 0 {
		t.Fatalf("expected company B to see 0 customers, got %v", metrics["total_customers"])
	}
}

func TestDashboardSalesPipeline(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dashpipe"))
	customerID := env.createCustomer(t, acc.Token, "Pipeline Customer", "pipelinecustomer@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/deals", acc.Token, map[string]any{
		"customer_id": customerID,
		"title":       "Pipeline deal",
		"value":       "750.25",
		"currency":    "TND",
		"status":      "proposal",
	}, http.StatusCreated)

	resp := env.mustDo(t, http.MethodGet, "/api/v1/dashboard/sales-pipeline", acc.Token, nil, http.StatusOK)
	buckets, _ := resp.Body["data"].([]any)
	if len(buckets) != 1 {
		t.Fatalf("expected 1 pipeline bucket, got %d", len(buckets))
	}
	bucket, _ := buckets[0].(map[string]any)
	if bucket["status"] != "proposal" {
		t.Fatalf("expected status proposal, got %v", bucket["status"])
	}
	if bucket["value"] != "750.25" {
		t.Fatalf("expected value 750.25, got %v", bucket["value"])
	}
}

func TestDashboardRecentActivitiesAndUpcomingTasks(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("dashfeed"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))
	customerID := env.createCustomer(t, acc.Token, "Feed Customer", "feedcustomer@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/customers/"+customerID+"/activities", acc.Token, map[string]any{
		"type":    "email",
		"subject": "Sent the proposal",
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Upcoming follow-up",
		"due_date":    time.Now().Add(24 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)

	activities := env.mustDo(t, http.MethodGet, "/api/v1/dashboard/recent-activities", acc.Token, nil, http.StatusOK)
	acts, _ := activities.Body["data"].([]any)
	if len(acts) != 1 {
		t.Fatalf("expected 1 recent activity, got %d", len(acts))
	}
	act, _ := acts[0].(map[string]any)
	if act["subject"] != "Sent the proposal" {
		t.Fatalf("unexpected activity %v", act["subject"])
	}
	if act["customer_name"] != "Feed Customer" {
		t.Fatalf("expected the customer name to be included, got %v", act["customer_name"])
	}

	tasks := env.mustDo(t, http.MethodGet, "/api/v1/dashboard/upcoming-tasks", acc.Token, nil, http.StatusOK)
	upcoming, _ := tasks.Body["data"].([]any)
	if len(upcoming) != 1 {
		t.Fatalf("expected 1 upcoming task, got %d", len(upcoming))
	}
	task, _ := upcoming[0].(map[string]any)
	if task["title"] != "Upcoming follow-up" {
		t.Fatalf("unexpected task %v", task["title"])
	}
	if task["overdue"] != false {
		t.Fatalf("expected the task not to be overdue, got %v", task["overdue"])
	}
}

func TestHealthAndReadyEndpoints(t *testing.T) {
	env := setup(t)

	health := env.mustDo(t, http.MethodGet, "/health", "", nil, http.StatusOK)
	if health.Data()["status"] != "ok" {
		t.Fatalf("unexpected health payload %v", health.Data())
	}

	ready := env.mustDo(t, http.MethodGet, "/ready", "", nil, http.StatusOK)
	if ready.Data()["status"] != "ready" {
		t.Fatalf("unexpected readiness payload %v", ready.Data())
	}
}

func TestAIEndpointsDegradeGracefullyWhenUnconfigured(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("ai"))
	customerID := env.createCustomer(t, acc.Token, "AI Customer", "aicustomer@example.test")

	resp := env.mustDo(t, http.MethodPost, "/api/v1/ai/email-draft", acc.Token, map[string]any{
		"customer_id": customerID,
	}, http.StatusServiceUnavailable)
	if resp.ErrorCode() != "AI_NOT_CONFIGURED" {
		t.Fatalf("expected AI_NOT_CONFIGURED, got %q", resp.ErrorCode())
	}

	// The rest of the API must keep working.
	env.mustDo(t, http.MethodGet, "/api/v1/customers/"+customerID, acc.Token, nil, http.StatusOK)
}

func TestAIHistoryIsTenantScoped(t *testing.T) {
	env := setup(t)
	accB := env.registerCompany(t, uniqueName("aihistb"))

	resp := env.mustDo(t, http.MethodGet, "/api/v1/ai/history", accB.Token, nil, http.StatusOK)
	if total := resp.Meta()["total"].(float64); total != 0 {
		t.Fatalf("expected company B to see 0 AI interactions, got %v", total)
	}
}
