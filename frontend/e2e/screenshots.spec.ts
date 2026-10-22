/**
 * Screen captures.
 *
 * Renders every screen with representative data so the result can be reviewed
 * and embedded in the README.
 *
 * The rows are written through the real API — the same PostgreSQL instance a
 * user hits, nothing mocked — because the forms already have their own coverage
 * in app.spec.ts and a screenshot suite only needs a populated database.
 *
 * Run with:
 *   docker compose up -d db api                    # from the repository root
 *   npx playwright test e2e/screenshots.spec.ts
 *
 * The images are written to <repo>/docs/screenshots/.
 */

import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Locator,
  type Page,
} from '@playwright/test'

const API = process.env.E2E_API_URL ?? 'http://localhost:8080/api/v1'
const SHOTS = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))

// Every run creates a fresh company, so the seeded emails have to be unique.
// The suffix is short because it is visible on the Team screen.
const TAG = Date.now().toString(36).slice(-5)

const EMAIL = `amira.${TAG}@atlas.tn`
const PASSWORD = 'Screenshot123!'

const DESKTOP = { width: 1440, height: 960 }
const MOBILE = { width: 390, height: 844 }

/** The part of the register response this suite reads. */
interface AuthEnvelope {
  data: { access_token: string; user: { id: string } }
}

/** The part of any create response this suite reads. */
interface IdEnvelope {
  data: { id: string }
}

interface Person {
  full_name: string
  company: string
  email: string
  phone: string
  source: string
}

interface Opportunity {
  title: string
  value: string
  status: string
  offset: number
}

interface FollowUp {
  title: string
  priority: string
  status: string
  offset: number
}

interface Contact {
  type: string
  subject: string
  description: string
}

/** A date `offsetDays` from today, as the date-only value the API expects. */
function day(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
}

function field(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined
  return (value as Record<string, unknown>)[key]
}

function isAuthEnvelope(value: unknown): value is AuthEnvelope {
  const data = field(value, 'data')
  return (
    typeof field(data, 'access_token') === 'string' &&
    typeof field(field(data, 'user'), 'id') === 'string'
  )
}

function isIdEnvelope(value: unknown): value is IdEnvelope {
  return typeof field(field(value, 'data'), 'id') === 'string'
}

/**
 * Reads a JSON body and proves it has the shape the suite expects, so no `any`
 * leaks out of Playwright's untyped `json()`.
 */
async function read<T>(
  response: APIResponse,
  guard: (value: unknown) => value is T,
  what: string,
): Promise<T> {
  const value: unknown = await response.json()
  if (!guard(value)) throw new Error(`${what}: unexpected response shape`)
  return value
}

/** Colleagues, so the Team screen and the assignee columns are not one-man. */
const TEAM_MATES: { full_name: string; email: string; role: string }[] = [
  { full_name: 'Youssef Khelifa', email: `youssef.${TAG}@atlas.tn`, role: 'employee' },
  { full_name: 'Nadia Belhadj', email: `nadia.${TAG}@atlas.tn`, role: 'employee' },
]

const PEOPLE: Person[] = [
  {
    full_name: 'Sami Trabelsi',
    company: 'Nomad Studio',
    email: 'sami@nomad.tn',
    phone: '+21620111111',
    source: 'referral',
  },
  {
    full_name: 'Rania Gharbi',
    company: 'Blue Sea Ltd',
    email: 'rania@bluesea.tn',
    phone: '+21620222222',
    source: 'website',
  },
  {
    full_name: 'Karim Aloui',
    company: 'Terra Logistics',
    email: 'karim@terra.tn',
    phone: '+21620333333',
    source: 'linkedin',
  },
  {
    full_name: 'Ines Marzouki',
    company: 'Cedar Design',
    email: 'ines@cedar.tn',
    phone: '+21620444444',
    source: 'event',
  },
]

const OPPORTUNITIES: Opportunity[] = [
  { title: 'Website rebuild', value: '8500.00', status: 'new', offset: 21 },
  { title: 'Managed IT contract', value: '24000.00', status: 'contacted', offset: 30 },
  { title: 'Cloud migration', value: '18750.50', status: 'qualified', offset: 45 },
  { title: 'Security audit', value: '12000.00', status: 'proposal', offset: 14 },
  { title: 'CRM rollout', value: '9800.00', status: 'negotiation', offset: 7 },
  { title: 'Helpdesk retainer', value: '15400.00', status: 'won', offset: -3 },
  { title: 'Data warehouse', value: '22000.00', status: 'lost', offset: -10 },
]

const FOLLOW_UPS: FollowUp[] = [
  { title: 'Send the migration proposal', priority: 'high', status: 'pending', offset: 1 },
  { title: 'Call about the audit scope', priority: 'medium', status: 'pending', offset: 3 },
  { title: 'Chase the signed retainer', priority: 'high', status: 'pending', offset: -2 },
  { title: 'Book the kickoff meeting', priority: 'low', status: 'completed', offset: -5 },
]

const CONTACTS: Contact[] = [
  {
    type: 'call',
    subject: 'Discovery call',
    description: 'Walked through the current setup. Budget confirmed for Q4.',
  },
  {
    type: 'email',
    subject: 'Sent the pricing sheet',
    description: 'Three tiers, with the managed option as the default.',
  },
  {
    type: 'meeting',
    subject: 'Technical review',
    description: 'Their CTO wants a migration plan before signing.',
  },
  {
    type: 'note',
    subject: 'Decision maker changed',
    description: 'Ines now owns the budget for this account.',
  },
]

async function register(request: APIRequestContext): Promise<{ token: string; adminId: string }> {
  const response = await request.post(`${API}/auth/register`, {
    data: {
      company: {
        name: 'Atlas Consulting',
        email: 'hello@atlas.tn',
        phone: '+21620123456',
        website: 'https://atlas.tn',
      },
      admin: { full_name: 'Amira Ben Salah', email: EMAIL, password: PASSWORD },
    },
  })
  expect(response.ok(), `register -> ${response.status()}`).toBeTruthy()
  const auth = (await read(response, isAuthEnvelope, 'register')).data
  return { token: auth.access_token, adminId: auth.user.id }
}

async function create(
  request: APIRequestContext,
  token: string,
  path: string,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await request.post(`${API}${path}`, {
    data,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `${path} -> ${response.status()}`).toBeTruthy()
  return (await read(response, isIdEnvelope, path)).data.id
}

/** Seeds customers, a pipeline spanning every status, tasks and a timeline. */
async function seed(request: APIRequestContext) {
  const { token, adminId } = await register(request)

  const team = [adminId]
  for (const member of TEAM_MATES) {
    team.push(await create(request, token, '/users', { ...member, password: PASSWORD }))
  }

  const customers: string[] = []
  for (const [index, person] of PEOPLE.entries()) {
    customers.push(
      await create(request, token, '/customers', {
        ...person,
        assigned_to: team[index % team.length],
        notes: 'Prefers WhatsApp over email. Follow up before the end of the month.',
      }),
    )
  }

  const deals: string[] = []
  for (const [index, deal] of OPPORTUNITIES.entries()) {
    deals.push(
      await create(request, token, '/deals', {
        customer_id: customers[index % customers.length],
        assigned_to: team[index % team.length],
        title: deal.title,
        description: 'Scope agreed with the technical lead. Two stakeholders still to convince.',
        value: deal.value,
        currency: 'TND',
        status: deal.status,
        expected_close: day(deal.offset),
      }),
    )
  }

  for (const [index, task] of FOLLOW_UPS.entries()) {
    await create(request, token, '/tasks', {
      title: task.title,
      description: 'Keep the customer updated before the deadline.',
      assigned_to: team[index % team.length],
      customer_id: customers[index % customers.length],
      deal_id: deals[index % deals.length],
      priority: task.priority,
      status: task.status,
      due_date: day(task.offset),
    })
  }

  for (const [index, contact] of CONTACTS.entries()) {
    await create(
      request,
      token,
      `/customers/${customers[index % customers.length]}/activities`,
      {
        ...contact,
        deal_id: deals[index % deals.length],
      },
    )
  }

  return { customer: customers[0], deal: deals[2] }
}

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/^email/i).fill(EMAIL)
  await page.getByLabel(/^password/i).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
}

function shot(name: string): string {
  return `${SHOTS}${name}.png`
}

/**
 * Waits for the route to be fully rendered before capturing.
 *
 * Every route is lazy-loaded, so shooting straight after `goto` catches the
 * "Loading…" fallback instead of the screen.
 */
async function capture(page: Page, name: string, anchor: Locator, settleMs = 400) {
  await expect(anchor).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(settleMs)
  await page.screenshot({ path: shot(name), fullPage: true })
}

test.describe('Screen captures', () => {
  test.setTimeout(240_000)

  test('renders every screen with data', async ({ page, request }) => {
    mkdirSync(SHOTS, { recursive: true })
    const { customer, deal } = await seed(request)
    const heading = (name: RegExp) => page.getByRole('heading', { name })

    await page.setViewportSize(DESKTOP)

    await page.goto('/login')
    await capture(page, '01-login', heading(/welcome back/i))

    await page.goto('/register')
    await capture(page, '02-register', heading(/create your company/i))

    await signIn(page)
    // The charts animate in, so hold longer than the other screens.
    await capture(page, '03-dashboard', page.getByText('Open pipeline value'), 1_800)

    await page.goto('/customers')
    await capture(page, '04-customers', page.getByText('4 customers'))

    await page.goto(`/customers/${customer}`)
    await capture(page, '05-customer-detail', page.getByText('Nomad Studio').first())

    await page.goto('/pipeline')
    await capture(page, '06-pipeline', page.getByText('Cloud migration').first())

    await page.goto(`/deals/${deal}`)
    await capture(page, '07-deal-detail', page.getByText('Cloud migration').first())

    await page.goto('/tasks')
    await capture(page, '08-tasks', page.getByText('Chase the signed retainer').first())

    await page.goto('/activities')
    await capture(page, '09-activities', page.getByText('Discovery call').first())

    await page.goto('/ai')
    await capture(page, '10-ai', heading(/^AI assistant$/i))

    await page.goto('/settings')
    await capture(page, '11-settings', heading(/^Settings$/i))

    await page.goto('/team')
    await capture(page, '12-team', heading(/^Team$/i))

    // A form, so the dialog design is visible too.
    await page.goto('/customers')
    await expect(page.getByText('4 customers')).toBeVisible()
    await page.getByRole('button', { name: 'Add customer' }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/full name/i).fill('Yasmine Chaabane')
    await page.screenshot({ path: shot('13-customer-form') })
    await page.keyboard.press('Escape')

    // Mobile: the shell collapses to a drawer and the tables to cards.
    await page.setViewportSize(MOBILE)

    await page.goto('/dashboard')
    await capture(page, '14-dashboard-mobile', heading(/welcome back/i), 1_800)

    await page.goto('/customers')
    // The desktop table stays in the DOM at this width but hidden, so assert on
    // the header count rather than a row.
    await capture(page, '15-customers-mobile', page.getByText('4 customers'))

    await page.goto('/pipeline')
    await capture(page, '16-pipeline-mobile', page.getByText('7 deals'))
  })
})
