package validation

import (
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// FieldError describes a single validation failure on a request field.
type FieldError struct {
	Field  string `json:"field"`
	Reason string `json:"reason"`
}

// FieldErrors is a collection used in 422 responses.
type FieldErrors []FieldError

func (f FieldErrors) Error() string {
	b := strings.Builder{}
	for i, fe := range f {
		if i > 0 {
			b.WriteString("; ")
		}
		b.WriteString(fe.Field)
		b.WriteString(": ")
		b.WriteString(fe.Reason)
	}
	return b.String()
}

var (
	emailRe    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRe    = regexp.MustCompile(`^\+?[0-9]{7,15}$`)
	currencyRe = regexp.MustCompile(`^[A-Z]{3}$`)
	uuidRe     = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// Email returns true if s is a plausible email address.
func Email(s string) bool {
	return emailRe.MatchString(s)
}

// Phone returns true if s is a plausible phone number.
func Phone(s string) bool {
	return phoneRe.MatchString(s)
}

// Currency returns true if s is a 3-letter ISO 4217 code.
func Currency(s string) bool {
	return currencyRe.MatchString(s)
}

// UUID returns true if s is a valid UUID.
func UUID(s string) bool {
	return uuidRe.MatchString(s)
}

// IsPrintableASCII returns true if every rune is printable ASCII.
func IsPrintableASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || !unicode.IsPrint(r) {
			return false
		}
	}
	return true
}

// Validatable is implemented by request types that need custom checks.
type Validatable interface {
	Validate() FieldErrors
}

// BindAndValidate binds the JSON body and runs tag-based validation.
// It returns FieldErrors when validation fails; the caller should respond 422.
func BindAndValidate(c interface{}, req interface{}) FieldErrors {
	type binder interface {
		ShouldBindJSON(interface{}) error
	}
	if b, ok := c.(binder); ok {
		if err := b.ShouldBindJSON(req); err != nil {
			return FieldErrors{{Field: "body", Reason: "invalid JSON: " + err.Error()}}
		}
	}
	return ValidateStruct(req)
}

// ValidateStruct inspects the `validate` struct tag on each exported field.
// Supported rules: required, email, phone, currency, uuid, min=N, max=N.
//
// Nested structs (and pointers to structs) are validated recursively, and the
// field name of a nested failure is prefixed with the parent field name, for
// example "admin.email".
func ValidateStruct(req interface{}) FieldErrors {
	v := reflect.ValueOf(req)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return nil
	}
	return validateValue(v, "")
}

func validateValue(v reflect.Value, prefix string) FieldErrors {
	t := v.Type()
	var errs FieldErrors
	for i := 0; i < v.NumField(); i++ {
		f := v.Field(i)
		ft := t.Field(i)
		if !f.CanInterface() {
			continue
		}
		name := fieldName(ft)
		if prefix != "" {
			name = prefix + "." + name
		}

		// Recurse into nested structs before applying the parent's own rules.
		if f.Kind() == reflect.Struct && f.Type() != reflect.TypeOf(time.Time{}) {
			errs = append(errs, validateValue(f, name)...)
			continue
		}
		if f.Kind() == reflect.Ptr && f.Elem().Kind() == reflect.Struct &&
			f.Elem().Type() != reflect.TypeOf(time.Time{}) {
			if !f.IsNil() {
				errs = append(errs, validateValue(f.Elem(), name)...)
			}
			continue
		}

		tag := ft.Tag.Get("validate")
		if tag == "" {
			continue
		}
		for _, rule := range strings.Split(tag, ",") {
			rule = strings.TrimSpace(rule)
			if rule == "" {
				continue
			}
			switch {
			case rule == "required":
				if isEmpty(f) {
					errs = append(errs, FieldError{Field: name, Reason: "is required"})
				}
			case rule == "email":
				if s, ok := f.Interface().(string); ok && s != "" && !Email(s) {
					errs = append(errs, FieldError{Field: name, Reason: "must be a valid email"})
				}
			case rule == "phone":
				if s, ok := f.Interface().(string); ok && s != "" && !Phone(s) {
					errs = append(errs, FieldError{Field: name, Reason: "must be a valid phone number"})
				}
			case rule == "currency":
				if s, ok := f.Interface().(string); ok && s != "" && !Currency(s) {
					errs = append(errs, FieldError{Field: name, Reason: "must be a 3-letter ISO currency code"})
				}
			case rule == "uuid":
				if s, ok := f.Interface().(string); ok && s != "" && !UUID(s) {
					errs = append(errs, FieldError{Field: name, Reason: "must be a valid UUID"})
				}
			case strings.HasPrefix(rule, "min="):
				n, _ := strconv.Atoi(strings.TrimPrefix(rule, "min="))
				if s, ok := f.Interface().(string); ok && s != "" && len(s) < n {
					errs = append(errs, FieldError{Field: name, Reason: "must be at least " + strconv.Itoa(n) + " characters"})
				}
			case strings.HasPrefix(rule, "max="):
				n, _ := strconv.Atoi(strings.TrimPrefix(rule, "max="))
				if s, ok := f.Interface().(string); ok && s != "" && len(s) > n {
					errs = append(errs, FieldError{Field: name, Reason: "must be at most " + strconv.Itoa(n) + " characters"})
				}
			}
		}
	}
	return errs
}

// fieldName returns the JSON name of a struct field, falling back to the Go
// field name.
func fieldName(ft reflect.StructField) string {
	if jsonTag := ft.Tag.Get("json"); jsonTag != "" {
		if j, _, _ := strings.Cut(jsonTag, ","); j != "" && j != "-" {
			return j
		}
	}
	return ft.Name
}

func isEmpty(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.String:
		return v.String() == ""
	case reflect.Ptr, reflect.Interface:
		return v.IsNil()
	case reflect.Slice, reflect.Map:
		return v.IsNil() || v.Len() == 0
	}
	return false
}
