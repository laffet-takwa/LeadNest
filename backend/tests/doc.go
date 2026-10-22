// Package tests holds the end-to-end integration test suite.
//
// The integration tests live behind the `integration` build tag so that a
// plain `go test ./...` never touches a database. To run them, point
// TEST_DATABASE_URL at a dedicated throwaway PostgreSQL database:
//
//	export TEST_DATABASE_URL=postgres://leadnest:leadnest@localhost:5433/leadnest_test?sslmode=disable
//	go test -tags=integration ./tests/...
//
// This file carries no build tag on purpose: it keeps the package buildable
// when the integration tag is absent.
package tests
