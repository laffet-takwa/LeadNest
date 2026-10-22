// Package models holds shared domain types used across handlers and repos.
package models

import "time"

// NullString converts a nullable database value into a plain string. A NULL
// column becomes the empty string, which the JSON encoders omit because the
// relevant fields are tagged with omitempty.
func NullString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// NullInt converts a nullable database value into a plain int.
func NullInt(p *int) int {
	if p == nil {
		return 0
	}
	return *p
}

// Role constants.
const (
	RoleAdmin    = "admin"
	RoleEmployee = "employee"
)

// Deal statuses.
const (
	DealNew         = "new"
	DealContacted   = "contacted"
	DealQualified   = "qualified"
	DealProposal    = "proposal"
	DealNegotiation = "negotiation"
	DealWon         = "won"
	DealLost        = "lost"
)

// Task statuses.
const (
	TaskPending   = "pending"
	TaskCompleted = "completed"
	TaskCancelled = "cancelled"
)

// Task priorities.
const (
	PriorityLow    = "low"
	PriorityMedium = "medium"
	PriorityHigh   = "high"
)

// Activity types.
const (
	ActCall    = "call"
	ActEmail   = "email"
	ActMeeting = "meeting"
	ActNote    = "note"
	ActMessage = "message"
	ActOther   = "other"
)

// Pagination params.
type Pagination struct {
	Limit  int
	Offset int
}

// DefaultPagination caps page size.
const MaxPageSize = 100

// Company represents the companies table.
type Company struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email,omitempty"`
	Phone     string    `json:"phone,omitempty"`
	Website   string    `json:"website,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// User represents the users table.
type User struct {
	ID        string    `json:"id"`
	CompanyID string    `json:"company_id"`
	FullName  string    `json:"full_name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Customer represents the customers table.
type Customer struct {
	ID         string    `json:"id"`
	CompanyID  string    `json:"company_id"`
	AssignedTo string    `json:"assigned_to,omitempty"`
	FullName   string    `json:"full_name"`
	Company    string    `json:"company,omitempty"`
	Email      string    `json:"email,omitempty"`
	Phone      string    `json:"phone,omitempty"`
	Source     string    `json:"source,omitempty"`
	Notes      string    `json:"notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Deal represents the deals table.
type Deal struct {
	ID            string     `json:"id"`
	CompanyID     string     `json:"company_id"`
	CustomerID    string     `json:"customer_id"`
	AssignedTo    string     `json:"assigned_to,omitempty"`
	Title         string     `json:"title"`
	Description   string     `json:"description,omitempty"`
	Value         string     `json:"value"`
	Currency      string     `json:"currency"`
	Status        string     `json:"status"`
	ExpectedClose *time.Time `json:"expected_close,omitempty"`
	ClosedAt      *time.Time `json:"closed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// Task represents the tasks table.
type Task struct {
	ID          string     `json:"id"`
	CompanyID   string     `json:"company_id"`
	AssignedTo  string     `json:"assigned_to"`
	CustomerID  string     `json:"customer_id,omitempty"`
	DealID      string     `json:"deal_id,omitempty"`
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	Status      string     `json:"status"`
	Priority    string     `json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// Activity represents the activities table.
type Activity struct {
	ID          string    `json:"id"`
	CompanyID   string    `json:"company_id"`
	UserID      string    `json:"user_id"`
	CustomerID  string    `json:"customer_id,omitempty"`
	DealID      string    `json:"deal_id,omitempty"`
	Type        string    `json:"type"`
	Subject     string    `json:"subject,omitempty"`
	Description string    `json:"description,omitempty"`
	OccurredAt  time.Time `json:"occurred_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AIInteraction represents the ai_interactions table.
type AIInteraction struct {
	ID              string    `json:"id"`
	CompanyID       string    `json:"company_id"`
	UserID          string    `json:"user_id"`
	InteractionType string    `json:"interaction_type"`
	Prompt          string    `json:"prompt,omitempty"`
	Response        string    `json:"response,omitempty"`
	Model           string    `json:"model,omitempty"`
	Provider        string    `json:"provider,omitempty"`
	DurationMs      int       `json:"duration_ms,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
