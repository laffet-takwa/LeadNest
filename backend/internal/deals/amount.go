package deals

import (
	"strings"

	"github.com/leadnest/backend/internal/validation"
	"github.com/shopspring/decimal"
)

// maxIntegerDigits is the number of integer digits NUMERIC(15,2) allows.
const maxIntegerDigits = 13

// validateAmount checks that a monetary amount is a non-negative decimal with
// at most two fractional digits, and returns its canonical string form.
//
// The value is parsed with shopspring/decimal so no binary floating-point
// rounding can occur. PostgreSQL NUMERIC(15,2) is the final authority; this
// check rejects obviously invalid input before it reaches the database.
func validateAmount(raw string) (string, validation.FieldErrors) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", validation.FieldErrors{{Field: "value", Reason: "is required"}}
	}
	// Scientific notation and other exotic forms are rejected so the value
	// is always a plain decimal literal.
	if strings.ContainsAny(s, "eE") {
		return "", validation.FieldErrors{{Field: "value", Reason: "must be a plain decimal number"}}
	}
	d, err := decimal.NewFromString(s)
	if err != nil {
		return "", validation.FieldErrors{{Field: "value", Reason: "must be a valid decimal number"}}
	}
	if d.IsNegative() {
		return "", validation.FieldErrors{{Field: "value", Reason: "must not be negative"}}
	}
	// More than two fractional digits cannot be stored in NUMERIC(15,2).
	if d.Exponent() < -2 {
		return "", validation.FieldErrors{{Field: "value", Reason: "must have at most 2 decimal places"}}
	}
	// NUMERIC(15,2) allows 13 integer digits.
	integerDigits := d.Abs().Truncate(0).String()
	integerDigits = strings.TrimLeft(integerDigits, "0")
	if integerDigits == "" {
		integerDigits = "0"
	}
	if len(integerDigits) > maxIntegerDigits {
		return "", validation.FieldErrors{
			{Field: "value", Reason: "must not exceed 9999999999999.99"},
		}
	}
	// Render with the same number of decimal places the caller supplied, so
	// "1500.50" stays "1500.50" and "100" stays "100".
	places := int32(0)
	if d.Exponent() < 0 {
		places = -d.Exponent()
	}
	return d.StringFixedBank(places), nil
}
