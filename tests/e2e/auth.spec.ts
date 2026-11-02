import { expect, test } from '@playwright/test';
import { getAuthTestCredentials } from '../helpers/auth-environment';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
  trace: 'off',
});

async function signIn(page: import('@playwright/test').Page) {
  const credentials = getAuthTestCredentials();

  await page.goto('/login');

  await page.getByLabel('Employee email', { exact: true }).fill(credentials.email);

  await page.getByLabel('Password', { exact: true }).fill(credentials.password);

  await page
    .getByRole('button', {
      name: 'Sign in',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

test('authentication: anonymous workspace access redirects to login', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveURL(/\/login$/);

  await expect(
    page.getByRole('heading', {
      name: 'Employee sign in',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByText('Demonstration data', {
      exact: true,
    }),
  ).toHaveCount(0);
});

test('authentication: empty login shows field errors', async ({ page }) => {
  await page.goto('/login');

  await page
    .getByRole('button', {
      name: 'Sign in',
      exact: true,
    })
    .click();

  const summary = page.getByRole('alert');

  await expect(summary).toBeFocused();

  await expect(
    page.getByLabel('Employee email', {
      exact: true,
    }),
  ).toHaveAttribute('aria-invalid', 'true');

  await expect(
    page.getByLabel('Password', {
      exact: true,
    }),
  ).toHaveAttribute('aria-invalid', 'true');
});

test('authentication: incorrect credentials show a generic error', async ({ page }) => {
  const credentials = getAuthTestCredentials();

  await page.goto('/login');

  await page.getByLabel('Employee email', { exact: true }).fill(credentials.email);

  await page.getByLabel('Password', { exact: true }).fill(`incorrect-${credentials.password}`);

  await page
    .getByRole('button', {
      name: 'Sign in',
      exact: true,
    })
    .click();

  await expect(page.getByRole('alert')).toContainText(
    'Check your email, password, and email verification.',
  );

  await expect(page).toHaveURL(/\/login$/);
});

test('authentication: successful login survives reload', async ({ page }) => {
  const credentials = getAuthTestCredentials();

  await signIn(page);
  await page.reload();

  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(
    page.getByRole('region', {
      name: 'Account session',
      exact: true,
    }),
  ).toContainText(credentials.email);
});

test('authentication: logout blocks later workspace access', async ({ page }) => {
  await signIn(page);

  await page
    .getByRole('button', {
      name: 'Sign out',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login$/);
});
