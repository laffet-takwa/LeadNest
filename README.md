# LeadNest

LeadNest is an AI-powered CRM for small businesses. The platform is a
monorepo: a Go API and a React web client, each in its own directory, wired
together with Docker Compose.

| Directory   | Contents                                              |
| ----------- | ----------------------------------------------------- |
| `backend/`  | Go API, SQL migrations, scripts and integration tests |
| `frontend/` | React + TypeScript web client                         |

- **Backend documentation** → [`backend/README.md`](backend/README.md)
- **Frontend documentation** → [`frontend/README.md`](frontend/README.md)

---

## Screens

Every image below is rendered by Chromium against the running stack, and every
row of data was written through the real API — nothing is mocked. Regenerate
them with `npx playwright test e2e/screenshots.spec.ts` from `frontend/`; they
land in [`docs/screenshots/`](docs/screenshots).

### Dashboard

<img src="docs/screenshots/03-dashboard.png" alt="Dashboard showing customer, deal, revenue and task metrics, a sales pipeline chart by status, upcoming tasks with an overdue item flagged, and a recent activity timeline" width="100%">

### Customers

| The list, with search, filters and server-side pagination | The record, with its deals and activity |
| :-- | :-- |
| <img src="docs/screenshots/04-customers.png" alt="Customers table with name, email, phone, company, source, assignee and row actions" width="100%"> | <img src="docs/screenshots/05-customer-detail.png" alt="Customer detail page with contact card, notes, related deals and AI and task actions" width="100%"> |
| <img src="docs/screenshots/13-customer-form.png" alt="Add customer dialog with labelled fields and validation" width="100%"> | <img src="docs/screenshots/15-customers-mobile.png" alt="Customers on a phone, where the table becomes data cards" width="100%"> |

### Sales pipeline

| The board, one column per status | A single deal |
| :-- | :-- |
| <img src="docs/screenshots/06-pipeline.png" alt="Sales pipeline board with deal cards showing value, customer, assignee, close date and a status control" width="100%"> | <img src="docs/screenshots/07-deal-detail.png" alt="Deal detail page with value, status, assignee and description" width="100%"> |
| <img src="docs/screenshots/16-pipeline-mobile.png" alt="Sales pipeline on a phone" width="100%"> | <img src="docs/screenshots/08-tasks.png" alt="Tasks list with due dates, priorities and an overdue task highlighted" width="100%"> |

### Work and intelligence

| Activities | AI assistant |
| :-- | :-- |
| <img src="docs/screenshots/09-activities.png" alt="Chronological activity timeline of calls, emails, meetings and notes" width="100%"> | <img src="docs/screenshots/10-ai.png" alt="AI assistant with email draft, customer summary, follow-up suggestions and history tabs" width="100%"> |

| Team | Settings |
| :-- | :-- |
| <img src="docs/screenshots/12-team.png" alt="Team management with roles and an assignee picker per member" width="100%"> | <img src="docs/screenshots/11-settings.png" alt="Settings split into company, profile and security forms" width="100%"> |

### Signing in

| Register a company | Sign in | Mobile dashboard |
| :-- | :-- | :-- |
| <img src="docs/screenshots/02-register.png" alt="Registration form that creates the company and its first administrator in one step" width="100%"> | <img src="docs/screenshots/01-login.png" alt="Login form" width="100%"> | <img src="docs/screenshots/14-dashboard-mobile.png" alt="Dashboard on a phone, with the sidebar collapsed to a drawer" width="100%"> |

The AI assistant is shown without a provider configured, which is how the API
answers when `AI_PROVIDER` is empty: the screen stays usable and every
generation reports that it is unavailable rather than inventing an answer.

---

## Layout

```
leadnest/
├── backend/                 # Go (Gin, PostgreSQL) API
│   ├── cmd/                 # api, migrate, storagecheck
│   ├── internal/            # handlers, repositories, middleware
│   ├── migrations/          # versioned SQL migrations
│   ├── docs/                # generated Swagger documentation
│   ├── scripts/             # test and smoke-test helpers
│   ├── tests/               # integration test suite
│   ├── Dockerfile
│   ├── Dockerfile.test
│   └── Makefile
├── frontend/                # React + TypeScript + Vite client
│   ├── e2e/                 # Playwright end-to-end tests
│   ├── src/                 # application source
│   └── Dockerfile
├── .env.example             # template for the local environment
├── docker-compose.yml       # database, API and web client
├── docker-compose.test.yml  # database and integration test runner
└── .gitignore
```

---

## Quick start with Docker

From this directory:

```bash
cp .env.example .env      # optional: the compose defaults work as-is
docker compose up --build -d
docker compose logs -f api
```

This starts PostgreSQL, applies the migrations, serves the API on
`http://localhost:8080` and the web client on `http://localhost:8081`. The
browser only ever talks to one origin, because the frontend container proxies
`/api` to the backend.

Verify:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/ready
```

Stop the stack with `docker compose down` (add `-v` to drop the database
volume).

---

## Local development

Backend:

```bash
cd backend
go mod download
cp ../.env.example ../.env   # then set the JWT secrets and DB credentials
make migrate-up
make run
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The API listens on `SERVER_ADDR` (default `:8080`) and the dev server on
`http://localhost:3000`.

---

## Testing

```bash
# backend unit tests
cd backend && make test

# backend integration tests (needs PostgreSQL)
docker compose -f docker-compose.test.yml up -d db-test
docker compose -f docker-compose.test.yml run --rm tests

# frontend
cd frontend && npm test
```

See the two README files for the full list of commands and for the API
reference.
