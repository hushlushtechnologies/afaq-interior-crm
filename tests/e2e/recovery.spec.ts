import { expect, test } from '@playwright/test';

test.use({
  trace: 'off',
});

test.describe('public password recovery', () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  test('login links to password recovery', async ({ page }) => {
    await page.goto('/login');

    await page
      .getByRole('link', {
        name: 'Forgot password?',
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(/\/forgot-password$/);

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Password recovery',
        exact: true,
      }),
    ).toBeVisible();
  });

  test('empty recovery request focuses its error summary', async ({ page }) => {
    await page.goto('/forgot-password');

    await page
      .getByRole('button', {
        name: 'Request reset link',
        exact: true,
      })
      .click();

    await expect(page.getByRole('main').getByRole('alert')).toBeFocused();

    await expect(
      page.getByLabel('Employee email', {
        exact: true,
      }),
    ).toHaveAttribute('aria-invalid', 'true');
  });

  test('unknown account receives a neutral request response', async ({ page }) => {
    await page.goto('/forgot-password');

    await page
      .getByLabel('Employee email', { exact: true })
      .fill(`not-created-${crypto.randomUUID()}@example.test`);

    await page
      .getByRole('button', {
        name: 'Request reset link',
        exact: true,
      })
      .click();

    await expect(page.getByRole('status')).toContainText(
      'If an eligible account uses that email address',
    );
  });

  test('anonymous password update requires a recovery session', async ({ page }) => {
    await page.goto('/auth/update-password');

    await expect(
      page.getByRole('heading', {
        name: 'Reset link required',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByLabel('New password', {
        exact: true,
      }),
    ).toHaveCount(0);
  });

  test('opening a link does not consume it automatically', async ({ page }) => {
    await page.goto('/auth/confirm#token_hash=invalid-token-for-preview&type=recovery');

    await expect(
      page.getByRole('button', {
        name: 'Continue',
        exact: true,
      }),
    ).toBeVisible();

    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });

  test('invalid recovery token is handled without signing in', async ({ page }) => {
    await page.goto('/auth/confirm#token_hash=invalid-token-for-preview&type=recovery');

    await page
      .getByRole('button', {
        name: 'Continue',
        exact: true,
      })
      .click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'invalid, expired, or already used',
    );

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('missing email token is handled', async ({ page }) => {
    await page.goto('/auth/confirm');

    await page
      .getByRole('button', {
        name: 'Continue',
        exact: true,
      })
      .click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText('invalid or incomplete');
  });
});

test.describe('authenticated password validation', () => {
  test('new password confirmation must match', async ({ page }) => {
    await page.goto('/auth/update-password');

    await page.getByLabel('New password', { exact: true }).fill('Example-Password-Only1!');

    await page
      .getByLabel('Confirm new password', {
        exact: true,
      })
      .fill('Different-Example-Only2!');

    await page
      .getByRole('button', {
        name: 'Update password',
        exact: true,
      })
      .click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Passwords do not match.',
    );
  });
});
