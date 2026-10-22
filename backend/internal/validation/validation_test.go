package validation

import "testing"

func TestEmail(t *testing.T) {
	valid := []string{"a@b.co", "first.last+tag@example.tn", "x_y@sub.domain.org"}
	invalid := []string{"", "no-at-sign", "@example.com", "user@", "user@example", "a b@example.com"}
	for _, v := range valid {
		if !Email(v) {
			t.Errorf("expected %q to be a valid email", v)
		}
	}
	for _, v := range invalid {
		if Email(v) {
			t.Errorf("expected %q to be an invalid email", v)
		}
	}
}

func TestPhone(t *testing.T) {
	valid := []string{"+21612345678", "1234567", "21612345678"}
	invalid := []string{"", "12345", "abc", "+216-123-456"}
	for _, v := range valid {
		if !Phone(v) {
			t.Errorf("expected %q to be a valid phone", v)
		}
	}
	for _, v := range invalid {
		if Phone(v) {
			t.Errorf("expected %q to be an invalid phone", v)
		}
	}
}

func TestCurrency(t *testing.T) {
	for _, v := range []string{"TND", "USD", "EUR"} {
		if !Currency(v) {
			t.Errorf("expected %q to be a valid currency code", v)
		}
	}
	for _, v := range []string{"", "TN", "TNDD", "tnd", "12A"} {
		if Currency(v) {
			t.Errorf("expected %q to be an invalid currency code", v)
		}
	}
}

func TestUUID(t *testing.T) {
	if !UUID("123e4567-e89b-12d3-a456-426614174000") {
		t.Error("expected a valid UUID to be accepted")
	}
	for _, v := range []string{"", "not-a-uuid", "123e4567e89b12d3a456426614174000"} {
		if UUID(v) {
			t.Errorf("expected %q to be an invalid UUID", v)
		}
	}
}

type sample struct {
	Name  string `json:"name" validate:"required,min=3"`
	Email string `json:"email" validate:"email"`
	Age   int    `json:"age"`
}

func TestValidateStructRequired(t *testing.T) {
	errs := ValidateStruct(&sample{})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(errs), errs)
	}
	if errs[0].Field != "name" {
		t.Fatalf("expected field 'name', got %q", errs[0].Field)
	}
}

func TestValidateStructEmail(t *testing.T) {
	errs := ValidateStruct(&sample{Name: "alice", Email: "bad-email"})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(errs), errs)
	}
	if errs[0].Field != "email" {
		t.Fatalf("expected field 'email', got %q", errs[0].Field)
	}
}

func TestValidateStructMinLength(t *testing.T) {
	errs := ValidateStruct(&sample{Name: "ab", Email: "a@b.co"})
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(errs), errs)
	}
	if errs[0].Field != "name" {
		t.Fatalf("expected field 'name', got %q", errs[0].Field)
	}
}

func TestValidateStructValid(t *testing.T) {
	errs := ValidateStruct(&sample{Name: "alice", Email: "a@b.co", Age: 30})
	if len(errs) != 0 {
		t.Fatalf("expected no errors, got %v", errs)
	}
}

func TestFieldErrorsMessage(t *testing.T) {
	errs := FieldErrors{{Field: "name", Reason: "is required"}}
	if errs.Error() != "name: is required" {
		t.Fatalf("unexpected message %q", errs.Error())
	}
}
