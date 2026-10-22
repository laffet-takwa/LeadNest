# LeadNest — Backend

LeadNest is an AI-powered CRM for small businesses. This directory contains
the **backend** (Go, Gin, PostgreSQL) of the platform. The React web client
lives next to it in `../frontend`.

The API manages companies, employees, customers, sales deals, follow-up tasks,
activity timelines, dashboard analytics, and AI-assisted drafting. Every query
is scoped to the caller's company.

| Directory     | Contents                                        |
| ------------- | ----------------------------------------------- |
| `cmd/`        | API server, migration runner, storage probe     |
| `internal/`   | Go packages: handlers, repositories, middleware  |
| `migrations/` | Versioned SQL migrations                        |
| `docs/`       | Generated Swagger documentation                 |
| `scripts/`    | Test and smoke-test helpers                     |
| `tests/`      | Go integration test suite                       |

> Every command below that uses `make` is run from **this** directory. The
> `docker compose` commands are run from the repository root, one level up.

---

## Table of contents

- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Database and migrations](#database-and-migrations)
- [API overview](#api-overview)
- [Response format](#response-format)
- [Authentication and authorization](#authentication-and-authorization)
- [AI features](#ai-features)
- [Testing](#testing)
- [Makefile commands](#makefile-commands)
- [Project layout](#project-layout)
- [Operational notes](#operational-notes)

---

## Architecture

A modular monolith: one binary, one database, clear internal package boundaries.
Each module under `internal/` owns its HTTP handlers and its SQL access, and
shared concerns live in focused packages (`config`, `database`, `middleware`,
`response`, `validation`, `pagination`, `models`).

```
HTTP request
   │
   ├─ middleware.Recover            panic → 500
   ├─ middleware.RequestLogger      structured log via log/slog
   ├─ middleware.CORS               allowed origins
   ├─ middleware.RateLimit          per-client token bucket → 429
   │
   └─ /api/v1 route group
        ├─ public:  /auth/register, /auth/login, /auth/refresh
        └─ authenticated group
             ├─ middleware.RequireAuth  JWT + active-user check
             ├─ middleware.TenantIsolation
             └─ module handlers → repository → PostgreSQL
```

**Tenant isolation.** The `company_id` used for every query is read from the
authenticated user's verified database row, never from a request body, query
parameter, or header. The JWT middleware loads the user row on every request,
confirms the account is still active, and stores the verified identity on the
request context. Repositories then filter on that `company_id`, so a caller can
never reach another tenant's rows — a cross-tenant read returns `404`, not
`403`, so the API does not confirm the existence of foreign resources.

**No N+1 queries.** List endpoints use `COUNT(*)` plus a paged `SELECT`, and
the dashboard uses a single view query and a handful of grouped aggregates.

---

## Requirements

| Component  | Version                                            |
| ---------- | -------------------------------------------------- |
| Go         | 1.27 or newer                                       |
| PostgreSQL | 14 or newer (16 recommended)                        |
| Docker     | Optional, for the compose stack                     |

---

## Quick start with Docker

This starts PostgreSQL, applies the migrations and serves the API on
`http://localhost:8080`.

```bash
# from the repository root
cp .env.example .env      # optional: the compose defaults work as-is
docker compose up --build -d
docker compose logs -f api
```

Verify:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

The compose `api` service runs `/app/migrate -action up` before starting the
server, so a fresh database is initialised automatically.

The compose stack also builds the frontend and serves it on
`http://localhost:8081`, with `/api` proxied to the backend so the browser
only ever talks to one origin.

> **Note on `DATABASE_URL`:** when that variable is set it takes precedence over
> the individual `DB_*` variables. The compose stack passes it through, so an
> exported `DATABASE_URL` (for example one pointing at a hosted database) will
> override the local container. Unset it to use the local PostgreSQL.

Stop the stack with `docker compose down` (add `-v` to drop the database
volume).

---

## Local development

```bash
# 1. Dependencies
cd backend
go mod download

# 2. Configuration
cp ../.env.example ../.env
# Edit ../.env and set at least:
#   JWT_ACCESS_SECRET=<a long random string>
#   JWT_REFRESH_SECRET=<a different long random string>
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# 3. Database
createdb leadnest

# 4. Apply the migrations
make migrate-up

# 5. Run
make run
```

The API listens on `SERVER_ADDR` (default `:8080`).

> The `.env` file lives in the repository root, next to `docker-compose.yml`,
> because Docker Compose reads it from the project directory. The server finds
> it from the working directory or from the parent directories, so it works
> from the repository root and from `backend/` alike.

---

## Configuration

Configuration is read from the environment; `.env` is loaded automatically in
development. See `.env.example` for the full list with placeholder values.

| Variable                                   | Default              | Purpose                                        |
| ------------------------------------------ | -------------------- | ---------------------------------------------- |
| `SERVER_ADDR`                              | `:8080`              | Listen address                                  |
| `SERVER_READ_TIMEOUT` / `WRITE_TIMEOUT`    | `15s`                | HTTP timeouts                                   |
| `DB_HOST` / `DB_PORT` / `DB_NAME`           | `localhost:5432`     | PostgreSQL connection parts                     |
| `DB_USER` / `DB_PASSWORD` / `DB_SSLMODE`    | `leadnest`           | PostgreSQL credentials                          |
| `DATABASE_URL`                             | *(empty)*            | Full connection URL; overrides the parts above  |
| `DB_MAX_CONNS` / `DB_MIN_CONNS`             | `25` / `5`           | Connection pool sizing                          |
| `JWT_ACCESS_SECRET`                        | *(required)*         | HMAC secret for access tokens                   |
| `JWT_REFRESH_SECRET`                       | *(required)*         | HMAC secret for refresh tokens                  |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`        | `15m` / `7d`         | Token lifetimes                                 |
| `AI_PROVIDER` / `AI_API_KEY`               | *(empty)*            | LLM provider; leave empty to disable AI         |
| `AI_BASE_URL` / `AI_MODEL` / `AI_TIMEOUT_MS`| OpenAI defaults     | LLM endpoint, model and timeout                 |
| `RATE_LIMIT_RPS` / `RATE_LIMIT_BURST`      | `100` / `200`        | Per-client rate limit                           |
| `CORS_ALLOWED_ORIGINS`                     | `http://localhost:3000` | Comma-separated allowed origins             |

Secrets are never hardcoded and never returned to clients. `JWT_ACCESS_SECRET`
and `JWT_REFRESH_SECRET` are required: the server refuses to start without
them.

---

## Database and migrations

Migrations are plain SQL files in `migrations/`, applied in filename order and
recorded in the `schema_migrations` table. Each file is executed inside a
transaction, so a failure leaves the database on the last good version.

```bash
make migrate-up       # apply every pending migration
make migrate-status   # show applied / pending migrations
make migrate-down     # roll back the most recently applied migration
```

A migration file may contain a `-- +migrate Down` section with the statements
that undo it; the runner uses that section for `migrate-down`.

### Schema

Seven tables, one view, and the `set_updated_at()` trigger function:

| Table             | Purpose                                                     |
| ----------------- | ----------------------------------------------------------- |
| `companies`       | Tenant root                                                |
| `users`           | Company members (`admin` / `employee`)                     |
| `customers`       | People and companies being sold to                         |
| `deals`           | Sales opportunities with a value, currency and status      |
| `tasks`           | Follow-up work items with status, priority and due date    |
| `activities`      | Customer timeline entries                                   |
| `ai_interactions` | Metadata of AI requests and responses                       |

`company_dashboard` exposes the headline per-company metrics.

**Migration 002** corrects `company_dashboard`. The original definition joined
`customers`, `deals` and `tasks` in one query, so every deal row was repeated
once per customer × task combination and `SUM(value)` was inflated. The counts
used `COUNT(DISTINCT ...)` and were unaffected, which is why only the revenue
column was wrong. The view now uses one scalar subquery per metric.

### Compatibility notes

- `gen_random_uuid()` is built into PostgreSQL 13 and later, so no `pgcrypto`
  extension is required.
- `FILTER (WHERE ...)` on aggregates needs PostgreSQL 9.4 or later.
- The schema is written for PostgreSQL 14+; it was exercised against 16.

### Additive changes

Three migrations extend the schema without changing any existing column,
constraint or relationship:

| Migration | Change                                                        |
| --------- | ------------------------------------------------------------- |
| `002`     | Rewrites `company_dashboard` to fix an inflated revenue figure |
| `003`     | Adds `customers.company`, `customers.notes`, `deals.description` |

`002` replaces the view's definition because the original joined `customers`,
`deals` and `tasks` together, repeating every deal row once per customer ×
task combination. `COUNT(DISTINCT ...)` hid the problem for the counts, but
`SUM(value)` was inflated. The view now uses one scalar subquery per metric.

`003` adds the three columns the customer and deal forms need. All three are
nullable, so existing rows are untouched and the migration is reversible.

---

## API overview

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Path                   | Description                                  |
| ------ | ---------------------- | -------------------------------------------- |
| POST   | `/auth/register`       | Create a company and its first administrator  |
| POST   | `/auth/login`          | Exchange credentials for an access token      |
| GET    | `/auth/me`             | Current authenticated user                    |
| POST   | `/auth/refresh`        | Exchange a refresh token for an access token  |
| POST   | `/auth/logout`         | Revoke the stored refresh token               |

### Companies

| Method | Path             | Description                        |
| ------ | ---------------- | ---------------------------------- |
| GET    | `/companies/me`  | The caller's company                |
| PATCH  | `/companies/me`  | Update the company (admins only)    |

### Users (company employees)

| Method | Path       | Description                        |
| ------ | ---------- | ---------------------------------- |
| GET    | `/users`   | List company members (admins only)  |
| POST   | `/users`   | Add an employee (admins only)       |
| PATCH  | `/users/:id` | Update role, name or active state  |
| DELETE | `/users/:id` | Deactivate a user                  |

### Customers

| Method | Path               | Description                                     |
| ------ | ------------------ | ----------------------------------------------- |
| GET    | `/customers`       | Paginated, searchable, filterable, sortable     |
| POST   | `/customers`       | Create a customer                                |
| GET    | `/customers/:id`   | Read one customer                                |
| PATCH  | `/customers/:id`   | Update a customer                                |
| DELETE | `/customers/:id`   | Delete a customer and its dependent records      |

Query parameters: `limit`, `offset`, `search` (name, email or phone),
`assigned_to`, `source`, `sort`, `order`.

`GET /customers/:id` accepts an `include` parameter to return the customer's
related records alongside the customer itself:

```bash
GET /api/v1/customers/:id?include=deals,activities
```

The response then carries a `deals` array and an `activities` array (the 20
most recent). Without the parameter the response contains the customer only.
An unknown include value is rejected with `400`.

### Deals

| Method | Path             | Description                     |
| ------ | ---------------- | ------------------------------- |
| GET    | `/deals`         | Paginated and filtered deals    |
| POST   | `/deals`         | Create a deal                   |
| GET    | `/deals/:id`     | Read one deal                   |
| PATCH  | `/deals/:id`     | Update a deal or its status     |
| DELETE | `/deals/:id`     | Delete a deal                   |

Query parameters: `limit`, `offset`, `search`, `status`, `assigned_to`,
`customer_id`, `expected_close_from`, `expected_close_to`, `sort`, `order`.

Statuses: `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`,
`lost`. Moving to `won` or `lost` records `closed_at`; reopening clears it.

### Tasks

| Method | Path         | Description                  |
| ------ | ------------ | ---------------------------- |
| GET    | `/tasks`     | Paginated and filtered tasks |
| POST   | `/tasks`     | Create a task                |
| GET    | `/tasks/:id` | Read one task                |
| PATCH  | `/tasks/:id` | Update a task                |
| DELETE | `/tasks/:id` | Delete a task                |

Query parameters: `limit`, `offset`, `status`, `priority`, `assigned_to`,
`customer_id`, `deal_id`, `due_from`, `due_to`, `overdue`, `sort`, `order`.

Statuses: `pending`, `completed`, `cancelled`. Priorities: `low`, `medium`,
`high`. Completing a task records `completed_at`; reopening clears it.

### Activities

| Method | Path                                  | Description                |
| ------ | ------------------------------------- | -------------------------- |
| GET    | `/activities`                         | Activity feed              |
| GET    | `/activities/:id`                     | Read one activity          |
| GET    | `/customers/:id/activities`           | A customer's timeline      |
| POST   | `/customers/:id/activities`           | Record an activity         |

Types: `call`, `email`, `meeting`, `note`, `message`, `other`. The
authenticated user is recorded as the author automatically. Activities are
returned in reverse chronological order.

### Dashboard

| Method | Path                            | Description                        |
| ------ | ------------------------------- | ---------------------------------- |
| GET    | `/dashboard`                    | Full dashboard payload             |
| GET    | `/dashboard/sales-pipeline`     | Deal counts and values by status   |
| GET    | `/dashboard/recent-activities`  | Latest activity feed               |
| GET    | `/dashboard/upcoming-tasks`     | Pending tasks by due date          |

### AI

| Method | Path                          | Description                        |
| ------ | ----------------------------- | ---------------------------------- |
| POST   | `/ai/email-draft`             | Draft a follow-up email            |
| POST   | `/ai/customer-summary`        | Summarise a customer               |
| POST   | `/ai/follow-up-suggestions`   | Suggest who to follow up with      |
| GET    | `/ai/history`                 | Recorded AI interaction metadata   |

### Probes and documentation

| Method | Path            | Description                          |
| ------ | --------------- | ------------------------------------ |
| GET    | `/health`       | Liveness (no database access)        |
| GET    | `/ready`        | Readiness (checks dependencies)       |
| GET    | `/swagger/*`    | Swagger UI                           |
| GET    | `/openapi.json` | The OpenAPI description              |

---

## Response format

Success:

```json
{ "data": { "id": "uuid", "full_name": "Example Customer" } }
```

List responses add pagination metadata:

```json
{ "data": [ ... ], "meta": { "total": 42, "limit": 20, "offset": 0 } }
```

Error:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request contains invalid fields" } }
```

Validation failures include a `details` array naming each offending field.

### Status codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| 200  | Successful read or update                          |
| 201  | Resource created                                   |
| 204  | Resource deleted, no body                          |
| 400  | Malformed request or invalid query parameter       |
| 401  | Missing or invalid authentication                  |
| 403  | Authenticated but not permitted                    |
| 404  | Resource not available to this caller              |
| 409  | Uniqueness conflict                                |
| 422  | Validation failure                                 |
| 429  | Rate limit exceeded                                |
| 500  | Unexpected failure                                 |
| 502  | The AI provider failed                              |
| 503  | A dependency (or the AI provider) is not configured |
| 504  | The AI provider timed out                          |

Internal details — stack traces, SQL errors, password hashes, secrets — are
never returned to clients. They are logged server-side instead.

---

## Authentication and authorization

Registration creates a company and its first administrator inside a single
transaction; if the second insert fails the company creation is rolled back.

Passwords are hashed with **Argon2id** (64 MiB, 1 iteration, 4 lanes) in the
standard PHC string format, and verification is constant-time. Password hashes
are never returned by any endpoint.

Access tokens are **HS256 JWTs** carrying the user id, company id, role and
email, with a 15-minute lifetime. Refresh tokens are opaque random strings;
only their SHA-256 digest is stored, so a database leak does not expose usable
refresh tokens. `POST /auth/logout` clears the stored digest, revoking it.

The JWT middleware re-reads the user row on every request. This means an
account that is deactivated stops working immediately, and the tenant scope
always comes from the database rather than from anything the client sent.

**Role rules**

- `admin` can manage the company's employees, including changing roles and
  deactivating accounts.
- `employee` can manage customers, deals, tasks and activities.
- An administrator cannot deactivate or demote their own account, which would
  allow the last administrator to lock the company out.
- An employee cannot reach `/users` at all, so they cannot promote themselves.
- Every user-management query is filtered by the caller's `company_id`, so one
  company can never modify another company's users.

---

## AI features

The AI layer is a separate, provider-independent service. It talks to any
OpenAI-compatible chat-completions endpoint (OpenAI, Azure OpenAI, or a
self-hosted gateway) through the `Provider` interface.

- `AI_API_KEY` is read from the environment and never leaves the process.
- Contact details are withheld from prompts by default; only the minimum CRM
  context needed for a draft is sent.
- Request payloads are size-limited and the provider response is read through a
  bounded reader.
- Timeouts, rate limits (429), provider errors and empty responses are each
  mapped to a specific HTTP status.
- Successful interactions are recorded in `ai_interactions` with the metadata
  (type, model, provider, duration) and a truncated copy of the exchange.
- AI output is always labelled as a suggestion. The service cannot change a
  deal status, delete anything, or take any other consequential action — it
  only produces text.
- When no provider is configured the AI endpoints return `503` and the rest of
  the API keeps working normally.

To enable AI:

```bash
AI_PROVIDER=openai-compatible
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

---

## Testing

Three layers:

1. **Unit tests** — no database required.
2. **Integration tests** — run against a dedicated PostgreSQL database, behind
   the `integration` build tag.
3. **Smoke test** — exercises a running server over HTTP.

### Unit tests

```bash
make test
```

### Integration tests

The integration suite applies the repository's own migration files to the test
database and truncates every table between tests, so it exercises the same DDL
that production uses. It covers registration and login, password verification,
JWT handling, role-based access control, cross-company isolation, customer
CRUD, deal status transitions, task completion, dashboard calculations, AI
provider errors and timeouts, SQL constraints and transaction rollback.

```bash
# from the repository root
docker compose -f docker-compose.test.yml up -d db-test
docker compose -f docker-compose.test.yml run --rm tests
```

Or, against a database you already have:

```bash
export TEST_DATABASE_URL="postgres://user:pass@localhost:5432/leadnest_test?sslmode=disable"
make test-integration
```

> Always point `TEST_DATABASE_URL` at a throwaway database. The suite truncates
> every table it uses.

### Smoke test

With the stack running:

```bash
sh scripts/smoke.sh http://localhost:8080
```

It registers two companies and checks that neither can see the other's
records, verifies status codes and error shapes, and confirms that password
hashes never appear in a response.

### Frontend tests

The web client has its own suite. See `../frontend/README.md` for the details.

```bash
cd ../frontend
npm install
npm run typecheck     # TypeScript, strict mode
npm run lint          # ESLint, zero warnings allowed
npm test              # unit and component tests
npm run build         # production bundle
npm run test:e2e      # Playwright, needs a running backend
```

---

## Makefile commands

Run these from the `backend/` directory.

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `make help`           | List all targets                             |
| `make build`          | Build the API and migration runner into `bin` |
| `make run`            | Build and run the API                        |
| `make fmt`            | Format all Go files                          |
| `make fmt-check`      | Verify formatting without changing files     |
| `make vet`            | Run `go vet`                                 |
| `make test`           | Run the unit tests                           |
| `make test-integration` | Run the integration tests                  |
| `make test-all`       | Run everything                               |
| `make cover`          | Report test coverage                         |
| `make migrate-up`     | Apply pending migrations                     |
| `make migrate-down`   | Roll back the last migration                 |
| `make migrate-status` | Show migration status                        |
| `make swagger`        | Regenerate the OpenAPI documentation         |
| `make docker-build`   | Build the Docker image                       |
| `make docker-up/down` | Start or stop the local stack                |

---

## Project layout

```
leadnest/
├── backend/
│   ├── cmd/
│   │   ├── api/            # API server entrypoint
│   │   ├── migrate/        # migration runner
│   │   └── storagecheck/   # object storage health probe
│   ├── internal/
│   │   ├── config/         # environment configuration
│   │   ├── database/       # pgx pool and transaction helper
│   │   ├── middleware/     # auth, RBAC, tenant scope, CORS, rate limit
│   │   ├── auth/           # Argon2id hashing and JWT
│   │   ├── companies/      # company endpoints
│   │   ├── users/          # auth endpoints and employee management
│   │   ├── customers/      # customer CRUD
│   │   ├── deals/          # deal CRUD and status transitions
│   │   ├── tasks/          # task CRUD and overdue queries
│   │   ├── activities/     # activity timeline
│   │   ├── dashboard/      # analytics
│   │   ├── ai/             # provider-independent AI service
│   │   ├── storage/        # optional S3-compatible object storage
│   │   ├── health/         # liveness and readiness probes
│   │   ├── models/         # shared domain types
│   │   ├── pagination/     # list query helpers
│   │   ├── response/       # response envelopes
│   │   ├── validation/     # payload validation
│   │   └── server/         # router wiring
│   ├── migrations/         # versioned SQL migrations
│   ├── docs/               # generated Swagger documentation
│   ├── scripts/            # test and smoke-test helpers
│   ├── tests/              # integration test suite
│   ├── go.mod
│   ├── Dockerfile
│   ├── Dockerfile.test
│   └── Makefile
├── frontend/               # the React web client
├── .env.example
├── docker-compose.yml
└── docker-compose.test.yml
```

---

## Operational notes

- **Rate limiting** is a per-client token bucket (`RATE_LIMIT_RPS`,
  `RATE_LIMIT_BURST`). It is in-process; a multi-instance deployment should
  move it to a shared store.
- **Refresh token revocation** is a database column, so it works across
  instances without extra infrastructure.
- **Money** is stored as `NUMERIC(15,2)` and handled with a decimal library, so
  no binary floating-point rounding is involved. Revenue is grouped by
  currency; amounts in different currencies are never added together.
- **Logging** uses `log/slog` with a JSON handler.
- **Graceful shutdown** is handled on `SIGINT` and `SIGTERM`.
- **Timezone** — timestamps are stored as `TIMESTAMPTZ` and returned in UTC.
