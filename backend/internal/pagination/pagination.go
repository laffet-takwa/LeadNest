// Package pagination provides shared helpers for parsing list query parameters.
package pagination

import (
	"strconv"
	"strings"
)

const (
	// MaxLimit is the largest page size a client may request.
	MaxLimit = 100
	// DefaultLimit is used when the client does not specify a page size.
	DefaultLimit = 20
)

// Params describes a validated pagination window.
type Params struct {
	Limit  int
	Offset int
}

// Parse reads limit/offset query values and clamps them to safe bounds.
// A missing or malformed limit falls back to def; a missing or malformed
// offset falls back to zero.
func Parse(limitRaw, offsetRaw string, def int) Params {
	if def <= 0 || def > MaxLimit {
		def = DefaultLimit
	}
	limit := def
	if s := strings.TrimSpace(limitRaw); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			limit = n
		}
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}
	offset := 0
	if s := strings.TrimSpace(offsetRaw); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			offset = n
		}
	}
	return Params{Limit: limit, Offset: offset}
}

// Clamp clamps a raw limit value into [1, MaxLimit].
func Clamp(raw string, def int) int {
	if def <= 0 || def > MaxLimit {
		def = DefaultLimit
	}
	if s := strings.TrimSpace(raw); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			if n > MaxLimit {
				return MaxLimit
			}
			return n
		}
	}
	return def
}
