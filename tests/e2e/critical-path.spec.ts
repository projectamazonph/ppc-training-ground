import { test, expect } from '@playwright/test';

/**
 * Critical student journey: signup → landing → course browse.
 *
 * Prerequisites:
 *   - Server running (pnpm dev) with seeded database
 *   - E-mail uses a unique timestamp so each run gets a fresh account
 */

const EMAIL = `test-${Date.now()}@amph-e2e.example`;
const PASSWORD = 'TestPass123!';
const NAME = 'E2E Student';

test.describe('Critical path — student journey', () => {
  test('homepage loads with navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1, [class*="hero"], [class*="logo"]').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /sign.?in/i }).or(page.getByRole('button', { name: /sign.?in/i })).first()).toBeVisible();
  });

  test('signup creates an account and redirects', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.getByLabel(/name/i).fill(NAME);
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByLabel(/confirm password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /create account/i }).click();

    // After signup, user is redirected to home (or dashboard)
    await page.waitForURL(/\/($|dashboard)/, { timeout: 10_000 });
  });

  test('signed-in user sees courses link', async ({ page }) => {
    // Reuse signed-in state via storageState or re-login
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign.?in/i }).click();
    await page.waitForURL(/\//, { timeout: 10_000 });

    await expect(page.getByRole('link', { name: /courses/i }).first()).toBeVisible();
  });

  test('courses page loads and shows course list', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/^password/i).fill(PASSWORD);
    await page.getByRole('button', { name: /sign.?in/i }).click();
    // Wait for redirect to root (sign-in complete) — not just any URL with "/"
    await page.waitForURL('**/', { timeout: 10_000 });

    await page.goto('/courses');
    await expect(page).toHaveURL(/\/courses/);
    await expect(page.getByRole('heading', { name: /courses/i })).toBeVisible();
  });

  test('pricing page shows tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/foundations|mastery|transformation/i).first()).toBeVisible();
  });
});
