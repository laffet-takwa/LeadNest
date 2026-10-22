import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end coverage of the primary CRM flow.
 *
 * The suite registers a company, signs in, creates a customer, a deal, a task
 * and an activity, checks the dashboard, signs out, and confirms the protected
 * pages are no longer reachable.
 */

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 10_000)}`

/** The dialog currently on screen. */
function dialog(page: Page) {
  return page.getByRole('dialog')
}

/** The account menu in the top bar (the sidebar has one too). */
function accountMenu(page: Page) {
  return page.locator('header').getByRole('button', { name: 'Account menu' })
}

async function register(page: Page): Promise<{ email: string; password: string }> {
  const email = `e2e-${unique()}@example.com`
  const password = 'E2ePassw0rd!'

  await page.goto('/register')
  await page.getByLabel(/company name/i).fill('E2E Company')
  await page.getByLabel(/your name/i).fill('E2E Admin')
  await page.getByLabel(/your email/i).fill(email)
  await page.getByLabel(/^password/i).fill(password)
  await page.getByLabel(/confirm password/i).fill(password)
  await page.getByRole('button', { name: 'Create company' }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  return { email, password }
}

test.describe('LeadNest CRM', () => {
  test('registers a company and lands on the dashboard', async ({ page }) => {
    await register(page)
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByText(/total customers/i).first()).toBeVisible()
  })

  test('creates a customer, a deal, a task and an activity', async ({ page }) => {
    await register(page)

    // Customer.
    await page.getByRole('button', { name: 'Add customer' }).first().click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByLabel(/full name/i).fill('E2E Customer')
    await dialog(page).getByLabel(/^email/i).fill(`customer-${unique()}@example.com`)
    await dialog(page).getByRole('button', { name: 'Add customer' }).click()
    await expect(dialog(page)).toBeHidden()

    await page.goto('/customers')
    await expect(page.getByText('E2E Customer').first()).toBeVisible()

    // Deal. A deal always belongs to a customer, so one is selected.
    await page.goto('/pipeline')
    await page.getByRole('button', { name: 'New deal' }).first().click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByLabel(/^title/i).fill('E2E Deal')
    await dialog(page).getByLabel(/^value/i).fill('1500.50')
    await dialog(page).getByRole('combobox', { name: 'Customer' }).click()
    await page.getByRole('option', { name: /E2E Customer/ }).click()
    await dialog(page).getByRole('button', { name: 'Create deal' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByText('E2E Deal').first()).toBeVisible()

    // Task.
    await page.goto('/tasks')
    await page.getByRole('button', { name: 'New task' }).first().click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByLabel(/^title/i).fill('E2E Task')
    await dialog(page).getByRole('button', { name: 'Create task' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByText('E2E Task').first()).toBeVisible()

    // Activity.
    await page.goto('/activities')
    await page.getByRole('button', { name: 'Record activity' }).first().click()
    await expect(dialog(page)).toBeVisible()
    await dialog(page).getByRole('combobox', { name: 'Customer' }).click()
    await page.getByRole('option', { name: /E2E Customer/ }).click()
    await dialog(page).getByLabel(/^subject/i).fill('E2E Activity')
    await dialog(page).getByRole('button', { name: 'Record activity' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByText('E2E Activity').first()).toBeVisible()
  })

  test('signs out and blocks the protected pages', async ({ page }) => {
    await register(page)

    await accountMenu(page).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/customers')
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects a sign-in with the wrong password', async ({ page }) => {
    const { email } = await register(page)

    await accountMenu(page).click()
    await page.getByRole('menuitem', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel(/^email/i).fill(email)
    await page.getByLabel(/^password/i).fill('TotallyWrongValue')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('alert')).toContainText(/not recognised/i)
  })
})
