package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/leadnest/backend/internal/config"
)

func testConfig(baseURL, key string) config.AIConfig {
	return config.AIConfig{
		Provider:  "openai-compatible",
		APIKey:    key,
		BaseURL:   baseURL,
		Model:     "test-model",
		Timeout:   2 * time.Second,
		MaxTokens: 256,
	}
}

func TestProviderSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret-key" {
			t.Errorf("expected bearer token in Authorization header, got %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"model": "test-model",
			"choices": []map[string]any{
				{"message": map[string]string{"role": "assistant", "content": "Hello there"}},
			},
			"usage": map[string]int{"total_tokens": 12},
		})
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider(testConfig(srv.URL, "secret-key"))
	completion, err := p.Complete(context.Background(), CompletionRequest{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatalf("Complete: %v", err)
	}
	if completion.Text != "Hello there" {
		t.Fatalf("unexpected text %q", completion.Text)
	}
	if completion.TokensUsed != 12 {
		t.Fatalf("unexpected token count %d", completion.TokensUsed)
	}
	if completion.Provider != "openai-compatible" {
		t.Fatalf("unexpected provider %q", completion.Provider)
	}
}

func TestProviderTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	}))
	defer srv.Close()

	cfg := testConfig(srv.URL, "secret-key")
	cfg.Timeout = 50 * time.Millisecond
	p := NewOpenAICompatibleProvider(cfg)

	_, err := p.Complete(context.Background(), CompletionRequest{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err == nil {
		t.Fatal("expected a timeout error")
	}
	if err != ErrTimeout {
		t.Fatalf("expected ErrTimeout, got %v", err)
	}
}

func TestProviderRateLimit(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider(testConfig(srv.URL, "secret-key"))
	_, err := p.Complete(context.Background(), CompletionRequest{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != ErrRateLimited {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
}

func TestProviderServerError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":{"message":"boom"}}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider(testConfig(srv.URL, "secret-key"))
	_, err := p.Complete(context.Background(), CompletionRequest{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err == nil {
		t.Fatal("expected a provider error")
	}
	if !isProviderError(err) {
		t.Fatalf("expected ErrProvider, got %v", err)
	}
}

func TestProviderEmptyResponse(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[]}`))
	}))
	defer srv.Close()

	p := NewOpenAICompatibleProvider(testConfig(srv.URL, "secret-key"))
	_, err := p.Complete(context.Background(), CompletionRequest{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != ErrEmptyResponse {
		t.Fatalf("expected ErrEmptyResponse, got %v", err)
	}
}

func isProviderError(err error) bool {
	return err != nil && (err == ErrProvider || containsStr(err.Error(), "ai provider returned an error"))
}

func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func TestServiceNotConfigured(t *testing.T) {
	svc := NewService(config.AIConfig{})
	if svc.Enabled() {
		t.Fatal("expected the service to be disabled without an API key")
	}
	_, err := svc.Complete(context.Background(), CompletionRequest{})
	if err != ErrNotConfigured {
		t.Fatalf("expected ErrNotConfigured, got %v", err)
	}
}

func TestServiceConfigured(t *testing.T) {
	svc := NewService(config.AIConfig{APIKey: "k", Model: "m"})
	if !svc.Enabled() {
		t.Fatal("expected the service to be enabled with an API key")
	}
	if svc.ModelName() != "m" {
		t.Fatalf("unexpected model %q", svc.ModelName())
	}
}

func TestSplitDraftParsesJSON(t *testing.T) {
	subject, draft := splitDraft(`{"subject":"Hi there","draft":"Hello, following up."}`)
	if subject != "Hi there" {
		t.Fatalf("unexpected subject %q", subject)
	}
	if draft != "Hello, following up." {
		t.Fatalf("unexpected draft %q", draft)
	}
}

func TestSplitDraftFallsBackToPlainText(t *testing.T) {
	subject, draft := splitDraft("Just a plain email body")
	if subject != "" {
		t.Fatalf("expected empty subject, got %q", subject)
	}
	if draft != "Just a plain email body" {
		t.Fatalf("unexpected draft %q", draft)
	}
}

func TestParseSuggestionsFromJSON(t *testing.T) {
	candidates := []followUpCandidate{
		{CustomerID: "c1", CustomerName: "Alice Corp"},
		{CustomerID: "c2", CustomerName: "Bob Ltd"},
	}
	raw := `[{"customer_name":"Bob Ltd","reason":"no activity for 40 days","priority":"high"}]`
	out := parseSuggestions(raw, candidates)
	if len(out) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(out))
	}
	if out[0].CustomerID != "c2" {
		t.Fatalf("expected customer id c2, got %q", out[0].CustomerID)
	}
	if out[0].Priority != "high" {
		t.Fatalf("expected high priority, got %q", out[0].Priority)
	}
}

func TestParseSuggestionsFallsBackToCRMData(t *testing.T) {
	days := 40
	candidates := []followUpCandidate{
		{CustomerID: "c1", CustomerName: "Alice Corp", DaysSinceLast: &days},
	}
	out := parseSuggestions("not json at all", candidates)
	if len(out) != 1 {
		t.Fatalf("expected 1 suggestion, got %d", len(out))
	}
	if out[0].CustomerID != "c1" {
		t.Fatalf("expected customer id c1, got %q", out[0].CustomerID)
	}
	if out[0].Priority != "high" {
		t.Fatalf("expected high priority for 40 days of silence, got %q", out[0].Priority)
	}
}
