import { expect, test as base } from '@playwright/test';
import { SUPABASE_AUTH_COOKIE_NAME } from '../../src/lib/supabase/cookie-options';
import {
  fillPrivateInput,
  openEmailConfirmation,
  signInLocalAccount,
} from '../helpers/auth-browser';
import {
  createLocalAuthFixtures,
  createTestPassword,
  type LocalAuthFixtures,
} from '../helpers/local-auth-fixtures';

import {
  readEmailLinkProof,
  readVerificationCode,
  waitForLocalAuthMail,
} from '../helpers/local-auth-mail';

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

test.setTimeout(90_000);

test('anonymous HTTP requests cannot open workspace routes', async ({ request, baseURL }) => {
  const paths = [
    '/',
    '/dashboard',
    '/leads',
    '/quotations',
    '/ai-studio',
    '/clients',
    '/projects',
    '/design',
    '/site',
    '/procurement',
    '/inventory',
    '/finance',
    '/reports',
    '/employees',
    '/settings',
    '/leads/details/demo-001',
    '/quotations/approvals',
    '/settings/profile',
  ];

  for (const path of paths) {
    const response = await request.get(path, {
      maxRedirects: 0,
    });

    expect(
      response.status() >= 300 && response.status() < 400,
      `Anonymous access to ${path} must redirect.`,
    ).toBe(true);

    const location = response.headers().location;

    expect(Boolean(location)).toBe(true);

    expect(new URL(location, baseURL).pathname).toBe('/login');

    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('a forged session cookie cannot authenticate a cached identity', async ({
  context,
  page,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error('The local test baseURL is missing.');
  }

  const fakeSession = {
    access_token: 'invalid-jwt',
    refresh_token: 'invalid-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: '00000000-0000-4000-8000-000000000000',
      email: 'forged@example.test',
      email_confirmed_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };

  const value = 'base64-' + Buffer.from(JSON.stringify(fakeSession)).toString('base64url');

  await context.addCookies([
    {
      name: SUPABASE_AUTH_COOKIE_NAME,
      value,
      url: baseURL,
      sameSite: 'Lax',
    },
  ]);

  await page.goto('/dashboard');

  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');

  await expect(
    page.getByRole('region', {
      name: 'Account session',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('public account registration is disabled', async ({ localAuth }) => {
  const result = await localAuth.checkPublicSignup();

  expect(result.errorCode).toBe('signup_disabled');
  expect(result.returnedUser).toBe(false);
});

test('an unconfirmed email cannot open the workspace', async ({ localAuth, page }) => {
  const account = await localAuth.createAccount({
    confirmed: false,
  });

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

  await expect(
    page.getByRole('form', { name: 'Employee sign in', exact: true }).getByRole('alert'),
  ).toContainText('Check your email, password, and email verification.');

  await page.goto('/dashboard');

  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
});

test('two authenticated contexts retain separate identities', async ({
  localAuth,
  page,
  browser,
  baseURL,
}) => {
  const first = await localAuth.createAccount();
  const second = await localAuth.createAccount();

  const secondContext = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  try {
    const secondPage = await secondContext.newPage();

    await Promise.all([signInLocalAccount(page, first), signInLocalAccount(secondPage, second)]);

    await Promise.all([page.reload(), secondPage.reload()]);

    await expect(
      page.getByRole('region', {
        name: 'Account session',
        exact: true,
      }),
    ).toContainText(first.email);

    await expect(
      secondPage.getByRole('region', {
        name: 'Account session',
        exact: true,
      }),
    ).toContainText(second.email);

    await expect(page.locator('body')).not.toContainText(second.email);

    await expect(secondPage.locator('body')).not.toContainText(first.email);

    const response = await page.request.get('/dashboard');

    expect(response.status()).toBe(200);

    expect(response.headers()['cache-control']).toContain('private');

    expect(response.headers()['cache-control']).toContain('no-store');

    const cookies = await page.context().cookies();

    const authCookies = cookies.filter(
      (cookie) =>
        cookie.name === SUPABASE_AUTH_COOKIE_NAME ||
        cookie.name.startsWith(`${SUPABASE_AUTH_COOKIE_NAME}.`),
    );

    expect(authCookies.length).toBeGreaterThan(0);

    for (const cookie of authCookies) {
      expect(cookie.path).toBe('/');
      expect(cookie.sameSite).toBe('Lax');
    }
  } finally {
    await secondContext.close();
  }
});

test('a recovery email changes the password and rejects the old password', async ({
  localAuth,
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error('The local test baseURL is missing.');
  }

  const account = await localAuth.createAccount();

  await page.goto('/forgot-password');

  await page.getByLabel('Employee email', { exact: true }).fill(account.email);

  await page
    .getByRole('button', {
      name: 'Request reset link',
      exact: true,
    })
    .click();

  await expect(page.getByRole('status')).toContainText('If an eligible account');

  const mail = await waitForLocalAuthMail(account.email);

  const proof = readEmailLinkProof(mail, baseURL, 'recovery');

  await openEmailConfirmation(page, proof);

  await expect.poll(() => new URL(page.url()).pathname).toBe('/auth/update-password');

  const newPassword = createTestPassword();

  await fillPrivateInput(
    page.getByLabel('New password', {
      exact: true,
    }),
    newPassword,
    'new password',
  );

  await fillPrivateInput(
    page.getByLabel('Confirm new password', {
      exact: true,
    }),
    newPassword,
    'password confirmation',
  );

  await page
    .getByRole('button', {
      name: 'Update password',
      exact: true,
    })
    .click();

  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');

  await signInLocalAccount(page, {
    email: account.email,
    password: newPassword,
  });

  const oldPasswordContext = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  try {
    const oldPasswordPage = await oldPasswordContext.newPage();

    await oldPasswordPage.goto('/login');

    await fillPrivateInput(
      oldPasswordPage.getByLabel('Employee email', {
        exact: true,
      }),
      account.email,
      'employee email',
    );

    await fillPrivateInput(
      oldPasswordPage.getByLabel('Password', {
        exact: true,
      }),
      account.password,
      'old password',
    );

    await oldPasswordPage
      .getByRole('button', {
        name: 'Sign in',
        exact: true,
      })
      .click();

    await expect(
      oldPasswordPage
        .getByRole('form', { name: 'Employee sign in', exact: true })
        .getByRole('alert'),
    ).toContainText('Check your email, password, and email verification.');
  } finally {
    await oldPasswordContext.close();
  }
});

test('verification link confirms the account, ignores external next URLs, and is single-use', async ({
  localAuth,
  page,
  browser,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error('The local test baseURL is missing.');
  }

  const account = await localAuth.createAccount({
    confirmed: false,
  });

  await page.goto('/verify-email');

  const requestForm = page.getByRole('form', {
    name: 'Request email verification',
    exact: true,
  });

  await requestForm.getByLabel('Employee email', { exact: true }).fill(account.email);

  await requestForm
    .getByRole('button', {
      name: 'Request verification email',
      exact: true,
    })
    .click();

  await expect(requestForm.getByRole('status')).toContainText('If an eligible account');

  const mail = await waitForLocalAuthMail(account.email);

  const proof = readEmailLinkProof(mail, baseURL, 'email');

  await page.route('https://example.invalid/**', (route) => route.abort());

  await openEmailConfirmation(
    page,
    proof,
    `?next=${encodeURIComponent('https://example.invalid/')}`,
  );

  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');

  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);

  expect(await localAuth.isEmailConfirmed(account.id)).toBe(true);

  const retryContext = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  try {
    const retryPage = await retryContext.newPage();

    await openEmailConfirmation(retryPage, proof);

    await expect(
      retryPage.getByRole('form', { name: 'Confirm email link', exact: true }).getByRole('alert'),
    ).toContainText('invalid, expired, or already used');

    await retryPage.goto('/dashboard');

    await expect.poll(() => new URL(retryPage.url()).pathname).toBe('/login');
  } finally {
    await retryContext.close();
  }
});

test('verification code confirms the account and cannot be reused', async ({
  localAuth,
  page,
  browser,
  baseURL,
}) => {
  const account = await localAuth.createAccount({
    confirmed: false,
  });

  await page.goto('/verify-email');

  const requestForm = page.getByRole('form', {
    name: 'Request email verification',
    exact: true,
  });

  await requestForm.getByLabel('Employee email', { exact: true }).fill(account.email);

  await requestForm
    .getByRole('button', {
      name: 'Request verification email',
      exact: true,
    })
    .click();

  await expect(requestForm.getByRole('status')).toContainText('If an eligible account');

  const mail = await waitForLocalAuthMail(account.email);

  const code = readVerificationCode(mail);

  const codeForm = page.getByRole('form', {
    name: 'Verify email code',
    exact: true,
  });

  await codeForm.getByLabel('Email for code', { exact: true }).fill(account.email);

  await fillPrivateInput(
    codeForm.getByLabel('Verification code', {
      exact: true,
    }),
    code,
    'verification code',
  );

  await codeForm
    .getByRole('button', {
      name: 'Verify code',
      exact: true,
    })
    .click();

  await expect.poll(() => new URL(page.url()).pathname).toBe('/dashboard');

  expect(await localAuth.isEmailConfirmed(account.id)).toBe(true);

  const retryContext = await browser.newContext({
    baseURL,
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  try {
    const retryPage = await retryContext.newPage();

    await retryPage.goto('/verify-email');

    const retryForm = retryPage.getByRole('form', {
      name: 'Verify email code',
      exact: true,
    });

    await retryForm.getByLabel('Email for code', { exact: true }).fill(account.email);

    await fillPrivateInput(
      retryForm.getByLabel('Verification code', {
        exact: true,
      }),
      code,
      'verification code',
    );

    await retryForm
      .getByRole('button', {
        name: 'Verify code',
        exact: true,
      })
      .click();

    await expect(retryForm.getByRole('alert')).toContainText('The code is invalid or expired.');

    await retryPage.goto('/dashboard');

    await expect.poll(() => new URL(retryPage.url()).pathname).toBe('/login');
  } finally {
    await retryContext.close();
  }
});
