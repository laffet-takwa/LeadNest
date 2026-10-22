//go:build integration

package tests

import (
	"net/http"
	"testing"
	"time"
)

func TestTaskCRUDAndCompletion(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("taskcrud"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))
	customerID := env.createCustomer(t, acc.Token, "Task Customer", "taskcustomer@example.test")

	created := env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"customer_id": customerID,
		"title":       "Call the customer",
		"description": "Introduce the new offer",
		"priority":    "high",
		"due_date":    time.Now().Add(48 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)
	data := created.Data()
	taskID, _ := data["id"].(string)
	if taskID == "" {
		t.Fatal("expected a task id")
	}
	if data["status"] != "pending" {
		t.Fatalf("expected the default status to be pending, got %v", data["status"])
	}
	if data["priority"] != "high" {
		t.Fatalf("expected priority high, got %v", data["priority"])
	}

	completed := env.mustDo(t, http.MethodPatch, "/api/v1/tasks/"+taskID, acc.Token, map[string]any{
		"status": "completed",
	}, http.StatusOK)
	if completed.Data()["completed_at"] == nil {
		t.Fatal("expected completed_at to be set when the task is completed")
	}

	env.mustDo(t, http.MethodDelete, "/api/v1/tasks/"+taskID, acc.Token, nil, http.StatusNoContent)
	env.mustDo(t, http.MethodGet, "/api/v1/tasks/"+taskID, acc.Token, nil, http.StatusNotFound)
}

func TestTaskReopenedClearsCompletedAt(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("taskreopen"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	created := env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Reopened task",
	}, http.StatusCreated)
	taskID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodPatch, "/api/v1/tasks/"+taskID, acc.Token, map[string]any{
		"status": "completed",
	}, http.StatusOK)

	resp := env.mustDo(t, http.MethodPatch, "/api/v1/tasks/"+taskID, acc.Token, map[string]any{
		"status": "pending",
	}, http.StatusOK)
	if resp.Data()["completed_at"] != nil {
		t.Fatalf("expected completed_at to be cleared, got %v", resp.Data()["completed_at"])
	}
}

func TestTaskRejectsInvalidStatusAndPriority(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("taskvalid"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Bad status",
		"status":      "archived",
	}, http.StatusUnprocessableEntity)

	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Bad priority",
		"priority":    "urgent",
	}, http.StatusUnprocessableEntity)
}

func TestTaskRejectsForeignCustomerAndDeal(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("tasktena"))
	accB := env.registerCompany(t, uniqueName("tasktenb"))
	empB, _, _ := env.createEmployee(t, accB, uniqueName("empb"))
	customerA := env.createCustomer(t, accA.Token, "Foreign Task Customer", "foreigntask@example.test")

	env.mustDo(t, http.MethodPost, "/api/v1/tasks", accB.Token, map[string]any{
		"assigned_to": empB,
		"customer_id": customerA,
		"title":       "Cross tenant task",
	}, http.StatusNotFound)
}

func TestTaskOverdueFilter(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("taskoverdue"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Overdue task",
		"due_date":    time.Now().Add(-72 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)
	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Future task",
		"due_date":    time.Now().Add(72 * time.Hour).Format(time.RFC3339),
	}, http.StatusCreated)

	overdue := env.mustDo(t, http.MethodGet, "/api/v1/tasks?overdue=true", acc.Token, nil, http.StatusOK)
	if total := overdue.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 overdue task, got %v", total)
	}
}

func TestTaskFilters(t *testing.T) {
	env := setup(t)
	acc := env.registerCompany(t, uniqueName("taskfilters"))
	empID, _, _ := env.createEmployee(t, acc, uniqueName("emp"))

	env.mustDo(t, http.MethodPost, "/api/v1/tasks", acc.Token, map[string]any{
		"assigned_to": empID,
		"title":       "Low priority task",
		"priority":    "low",
	}, http.StatusCreated)

	byPriority := env.mustDo(t, http.MethodGet, "/api/v1/tasks?priority=low", acc.Token, nil, http.StatusOK)
	if total := byPriority.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 low-priority task, got %v", total)
	}
	byAssignee := env.mustDo(t, http.MethodGet, "/api/v1/tasks?assigned_to="+empID, acc.Token, nil, http.StatusOK)
	if total := byAssignee.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 task for the assignee, got %v", total)
	}
	byStatus := env.mustDo(t, http.MethodGet, "/api/v1/tasks?status=pending", acc.Token, nil, http.StatusOK)
	if total := byStatus.Meta()["total"].(float64); total != 1 {
		t.Fatalf("expected 1 pending task, got %v", total)
	}
}

func TestTaskIsTenantIsolated(t *testing.T) {
	env := setup(t)
	accA := env.registerCompany(t, uniqueName("taskisoa"))
	accB := env.registerCompany(t, uniqueName("taskisob"))
	empA, _, _ := env.createEmployee(t, accA, uniqueName("empa"))

	created := env.mustDo(t, http.MethodPost, "/api/v1/tasks", accA.Token, map[string]any{
		"assigned_to": empA,
		"title":       "Private task",
	}, http.StatusCreated)
	taskID, _ := created.Data()["id"].(string)

	env.mustDo(t, http.MethodGet, "/api/v1/tasks/"+taskID, accB.Token, nil, http.StatusNotFound)
	env.mustDo(t, http.MethodPatch, "/api/v1/tasks/"+taskID, accB.Token, map[string]any{
		"title": "Hijacked",
	}, http.StatusNotFound)
	env.mustDo(t, http.MethodDelete, "/api/v1/tasks/"+taskID, accB.Token, nil, http.StatusNotFound)

	list := env.mustDo(t, http.MethodGet, "/api/v1/tasks", accB.Token, nil, http.StatusOK)
	if total := list.Meta()["total"].(float64); total != 0 {
		t.Fatalf("expected company B to see 0 tasks, got %v", total)
	}
}
