import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createLocalAuthFixtures } from './helpers/local-auth-fixtures';
import { chromium, expect, type FullConfig } from '@playwright/test';
import {
  getAuthStatePath,
  getAuthTestCredentials,
  loadAuthTestEnvironment,
} from './helpers/auth-environment';

export default async function setup(config: FullConfig) {
  loadAuthTestEnvironment();

  const baseURL = config.projects[0]?.use.baseURL;

  if (!baseURL) {
    throw new Error('The test baseURL is missing.');
  }

  // Validate the isolated API/project before launching a browser or signing in.
  createLocalAuthFixtures(baseURL);

  const statePath = getAuthStatePath(baseURL);
  const credentials = getAuthTestCredentials();

  await mkdir(dirname(statePath), {
    recursive: true,
  });

  const browser = await chromium.launch();

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseURL}/login`);

    await page.getByLabel('Employee email', { exact: true }).fill(credentials.email);

    await page.getByLabel('Password', { exact: true }).fill(credentials.password);

    await page
      .getByRole('button', {
        name: 'Sign in',
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(`${baseURL}/dashboard`, { timeout: 30_000 });

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Dashboard',
        exact: true,
      }),
    ).toBeVisible();

    await context.storageState({
      path: statePath,
    });
  } finally {
    await browser.close();
  }
}