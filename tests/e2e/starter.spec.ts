import { expect, test } from '@playwright/test';

test('home opens the workspace without a development identity', async ({ page }) => {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page).toHaveTitle('Dashboard | Afaq Al Manzel');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dashboard',
      exact: true,
    }),
  ).toBeVisible();

  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 241, 234)');

  await expect(page.getByText('Demo employee', { exact: true })).toHaveCount(0);

  await expect(page.getByRole('link', { name: 'Design system', exact: true })).toHaveCount(0);

  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );

  expect(fits).toBe(true);
  expect(errors).toEqual([]);
});

test('unknown address returns a not-found response', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');

  expect(response?.status()).toBe(404);

  await expect(page.getByText('This page could not be found.', { exact: true })).toBeVisible();
});

test('unknown module subsection returns a not-found response', async ({ page }) => {
  const response = await page.goto('/leads/this-section-does-not-exist');

  expect(response?.status()).toBe(404);
});

test('design-system preview remains unavailable in production', async ({ page }) => {
  const response = await page.goto('/dev/design-system');

  expect(response?.status()).toBe(404);
});
