# LeadNest — Frontend

The web client for **LeadNest**, an AI-powered CRM for small businesses. It is a
React single-page application that talks to the Go backend in this repository.

---

## Stack

| Concern     | Choice                                                    |
| ----------- | --------------------------------------------------------- |
| Framework   | React 19 with TypeScript in strict mode                    |
| Build tool  | Vite 6                                                    |
| Routing     | React Router 7 (data router, lazy-loaded routes)           |
| Server state| TanStack Query 5                                           |
| Forms       | React Hook Form + Zod                                     |
| Components  | Radix UI primitives, hand-styled to the LeadNest tokens    |
| Styling     | Tailwind CSS 3 with CSS custom properties for the tokens  |
| Icons       | Lucide React                                              |
| Motion      | Motion (framer-motion)                                    |
| Charts      | Recharts                                                  |
| Notifications | Sonner                                                  |
| Tests       | Vitest + React Testing Library, Playwright for e2e        |

---

## Getting started

```bash
npm install
cp .env.example .env      # optional; the defaults work with the dev proxy
npm run dev
```

The dev server runs on <http://localhost:5173> and proxies `/api` to
`http://localhost:8080`, so the browser only ever talks to one origin and the
access token never crosses a CORS boundary.

The backend has to be running. From the repository root:

```bash
docker compose up -d db api
```

### With Docker

```bash
docker build -t leadnest-frontend .
docker run --rm -p 8081:80 leadnest-frontend
```

Or bring up the whole stack from the repository root:

```bash
docker compose up --build
```

The frontend is then served on <http://localhost:8081>.

---

## Environment

| Variable              | Default   | Purpose                                             |
| --------------------- | --------- | --------------------------------------------------- |
| `VITE_API_BASE_URL`   | `/api/v1` | Base URL of the API, including the version prefix    |
| `VITE_DEV_API_PROXY`  | `http://localhost:8080` | Origin the dev server proxies `/api` to |

Only these two variables exist, and neither is a secret: everything prefixed
with `VITE_` is bundled into the browser and is public.

---

## Commands

| Command                  | Description                                     |
| ------------------------ | ----------------------------------------------- |
| `npm run dev`            | Dev server with hot reloading                   |
| `npm run build`          | Type-check and produce the production bundle     |
| `npm run preview`        | Serve the production bundle locally             |
| `npm run typecheck`      | TypeScript only                                 |
| `npm run lint`           | ESLint, zero warnings allowed                   |
| `npm run lint:fix`       | ESLint with auto-fixing                         |
| `npm run format`         | Prettier                                        |
| `npm test`               | Unit and component tests                        |
| `npm run test:watch`     | Tests in watch mode                             |
| `npm run test:coverage`  | Tests with a coverage report                    |
| `npm run test:e2e`       | Playwright end-to-end tests                     |

---

## Architecture

```
src/
├── app/                  # Router, providers, application shell
│   ├── app-shell.tsx     # The authenticated frame: sidebar, top bar, outlet
│   ├── providers.tsx     # Query client, auth provider, tooltips, toasts
│   └── router.tsx        # Route table and the authentication guard
├── components/
│   ├── ui/               # The design system: button, input, dialog, badge…
│   ├── layout/           # Shell chrome: sidebar, top bar, page header
│   ├── forms/            # FormField and the accessibility helpers
│   ├── feedback/         # Empty, error and loading states
│   └── data-display/     # Table, pagination, filters, stat cards, badges
├── features/             # One folder per domain
│   ├── auth/             # Session, token storage, login and register
│   ├── customers/        # List, detail, form
│   ├── deals/            # Pipeline board, form
│   ├── tasks/            # List, views, form
│   ├── activities/       # Timeline, filters, form
│   ├── ai/               # Draft, summary, suggestions, history
│   ├── companies/        # Company settings
│   ├── users/            # Team management
│   └── dashboard/        # Metrics, pipeline chart, tasks, activity feed
├── hooks/                # Shared hooks
├── lib/
│   ├── api/              # The typed HTTP client
│   ├── constants/        # Statuses, priorities, sources, currencies
│   ├── utils/            # Formatting, dates, class names
│   └── query-keys.ts     # Centralised query keys
├── styles/               # Design tokens and global styles
├── types/                # The API contract
└── test/                 # Test setup
```

**The API contract lives in `src/types/api.ts`.** Every field name mirrors the
backend's Go structs, including the `snake_case` JSON names. Nothing else in the
application hardcodes a field name.

**Only `src/lib/api/client.ts` calls `fetch`.** Feature code goes through the
service modules in `features/*/api`, and the pages use the query hooks in
`features/*/hooks`. No page constructs a request.

**Design tokens live in `src/styles/tokens.css`.** Colours, radii, shadows and
motion timings are declared once as CSS custom properties and exposed to
Tailwind through `tailwind.config.ts`.

---

## Design system

The palette is calm and professional: a deep navy sidebar, a single brand blue
for actions, and semantic colours that are never used alone — every status
badge carries a label as well as a colour, so the meaning does not depend on
being able to distinguish hues.

Spacing follows a four-point scale. Radii are deliberately modest: 8px for
small controls, 10px for inputs and buttons, 14px for cards, 20px for dialogs.
Shadows are reserved for elevation that carries meaning — a popover above the
page, a card lifted on hover.

Motion is short and purposeful: 120–180ms for controls, 180–260ms for dialogs
and drawers, 180–300ms for page entrances. `prefers-reduced-motion` is
respected globally, and animation is never the only way a state is communicated.

---

## Authentication

The backend issues bearer tokens in the response body; it does not set HttpOnly
cookies. The client therefore:

- keeps the **access token in memory only** — it is never written to storage;
- persists the **refresh token in `localStorage`** so a reload restores the
  session without a second sign-in;
- refreshes the access token proactively, one minute before it expires, and
  renews once on a `401` before signing the user out.

The trade-off is explicit: a refresh token in `localStorage` is readable by any
script running in the origin, so a successful XSS attack could steal it. The
alternative — never persisting it — turns every reload into a login, which is
worse for a daily-driver CRM. Moving to HttpOnly cookies needs a backend
change and is the recommended follow-up.

Route guards improve the experience but are never treated as a security
boundary: the backend enforces every permission.

---

## API integration

The client normalises every failure into an `ApiError` carrying the status,
the machine-readable code and any field-level validation messages. Forms map
those field errors onto the matching input, so a server-side rejection appears
next to the field rather than as a generic banner.

List endpoints are server-paged. The customer list writes its filters into the
URL, so a filtered view can be shared or bookmarked.

---

## Testing

```bash
npm test          # unit and component tests
npm run test:e2e  # end-to-end, needs a running backend
```

The unit suite covers the money and date formatting (the parts most likely to
be subtly wrong), the API error parsing, the validation schemas and the login
form. The end-to-end suite registers a company, creates a customer, a deal, a
task and an activity, checks the dashboard, signs out and confirms the
protected pages are no longer reachable.

The end-to-end suite needs the backend and a browser:

```bash
npx playwright install chromium
docker compose up -d db api     # from the repository root
npm run test:e2e
```

---

## Browser support

The application is tested in current Chromium. It uses CSS nesting-free
Tailwind output, `dvh` units, `AbortController` and `Intl`, so it targets
evergreen browsers from 2024 onwards.
