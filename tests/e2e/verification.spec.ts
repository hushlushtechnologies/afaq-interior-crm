import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
  trace: 'off',
});

test('login links to email verification', async ({ page }) => {
  await page.goto('/login');

  await page
    .getByRole('link', {
      name: 'Verify email',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/verify-email$/);

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Verify your email',
      exact: true,
    }),
  ).toBeVisible();
});

test('verification request validates the email', async ({ page }) => {
  await page.goto('/verify-email');

  const form = page.getByRole('form', {
    name: 'Request email verification',
    exact: true,
  });

  await form
    .getByRole('button', {
      name: 'Request verification email',
      exact: true,
    })
    .click();

  await expect(form.getByRole('alert')).toBeFocused();

  await expect(
    form.getByLabel('Employee email', {
      exact: true,
    }),
  ).toHaveAttribute('aria-invalid', 'true');
});

test('unknown email receives a neutral verification response', async ({ page }) => {
  await page.goto('/verify-email');

  const form = page.getByRole('form', {
    name: 'Request email verification',
    exact: true,
  });

  await form
    .getByLabel('Employee email', { exact: true })
    .fill(`not-created-${crypto.randomUUID()}@example.test`);

  await form
    .getByRole('button', {
      name: 'Request verification email',
      exact: true,
    })
    .click();

  await expect(form.getByRole('status')).toContainText(
    'If an eligible account needs email verification',
  );
});

test('verification code must contain six digits', async ({ page }) => {
  await page.goto('/verify-email');

  const form = page.getByRole('form', {
    name: 'Verify email code',
    exact: true,
  });

  await form.getByLabel('Email for code', { exact: true }).fill('sample@example.test');

  await form.getByLabel('Verification code', { exact: true }).fill('12');

  await form
    .getByRole('button', {
      name: 'Verify code',
      exact: true,
    })
    .click();

  await expect(form.getByRole('alert')).toContainText('Enter the 6-digit verification code.');

  await expect(
    form.getByLabel('Verification code', {
      exact: true,
    }),
  ).toHaveAttribute('aria-invalid', 'true');
});

test('invalid code does not create an authenticated session', async ({ page }) => {
  await page.goto('/verify-email');

  const form = page.getByRole('form', {
    name: 'Verify email code',
    exact: true,
  });

  await form
    .getByLabel('Email for code', { exact: true })
    .fill(`not-created-${crypto.randomUUID()}@example.test`);

  await form.getByLabel('Verification code', { exact: true }).fill('000000');

  await form
    .getByRole('button', {
      name: 'Verify code',
      exact: true,
    })
    .click();

  await expect(form.getByRole('alert')).toContainText('The code is invalid or expired.');

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('invalid email-verification link is handled', async ({ page }) => {
  await page.goto('/auth/confirm#token_hash=invalid-verification-token&type=email');

  await page
    .getByRole('button', {
      name: 'Continue',
      exact: true,
    })
    .click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'invalid, expired, or already used',
  );

  await expect(
    page.getByRole('link', {
      name: 'Request a new verification email',
      exact: true,
    }),
  ).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`verification page fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: 1000,
    });

    await page.goto('/verify-email');

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}

test('verification page has no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/verify-email');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
