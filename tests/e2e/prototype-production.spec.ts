import { expect, test } from '@playwright/test';

test('production dashboard excludes the development fixtures', async ({ page }) => {
  const response = await page.goto('/dashboard');

  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dashboard',
      exact: true,
    }),
  ).toBeVisible();

  await expect(page.locator('body')).not.toContainText('Demonstration data');

  await expect(page.locator('body')).not.toContainText('Noor Rahman');

  const html = await response!.text();

  expect(html).not.toContain('demo-001@example.invalid');
  expect(html).not.toContain('Warm contemporary villa');
});

test('development lead details are unavailable in production', async ({ page }) => {
  const response = await page.goto('/leads/details/demo-001');

  expect(response?.status()).toBe(404);

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Noor Rahman',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('component library is unavailable in production', async ({ page }) => {
  const response = await page.goto('/dev/component-library');

  expect(response?.status()).toBe(404);

  await expect(
    page.getByRole('form', {
      name: 'Sample inquiry form',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('authentication setup page is unavailable in production', async ({ page }) => {
  const response = await page.goto('/dev/auth-setup');

  expect(response?.status()).toBe(404);

  await expect(
    page.getByRole('heading', {
      name: 'Authentication setup',
      exact: true,
    }),
  ).toHaveCount(0);
});
