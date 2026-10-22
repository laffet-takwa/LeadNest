package ai

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"github.com/leadnest/backend/internal/pagination"
)

var (
	errCustomerNotFound = errors.New("customer not found")
	errDealNotFound     = errors.New("deal not found")
)

func paginationClamp(raw string, def int) int {
	return pagination.Clamp(raw, def)
}

func paginationOffset(raw string) int {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 0 {
		return 0
	}
	return n
}

var _ = sql.ErrNoRows
