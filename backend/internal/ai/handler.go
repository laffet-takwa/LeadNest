package ai

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/leadnest/backend/internal/database"
	"github.com/leadnest/backend/internal/middleware"
	"github.com/leadnest/backend/internal/models"
	"github.com/leadnest/backend/internal/response"
	"github.com/leadnest/backend/internal/validation"
)

// Interaction types recorded in ai_interactions.
const (
	TypeEmailDraft          = "email_draft"
	TypeCustomerSummary     = "customer_summary"
	TypeFollowUpSuggestions = "follow_up_suggestions"
)

// maxRequestBytes bounds the size of an AI request payload.
const maxRequestBytes = 64 * 1024

// maxPromptChars bounds how much CRM text is embedded in a prompt.
const maxPromptChars = 6000

type Handler struct {
	store   *database.Store
	service *Service
}

func NewHandler(store *database.Store, service *Service) *Handler {
	return &Handler{store: store, service: service}
}

// --- CRM context gathering (tenant scoped) ---

type customerContext struct {
	ID        string
	FullName  string
	Email     string
	Phone     string
	Source    string
	CreatedAt time.Time
}

type dealContext struct {
	ID            string
	Title         string
	Value         string
	Currency      string
	Status        string
	ExpectedClose *time.Time
}

type activityContext struct {
	Type        string
	Subject     string
	Description string
	OccurredAt  time.Time
}

func loadCustomer(ctx context.Context, querier database.Querier, companyID, customerID string) (customerContext, error) {
	const q = `SELECT id, full_name, COALESCE(email, ''), COALESCE(phone, ''), COALESCE(source, ''), created_at
              FROM customers WHERE company_id = $1 AND id = $2`
	var c customerContext
	err := querier.QueryRow(ctx, q, companyID, customerID).Scan(
		&c.ID, &c.FullName, &c.Email, &c.Phone, &c.Source, &c.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c, errCustomerNotFound
		}
		return c, err
	}
	return c, nil
}

func loadDeal(ctx context.Context, querier database.Querier, companyID, dealID string) (dealContext, error) {
	const q = `SELECT id, title, value::text, currency, status, expected_close
              FROM deals WHERE company_id = $1 AND id = $2`
	var d dealContext
	err := querier.QueryRow(ctx, q, companyID, dealID).Scan(
		&d.ID, &d.Title, &d.Value, &d.Currency, &d.Status, &d.ExpectedClose,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return d, errDealNotFound
		}
		return d, err
	}
	return d, nil
}

func loadActivities(ctx context.Context, querier database.Querier, companyID, customerID string, limit int) ([]activityContext, error) {
	const q = `SELECT type, COALESCE(subject, ''), COALESCE(description, ''), occurred_at
              FROM activities
              WHERE company_id = $1 AND customer_id = $2
              ORDER BY occurred_at DESC
              LIMIT $3`
	rows, err := querier.Query(ctx, q, companyID, customerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []activityContext{}
	for rows.Next() {
		var a activityContext
		if err := rows.Scan(&a.Type, &a.Subject, &a.Description, &a.OccurredAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// followUpCandidate is a customer that may need follow-up, with its staleness.
type followUpCandidate struct {
	CustomerID    string
	CustomerName  string
	Email         string
	AssignedTo    string
	LastActivity  *time.Time
	OpenDeals     int64
	DaysSinceLast *int
}

func loadFollowUpCandidates(ctx context.Context, querier database.Querier, companyID string, limit int) ([]followUpCandidate, error) {
	const q = `SELECT c.id, c.full_name, COALESCE(c.email, ''), COALESCE(c.assigned_to::text, ''),
                     MAX(a.occurred_at),
                     (SELECT COUNT(*) FROM deals d WHERE d.customer_id = c.id AND d.status NOT IN ('won','lost')),
                     EXTRACT(DAY FROM (NOW() - MAX(a.occurred_at)))::int
              FROM customers c
              LEFT JOIN activities a ON a.customer_id = c.id
              WHERE c.company_id = $1
              GROUP BY c.id, c.full_name, c.email, c.assigned_to
              ORDER BY MAX(a.occurred_at) ASC NULLS FIRST, c.created_at ASC
              LIMIT $2`
	rows, err := querier.Query(ctx, q, companyID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []followUpCandidate{}
	for rows.Next() {
		var c followUpCandidate
		var last *time.Time
		var days *int
		if err := rows.Scan(&c.CustomerID, &c.CustomerName, &c.Email, &c.AssignedTo, &last, &c.OpenDeals, &days); err != nil {
			return nil, err
		}
		c.LastActivity = last
		c.DaysSinceLast = days
		out = append(out, c)
	}
	return out, rows.Err()
}

// --- Prompt building ---

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "…"
}

// redactContact removes the email address from a prompt body. It keeps the
// draft useful while limiting personal data sent to the provider.
func redactContact(name, email string) string {
	if email == "" {
		return name
	}
	return name + " (contact details withheld)"
}

func buildCustomerContextBlock(c customerContext, deals []dealContext, acts []activityContext) string {
	var b strings.Builder
	b.WriteString("Customer profile:\n")
	b.WriteString(fmt.Sprintf("- Name: %s\n", truncate(c.FullName, 200)))
	if c.Source != "" {
		b.WriteString(fmt.Sprintf("- Source: %s\n", truncate(c.Source, 100)))
	}
	if c.Phone != "" {
		b.WriteString("- Phone: provided (withheld)\n")
	}
	if len(deals) > 0 {
		b.WriteString("Open deals:\n")
		for _, d := range deals {
			b.WriteString(fmt.Sprintf("- %s | %s %s | status=%s\n",
				truncate(d.Title, 150), d.Value, d.Currency, d.Status))
		}
	}
	if len(acts) > 0 {
		b.WriteString("Recent activity (most recent first):\n")
		for _, a := range acts {
			line := fmt.Sprintf("- [%s] %s", a.Type, truncate(a.Subject, 150))
			if a.Description != "" {
				line += ": " + truncate(a.Description, 300)
			}
			b.WriteString(line + "\n")
		}
	}
	return truncate(b.String(), maxPromptChars)
}

// --- Handlers ---

type emailDraftRequest struct {
	CustomerID string `json:"customer_id" validate:"required,uuid"`
	DealID     string `json:"deal_id,omitempty" validate:"uuid"`
	Tone       string `json:"tone,omitempty" validate:"max=40"`
	Language   string `json:"language,omitempty" validate:"max=10"`
	Notes      string `json:"notes,omitempty" validate:"max=2000"`
}

type emailDraftResponse struct {
	Draft    string `json:"draft"`
	Subject  string `json:"subject"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Warning  string `json:"warning"`
}

// EmailDraft generates a follow-up email draft.
// @Summary      Generate an email draft
// @Description  Generates a professional follow-up email draft from customer and deal information. The output is a suggestion and requires human review before sending.
// @Tags         ai
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  emailDraftRequest  true  "Draft request"
// @Success      200  {object}  response.Success{data=emailDraftResponse}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      429  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Failure      503  {object}  response.Error
// @Router       /api/v1/ai/email-draft  [post]
func (h *Handler) EmailDraft(c *gin.Context) {
	var req emailDraftRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	if c.Request.ContentLength > maxRequestBytes {
		response.BadRequest(c, "request payload is too large")
		return
	}
	u := middleware.AuthUserFromContext(c)
	ctx := c.Request.Context()

	cust, err := loadCustomer(ctx, h.store, u.CompanyID, req.CustomerID)
	if err != nil {
		if errors.Is(err, errCustomerNotFound) {
			response.NotFound(c, "customer not found")
			return
		}
		response.InternalErrorf(c, err, "failed to load customer")
		return
	}
	deals := []dealContext{}
	if req.DealID != "" {
		d, err := loadDeal(ctx, h.store, u.CompanyID, req.DealID)
		if err != nil {
			if errors.Is(err, errDealNotFound) {
				response.NotFound(c, "deal not found")
				return
			}
			response.InternalErrorf(c, err, "failed to load deal")
			return
		}
		deals = append(deals, d)
	}
	acts, err := loadActivities(ctx, h.store, u.CompanyID, req.CustomerID, 10)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load activities")
		return
	}

	tone := req.Tone
	if tone == "" {
		tone = "professional and friendly"
	}
	lang := req.Language
	if lang == "" {
		lang = "English"
	}
	system := "You are a helpful sales assistant drafting emails for a small business CRM. " +
		"Return a JSON object with two fields: \"subject\" and \"draft\". " +
		"Never invent facts, prices, dates, or commitments that are not present in the provided context. " +
		"Do not include sensitive personal data in the subject. Keep the draft concise and professional."
	userPrompt := fmt.Sprintf(
		"Write a follow-up email in %s with a %s tone.\n\n%s\n\nAdditional notes from the user: %s\n\nReturn JSON with \"subject\" and \"draft\".",
		lang, tone, buildCustomerContextBlock(cust, deals, acts), truncate(req.Notes, 1000),
	)

	completion, err := h.complete(ctx, u, TypeEmailDraft, system, userPrompt)
	if err != nil {
		h.writeAIError(c, err)
		return
	}
	subject, draft := splitDraft(completion.Text)
	response.JSON(c, 200, emailDraftResponse{
		Draft:    draft,
		Subject:  subject,
		Model:    completion.Model,
		Provider: completion.Provider,
		Warning:  "AI-generated content is a suggestion. Review it before sending.",
	})
}

type customerSummaryRequest struct {
	CustomerID string `json:"customer_id" validate:"required,uuid"`
}

type customerSummaryResponse struct {
	Summary  string `json:"summary"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
	Warning  string `json:"warning"`
}

// CustomerSummary summarizes a customer and their activity history.
// @Summary      Summarize a customer
// @Description  Summarizes customer information and recent activity history. The output is a suggestion, not a verified record.
// @Tags         ai
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  customerSummaryRequest  true  "Summary request"
// @Success      200  {object}  response.Success{data=customerSummaryResponse}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      404  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      429  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Failure      503  {object}  response.Error
// @Router       /api/v1/ai/customer-summary  [post]
func (h *Handler) CustomerSummary(c *gin.Context) {
	var req customerSummaryRequest
	if errs := validation.BindAndValidate(c, &req); len(errs) > 0 {
		response.ValidationError(c, "validation failed", errs)
		return
	}
	if c.Request.ContentLength > maxRequestBytes {
		response.BadRequest(c, "request payload is too large")
		return
	}
	u := middleware.AuthUserFromContext(c)
	ctx := c.Request.Context()

	cust, err := loadCustomer(ctx, h.store, u.CompanyID, req.CustomerID)
	if err != nil {
		if errors.Is(err, errCustomerNotFound) {
			response.NotFound(c, "customer not found")
			return
		}
		response.InternalErrorf(c, err, "failed to load customer")
		return
	}
	deals, err := loadCustomerDeals(ctx, h.store, u.CompanyID, req.CustomerID)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load deals")
		return
	}
	acts, err := loadActivities(ctx, h.store, u.CompanyID, req.CustomerID, 25)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load activities")
		return
	}

	system := "You summarize CRM records for a sales team. Base every statement strictly on the " +
		"provided context. Do not invent facts, and do not state anything about a customer that the " +
		"context does not support. Respond in plain prose with at most 6 short bullet points."
	userPrompt := "Summarize this customer and their relationship history:\n\n" +
		buildCustomerContextBlock(cust, deals, acts)

	completion, err := h.complete(ctx, u, TypeCustomerSummary, system, userPrompt)
	if err != nil {
		h.writeAIError(c, err)
		return
	}
	response.JSON(c, 200, customerSummaryResponse{
		Summary:  completion.Text,
		Model:    completion.Model,
		Provider: completion.Provider,
		Warning:  "AI-generated content is a suggestion, not a verified fact.",
	})
}

func loadCustomerDeals(ctx context.Context, querier database.Querier, companyID, customerID string) ([]dealContext, error) {
	const q = `SELECT id, title, value::text, currency, status, expected_close
              FROM deals WHERE company_id = $1 AND customer_id = $2
              ORDER BY created_at DESC LIMIT 10`
	rows, err := querier.Query(ctx, q, companyID, customerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []dealContext{}
	for rows.Next() {
		var d dealContext
		if err := rows.Scan(&d.ID, &d.Title, &d.Value, &d.Currency, &d.Status, &d.ExpectedClose); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

type followUpRequest struct {
	Limit int `json:"limit,omitempty"`
}

type followUpSuggestion struct {
	CustomerID   string `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	Reason       string `json:"reason"`
	Priority     string `json:"priority"`
}

type followUpResponse struct {
	Suggestions []followUpSuggestion `json:"suggestions"`
	Model       string               `json:"model"`
	Provider    string               `json:"provider"`
	Warning     string               `json:"warning"`
}

// FollowUpSuggestions suggests customers that may need follow-up.
// @Summary      Suggest follow-ups
// @Description  Suggests customers and open deals that may need follow-up based on CRM data. Suggestions require human confirmation.
// @Tags         ai
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        body  body  followUpRequest  true  "Follow-up request"
// @Success      200  {object}  response.Success{data=followUpResponse}
// @Failure      400  {object}  response.Error
// @Failure      401  {object}  response.Error
// @Failure      422  {object}  response.Error
// @Failure      429  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Failure      503  {object}  response.Error
// @Router       /api/v1/ai/follow-up-suggestions  [post]
func (h *Handler) FollowUpSuggestions(c *gin.Context) {
	var req followUpRequest
	if err := c.ShouldBindJSON(&req); err != nil && err.Error() != "EOF" {
		response.BadRequest(c, "invalid JSON body")
		return
	}
	if req.Limit <= 0 {
		req.Limit = 10
	}
	if req.Limit > 25 {
		req.Limit = 25
	}
	u := middleware.AuthUserFromContext(c)
	ctx := c.Request.Context()

	candidates, err := loadFollowUpCandidates(ctx, h.store, u.CompanyID, req.Limit)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load follow-up candidates")
		return
	}
	if len(candidates) == 0 {
		response.JSON(c, 200, followUpResponse{
			Suggestions: []followUpSuggestion{},
			Warning:     "AI-generated content is a suggestion, not a verified fact.",
		})
		return
	}

	var b strings.Builder
	b.WriteString("Customers that may need follow-up (name, contact withheld, days since last activity, open deals):\n")
	for _, c := range candidates {
		days := "never contacted"
		if c.DaysSinceLast != nil {
			days = fmt.Sprintf("%d days ago", *c.DaysSinceLast)
		}
		b.WriteString(fmt.Sprintf("- %s | last activity: %s | open deals: %d\n",
			truncate(c.CustomerName, 120), days, c.OpenDeals))
	}

	system := "You analyse CRM activity data for a small business sales team. " +
		"Only reference customers present in the provided list. " +
		"Return a JSON array where each element has \"customer_name\", \"reason\", and \"priority\" " +
		"(one of low, medium, high). Sort by priority, most urgent first. Return an empty array if nobody needs follow-up."
	userPrompt := b.String() + "\n\nSuggest who should be followed up next."

	completion, err := h.complete(ctx, u, TypeFollowUpSuggestions, system, userPrompt)
	if err != nil {
		h.writeAIError(c, err)
		return
	}
	suggestions := parseSuggestions(completion.Text, candidates)
	response.JSON(c, 200, followUpResponse{
		Suggestions: suggestions,
		Model:       completion.Model,
		Provider:    completion.Provider,
		Warning:     "AI-generated content is a suggestion, not a verified fact. No CRM record was changed.",
	})
}

// parseSuggestions converts the model output into structured suggestions,
// falling back to the CRM-derived candidate list when the model output is not
// usable JSON.
func parseSuggestions(raw string, candidates []followUpCandidate) []followUpSuggestion {
	out := []followUpSuggestion{}
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var parsed []struct {
		CustomerName string `json:"customer_name"`
		Reason       string `json:"reason"`
		Priority     string `json:"priority"`
	}
	if err := json.Unmarshal([]byte(trimmed), &parsed); err == nil && len(parsed) > 0 {
		byName := map[string]followUpCandidate{}
		for _, c := range candidates {
			byName[strings.ToLower(strings.TrimSpace(c.CustomerName))] = c
		}
		for _, p := range parsed {
			priority := strings.ToLower(strings.TrimSpace(p.Priority))
			if priority != "low" && priority != "medium" && priority != "high" {
				priority = "medium"
			}
			s := followUpSuggestion{
				CustomerName: truncate(p.CustomerName, 200),
				Reason:       truncate(p.Reason, 500),
				Priority:     priority,
			}
			if c, ok := byName[strings.ToLower(strings.TrimSpace(p.CustomerName))]; ok {
				s.CustomerID = c.CustomerID
			}
			out = append(out, s)
		}
		return out
	}

	// Fallback: rank the CRM candidates by staleness without the model.
	for _, c := range candidates {
		reason := "No recent activity recorded."
		priority := "medium"
		if c.DaysSinceLast != nil {
			switch {
			case *c.DaysSinceLast >= 30:
				reason = fmt.Sprintf("No activity for %d days.", *c.DaysSinceLast)
				priority = "high"
			case *c.DaysSinceLast >= 14:
				reason = fmt.Sprintf("No activity for %d days.", *c.DaysSinceLast)
				priority = "medium"
			default:
				reason = fmt.Sprintf("Last activity %d days ago.", *c.DaysSinceLast)
				priority = "low"
			}
		} else {
			reason = "No activity has been recorded yet."
			priority = "high"
		}
		out = append(out, followUpSuggestion{
			CustomerID:   c.CustomerID,
			CustomerName: c.CustomerName,
			Reason:       reason,
			Priority:     priority,
		})
	}
	return out
}

// splitDraft extracts a subject and body from the model output, tolerating
// both a JSON object and a plain-text response.
func splitDraft(raw string) (string, string) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	trimmed = strings.TrimSpace(trimmed)

	var obj struct {
		Subject string `json:"subject"`
		Draft   string `json:"draft"`
	}
	if err := json.Unmarshal([]byte(trimmed), &obj); err == nil && (obj.Subject != "" || obj.Draft != "") {
		return obj.Subject, obj.Draft
	}
	return "", trimmed
}

// History returns the caller's AI interaction history.
// @Summary      Get AI interaction history
// @Description  Returns the AI interaction metadata recorded for the authenticated user's company.
// @Tags         ai
// @Produce      json
// @Security     BearerAuth
// @Param        limit   query  int  false  "Page size"
// @Param        offset  query  int  false  "Page offset"
// @Param        type    query  string false "Filter by interaction type"
// @Success      200  {object}  response.ListResponse{data=[]models.AIInteraction}
// @Failure      401  {object}  response.Error
// @Failure      500  {object}  response.Error
// @Router       /api/v1/ai/history  [get]
func (h *Handler) History(c *gin.Context) {
	u := middleware.AuthUserFromContext(c)
	limit := paginationClamp(c.Query("limit"), 20)
	offset := paginationOffset(c.Query("offset"))

	where := "company_id = $1"
	args := []any{u.CompanyID}
	if t := c.Query("type"); t != "" {
		args = append(args, t)
		where += fmt.Sprintf(" AND interaction_type = $%d", len(args))
	}

	var total int64
	if err := h.store.QueryRow(c.Request.Context(), "SELECT COUNT(*) FROM ai_interactions WHERE "+where, args...).Scan(&total); err != nil {
		response.InternalErrorf(c, err, "failed to load AI history")
		return
	}
	args = append(args, limit, offset)
	query := fmt.Sprintf(
		`SELECT id, company_id, user_id, interaction_type, COALESCE(prompt, ''), COALESCE(response, ''),
                COALESCE(model, ''), COALESCE(provider, ''), COALESCE(duration_ms, 0), created_at
         FROM ai_interactions WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, len(args)-1, len(args),
	)
	rows, err := h.store.Query(c.Request.Context(), query, args...)
	if err != nil {
		response.InternalErrorf(c, err, "failed to load AI history")
		return
	}
	defer rows.Close()
	out := []models.AIInteraction{}
	for rows.Next() {
		var it models.AIInteraction
		if err := rows.Scan(&it.ID, &it.CompanyID, &it.UserID, &it.InteractionType, &it.Prompt,
			&it.Response, &it.Model, &it.Provider, &it.DurationMs, &it.CreatedAt); err != nil {
			response.InternalErrorf(c, err, "failed to load AI history")
			return
		}
		out = append(out, it)
	}
	response.List(c, out, total, limit, offset)
}

// complete runs the provider call and records the interaction metadata.
func (h *Handler) complete(ctx context.Context, u *middleware.AuthUser, interactionType, system, userPrompt string) (*Completion, error) {
	completion, err := h.service.Complete(ctx, CompletionRequest{
		SystemPrompt: system,
		Messages:     []Message{{Role: "user", Content: userPrompt}},
		MaxTokens:    1024,
		Temperature:  0.4,
	})
	if err != nil {
		// Failed calls are not stored: only successful interactions are recorded.
		return nil, err
	}
	// Persist only the metadata and a truncated copy of the exchange. The full
	// prompt may contain customer data that should not be duplicated in storage.
	_, _ = h.store.Exec(ctx,
		`INSERT INTO ai_interactions (company_id, user_id, interaction_type, prompt, response, model, provider, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		u.CompanyID, u.UserID, interactionType,
		truncate(userPrompt, 2000),
		truncate(completion.Text, 4000),
		completion.Model, completion.Provider,
		int(completion.Duration.Milliseconds()),
	)
	return completion, nil
}

// writeAIError maps provider errors onto HTTP status codes.
func (h *Handler) writeAIError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotConfigured):
		response.ErrorResponse(c, 503, "AI_NOT_CONFIGURED",
			"AI features are not configured on this server. All other API endpoints remain available.")
	case errors.Is(err, ErrTimeout):
		response.ErrorResponse(c, 504, "AI_TIMEOUT", "The AI provider did not respond in time")
	case errors.Is(err, ErrRateLimited):
		response.TooManyRequests(c, "The AI provider rate limit was reached. Please retry later.")
	case errors.Is(err, ErrEmptyResponse):
		response.ErrorResponse(c, 502, "AI_EMPTY_RESPONSE", "The AI provider returned an empty response")
	case errors.Is(err, ErrProvider):
		response.ErrorResponse(c, 502, "AI_PROVIDER_ERROR", "The AI provider returned an error")
	default:
		response.InternalErrorf(c, err, "failed to generate AI content")
	}
}

// RegisterRoutes wires AI routes onto an authenticated router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/email-draft", h.EmailDraft)
	rg.POST("/customer-summary", h.CustomerSummary)
	rg.POST("/follow-up-suggestions", h.FollowUpSuggestions)
	rg.GET("/history", h.History)
}
