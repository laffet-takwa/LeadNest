// Package ai provides a provider-independent LLM service layer for LeadNest.
//
// The service is intentionally narrow: it builds prompts from CRM data the
// caller is already allowed to see, calls an external LLM API, and records the
// interaction metadata. It never mutates CRM records, so AI output can never
// change deal status or delete anything without explicit user action.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/leadnest/backend/internal/config"
)

// Errors returned by the provider layer. Callers map these onto HTTP codes.
var (
	// ErrNotConfigured means no AI provider is configured. The API stays usable.
	ErrNotConfigured = errors.New("ai provider is not configured")
	// ErrTimeout means the provider did not answer in time.
	ErrTimeout = errors.New("ai provider timed out")
	// ErrRateLimited means the provider rejected the request for rate reasons.
	ErrRateLimited = errors.New("ai provider rate limit exceeded")
	// ErrProvider means the provider returned an error response.
	ErrProvider = errors.New("ai provider returned an error")
	// ErrEmptyResponse means the provider replied without usable content.
	ErrEmptyResponse = errors.New("ai provider returned an empty response")
)

// Message is a single chat message.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// CompletionRequest is the provider-independent request payload.
type CompletionRequest struct {
	Messages     []Message
	MaxTokens    int
	Temperature  float64
	SystemPrompt string
}

// Completion is the provider-independent response payload.
type Completion struct {
	Text       string
	Model      string
	Provider   string
	Duration   time.Duration
	TokensUsed int
}

// Provider is the interface every LLM backend must implement.
type Provider interface {
	// Name identifies the provider in stored interaction metadata.
	Name() string
	// Model returns the model identifier in use.
	Model() string
	// Complete performs a chat completion.
	Complete(ctx context.Context, req CompletionRequest) (*Completion, error)
}

// Service coordinates prompt building, provider calls and persistence.
type Service struct {
	provider Provider
	enabled  bool
}

// NewService builds an AI service from configuration. When no provider is
// configured the service is still returned but reports ErrNotConfigured.
func NewService(cfg config.AIConfig) *Service {
	if strings.TrimSpace(cfg.APIKey) == "" {
		return &Service{enabled: false}
	}
	return &Service{
		enabled:  true,
		provider: NewOpenAICompatibleProvider(cfg),
	}
}

// Enabled reports whether an AI provider is configured.
func (s *Service) Enabled() bool {
	return s.enabled && s.provider != nil
}

// ProviderName returns the configured provider name, or "" when unconfigured.
func (s *Service) ProviderName() string {
	if s.provider == nil {
		return ""
	}
	return s.provider.Name()
}

// ModelName returns the configured model identifier, or "" when unconfigured.
func (s *Service) ModelName() string {
	if s.provider == nil {
		return ""
	}
	return s.provider.Model()
}

// Complete runs a completion through the configured provider.
func (s *Service) Complete(ctx context.Context, req CompletionRequest) (*Completion, error) {
	if !s.Enabled() {
		return nil, ErrNotConfigured
	}
	return s.provider.Complete(ctx, req)
}

// --- OpenAI-compatible provider ---

// OpenAICompatibleProvider talks to any OpenAI-compatible chat-completions
// endpoint, which covers OpenAI, Azure OpenAI, and most self-hosted gateways.
type OpenAICompatibleProvider struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

type chatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
	Model string `json:"model"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error"`
}

// NewOpenAICompatibleProvider creates a provider from configuration.
func NewOpenAICompatibleProvider(cfg config.AIConfig) *OpenAICompatibleProvider {
	base := strings.TrimRight(cfg.BaseURL, "/")
	if base == "" {
		base = "https://api.openai.com/v1"
	}
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &OpenAICompatibleProvider{
		apiKey:  cfg.APIKey,
		baseURL: base,
		model:   cfg.Model,
		client:  &http.Client{Timeout: timeout},
	}
}

// Name returns the provider name.
func (p *OpenAICompatibleProvider) Name() string { return "openai-compatible" }

// Model returns the model identifier.
func (p *OpenAICompatibleProvider) Model() string { return p.model }

// Complete performs the chat completion call.
func (p *OpenAICompatibleProvider) Complete(ctx context.Context, req CompletionRequest) (*Completion, error) {
	messages := make([]Message, 0, len(req.Messages)+1)
	if req.SystemPrompt != "" {
		messages = append(messages, Message{Role: "system", Content: req.SystemPrompt})
	}
	messages = append(messages, req.Messages...)

	payload := chatRequest{
		Model:       p.model,
		Messages:    messages,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	start := time.Now()
	resp, err := p.client.Do(httpReq)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || isTimeout(err) {
			return nil, ErrTimeout
		}
		if errors.Is(err, context.Canceled) {
			return nil, err
		}
		return nil, fmt.Errorf("%w: %v", ErrProvider, err)
	}
	defer resp.Body.Close()

	// Bound the response size so a misbehaving provider cannot exhaust memory.
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || isTimeout(err) {
			return nil, ErrTimeout
		}
		return nil, fmt.Errorf("read response: %w", err)
	}

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		return nil, ErrRateLimited
	case resp.StatusCode >= 400:
		var cr chatResponse
		if json.Unmarshal(raw, &cr) == nil && cr.Error != nil && cr.Error.Message != "" {
			return nil, fmt.Errorf("%w: %s", ErrProvider, cr.Error.Message)
		}
		return nil, fmt.Errorf("%w: unexpected status %d", ErrProvider, resp.StatusCode)
	}

	var cr chatResponse
	if err := json.Unmarshal(raw, &cr); err != nil {
		return nil, fmt.Errorf("%w: malformed response", ErrProvider)
	}
	if len(cr.Choices) == 0 {
		return nil, ErrEmptyResponse
	}
	text := strings.TrimSpace(cr.Choices[0].Message.Content)
	if text == "" {
		return nil, ErrEmptyResponse
	}
	model := cr.Model
	if model == "" {
		model = p.model
	}
	return &Completion{
		Text:       text,
		Model:      model,
		Provider:   p.Name(),
		Duration:   time.Since(start),
		TokensUsed: cr.Usage.TotalTokens,
	}, nil
}

func isTimeout(err error) bool {
	var t interface{ Timeout() bool }
	if errors.As(err, &t) {
		return t.Timeout()
	}
	return false
}
