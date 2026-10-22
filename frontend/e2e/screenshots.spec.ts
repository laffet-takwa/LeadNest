import { expect, test, type Page } from '@playwright/test'

/**
 * Captures the main screens so the visual result can be reviewed.
 *
 * Run with: npx playwright test e2e/screenshots.spec.ts
 * The images are written to e2e/__screenshots__/.
 */

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 10_000)}`

async function registerAndSeed(page: Page) {
  const email = `shot-${unique()}@example.com`
  await page.goto('/register')
  await page.getByLabel(/company name/i).fill('Atlas Consulting')
  await page.getByLabel(/your name/i).fill('Amira Ben Salah')
  await page.getByLabel(/your email/i).fill(email)
  await page.getByLabel(/^password/i).fill('Screenshot123!')
  await page.getByLabel(/confirm password/i).fill('Screenshot123!')
  await page.getByRole('button', { name: 'Create company' }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  // A customer, so the lists are not empty.
  await page.getByRole('button', { name: 'Add customer' }).first().click()
  await page.getByRole('dialog').getByLabel(/full name/i).fill('Sami Trabelsi')
  await page
    .getByRole('dialog')
    .getByLabel(/^company/i)
    .fill('Atlas Consulting')
  await page.getByRole('dialog').getByLabel(/^email/i).fill('sami@atlas.tn')
  await page.getByRole('dialog').getByRole('button', { name: 'Add customer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

test('captures the main screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await registerAndSeed(page)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'e2e/__screenshots__/dashboard.png', fullPage: true })

  await page.goto('/customers')
  await expect(page.getByText('Sami Trabelsi').first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/customers.png', fullPage: true })

  await page.goto('/pipeline')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/pipeline.png', fullPage: true })

  await page.goto('/tasks')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/tasks.png', fullPage: true })

  await page.goto('/ai')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/ai.png', fullPage: true })

  // Mobile layout, captured while the session is still alive.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'e2e/__screenshots__/dashboard-mobile.png', fullPage: true })

  await page.setViewportSize({ width: 1440, height: 960 })

  // Sign out first: the login route redirects a signed-in user to the
  // dashboard, so the auth screen has to be captured from a clean session.
  await page.locator('header').getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/login.png', fullPage: true })

  await page.goto('/register')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'e2e/__screenshots__/register.png', fullPage: true })
})
