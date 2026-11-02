import { expect, test as base } from '@playwright/test';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createLocalAuthFixtures, type LocalAuthFixtures } from '../helpers/local-auth-fixtures';

const test = base.extend<{
  localAuth: LocalAuthFixtures;
}>({
  localAuth: async ({ baseURL }, provide) => {
    if (!baseURL) {
      throw new Error('The local test baseURL is missing.');
    }

    const fixtures = createLocalAuthFixtures(baseURL);

    try {
      await provide(fixtures);
    } finally {
      await fixtures.cleanup();
    }
  },
});

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

test('a confirmed account without roles receives an access notice', async ({ page, localAuth }) => {
  const account = await localAuth.createAccount({
    role: null,
  });

  await signInLocalAccount(page, account);

  await expect(
    page.getByRole('heading', {
      name: 'Access not configured',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Sign out',
      exact: true,
    }),
  ).toBeVisible();
});

test('Sales can open Leads but cannot open Finance', async ({ page, localAuth }) => {
  const account = await localAuth.createAccount({
    role: 'sales_executive',
  });

  await signInLocalAccount(page, account);
  await page.goto('/leads');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Leads',
      exact: true,
    }),
  ).toBeVisible();

  await page.goto('/finance');

  await expect(
    page.getByRole('heading', {
      name: 'Access not available',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Finance',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('Designer cannot open Finance by entering its URL', async ({ page, localAuth }) => {
  const account = await localAuth.createAccount({
    role: 'interior_designer',
  });

  await signInLocalAccount(page, account);
  await page.goto('/design');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Design',
      exact: true,
    }),
  ).toBeVisible();

  await page.goto('/finance');

  await expect(
    page.getByRole('heading', {
      name: 'Access not available',
      exact: true,
    }),
  ).toBeVisible();
});

test('PM retains permitted financial workspace access', async ({ page, localAuth }) => {
  const account = await localAuth.createAccount({
    role: 'project_manager',
  });

  await signInLocalAccount(page, account);
  await page.goto('/finance');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Finance',
      exact: true,
    }),
  ).toBeVisible();
});
