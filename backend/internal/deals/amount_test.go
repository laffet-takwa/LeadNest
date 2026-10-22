package deals

import (
	"testing"
)

func TestValidateAmountAcceptsValidValues(t *testing.T) {
	cases := map[string]string{
		"100":              "100",
		"100.5":            "100.5",
		"1500.50":          "1500.50",
		"0.01":             "0.01",
		"0":                "0",
		"9999999999999.99": "9999999999999.99",
	}
	for in, want := range cases {
		got, errs := validateAmount(in)
		if len(errs) > 0 {
			t.Errorf("validateAmount(%q) returned errors: %v", in, errs)
			continue
		}
		if got != want {
			t.Errorf("validateAmount(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestValidateAmountRejectsInvalidValues(t *testing.T) {
	invalid := []string{"", "  ", "abc", "-1", "-0.01", "1.234", "1,000", "1e5", "0x10"}
	for _, in := range invalid {
		if _, errs := validateAmount(in); len(errs) == 0 {
			t.Errorf("expected %q to be rejected", in)
		}
	}
}

func TestValidateAmountIsDecimalSafe(t *testing.T) {
	// A value that would lose precision in binary floating point.
	got, errs := validateAmount("0.1")
	if len(errs) > 0 {
		t.Fatalf("unexpected errors: %v", errs)
	}
	if got != "0.1" {
		t.Fatalf("expected 0.1, got %q", got)
	}

	// Adding 0.1 and 0.2 in float64 yields 0.30000000000000004; the decimal
	// path must stay exact.
	got, errs = validateAmount("0.30")
	if len(errs) > 0 {
		t.Fatalf("unexpected errors: %v", errs)
	}
	if got != "0.30" {
		t.Fatalf("expected 0.30, got %q", got)
	}
}

func TestValidateAmountRejectsTooLargeValues(t *testing.T) {
	if _, errs := validateAmount("99999999999999.00"); len(errs) == 0 {
		t.Fatal("expected a value beyond NUMERIC(15,2) to be rejected")
	}
}

func TestIsValidStatus(t *testing.T) {
	for _, s := range []string{"new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"} {
		if !IsValidStatus(s) {
			t.Errorf("expected %q to be a valid status", s)
		}
	}
	for _, s := range []string{"", "archived", "WON", "pending"} {
		if IsValidStatus(s) {
			t.Errorf("expected %q to be an invalid status", s)
		}
	}
}

func TestIsClosed(t *testing.T) {
	if !IsClosed("won") || !IsClosed("lost") {
		t.Fatal("expected won and lost to be terminal states")
	}
	for _, s := range []string{"new", "contacted", "qualified", "proposal", "negotiation"} {
		if IsClosed(s) {
			t.Errorf("expected %q not to be terminal", s)
		}
	}
}
