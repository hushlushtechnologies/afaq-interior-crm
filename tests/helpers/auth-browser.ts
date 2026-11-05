import { expect, type Locator, type Page } from '@playwright/test';
import type { EmailLinkProof } from './local-auth-mail';

export async function fillPrivateInput(locator: Locator, value: string, fieldName: string) {
  try {
    await locator.fill(value);
  } catch {
    throw new Error(`Could not fill the ${fieldName} field.`);
  }
}

export async function signInLocalAccount(
  page: Page,
  account: {
    email: string;
    password: string;
  },
) {
  await page.goto('/login');

  await fillPrivateInput(
    page.getByLabel('Employee email', {
      exact: true,
    }),
    account.email,
    'employee email',
  );

  await fillPrivateInput(
    page.getByLabel('Password', {
      exact: true,
    }),
    account.password,
    'password',
  );

  await page
    .getByRole('button', {
      name: 'Sign in',
      exact: true,
    })
    .click();

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
      message: 'The local test account did not reach Dashboard.',
    })
    .toBe('/dashboard');
}

export async function openEmailConfirmation(page: Page, proof: EmailLinkProof, query = '') {
  await page.goto(`/auth/confirm${query}`);
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();

  await page.evaluate((input) => {
    const fragment = new URLSearchParams({
      token_hash: input.tokenHash,
      type: input.type,
    });

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${fragment}`,
    );
  }, proof);

  await page
    .getByRole('button', {
      name: 'Continue',
      exact: true,
    })
    .click();
}
