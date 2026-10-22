# LeadNest backend — developer commands.
#
# Run `make help` for a list of available targets.

APP          ?= api
BIN_DIR      ?= bin
PKG          ?= ./...
VERSION      ?= dev
MIGRATIONS   ?= migrations
GOFILES      := $(shell find . -type f -name '*.go' -not -path './vendor/*')

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: run
run: build ## Build and run the API server locally
	$(BIN_DIR)/api

.PHONY: build
build: ## Build the API server and migration runner into ./bin
	@mkdir -p $(BIN_DIR)
	go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o $(BIN_DIR)/api ./cmd/api
	go build -trimpath -ldflags "-s -w" -o $(BIN_DIR)/migrate ./cmd/migrate

.PHONY: fmt
fmt: ## Format all Go source files
	gofmt -s -w $(GOFILES)

.PHONY: fmt-check
fmt-check: ## Verify formatting without changing files
	@out="$$(gofmt -s -l $(GOFILES))"; \
	if [ -n "$$out" ]; then echo "These files need formatting:"; echo "$$out"; exit 1; fi

.PHONY: vet
vet: ## Run go vet
	go vet $(PKG)

.PHONY: tidy
tidy: ## Tidy module dependencies
	go mod tidy

.PHONY: test
test: ## Run unit tests (no database required)
	@if [ -x scripts/run_tests.sh ] || command -v sh >/dev/null 2>&1; then \
		sh scripts/run_tests.sh; \
	else \
		go test -count=1 $(PKG); \
	fi

.PHONY: test-integration
test-integration: ## Run integration tests against TEST_DATABASE_URL
	@if [ -z "$$TEST_DATABASE_URL" ]; then \
		echo "TEST_DATABASE_URL is not set. Point it at a dedicated test database."; \
		echo "Example: TEST_DATABASE_URL=postgres://leadnest:leadnest@localhost:5433/leadnest_test?sslmode=disable"; \
		exit 1; \
	fi
	go test -count=1 -tags=integration -v ./tests/...

.PHONY: test-all
test-all: test test-integration ## Run all tests

.PHONY: cover
cover: ## Run tests and report coverage
	go test -count=1 -coverprofile=coverage.out $(PKG)
	go tool cover -func=coverage.out | tail -1

.PHONY: migrate-up
migrate-up: build ## Apply all pending migrations
	$(BIN_DIR)/migrate -dir $(MIGRATIONS) -action up

.PHONY: migrate-down
migrate-down: build ## Roll back the most recently applied migration
	$(BIN_DIR)/migrate -dir $(MIGRATIONS) -action down

.PHONY: migrate-status
migrate-status: build ## Show migration status
	$(BIN_DIR)/migrate -dir $(MIGRATIONS) -action status

.PHONY: swagger
swagger: ## Regenerate Swagger documentation
	@if command -v swag >/dev/null 2>&1; then \
		swag init -g internal/server/swagger.go -d . --parseInternal; \
	else \
		echo "swag is not installed. Install it with: go install github.com/swaggo/swag/cmd/swag@latest"; \
		echo "then run: make swagger"; \
	fi

.PHONY: docker-build
docker-build: ## Build the Docker image
	docker build -t leadnest-backend:$(VERSION) .

.PHONY: docker-up
docker-up: ## Start the local development stack
	docker compose up --build -d

.PHONY: docker-down
docker-down: ## Stop the local development stack
	docker compose down

.PHONY: docker-logs
docker-logs: ## Tail the API container logs
	docker compose logs -f api

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf $(BIN_DIR) coverage.out
