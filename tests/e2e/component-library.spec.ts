import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function fillRequiredFields(page: Page) {
  await page.getByLabel('Sample client name', { exact: true }).fill('Example Client');

  await page.getByLabel('Sample email', { exact: true }).fill('sample@example.invalid');

  await page.getByLabel('Property type', { exact: true }).selectOption('villa');
}

test('validation focuses the error summary and links to fields', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Validate sample',
      exact: true,
    })
    .click();

  const summary = page
    .getByRole('form', { name: 'Sample inquiry form', exact: true })
    .getByRole('alert');

  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole('link')).toHaveCount(3);

  const nameInput = page.getByLabel('Sample client name', {
    exact: true,
  });

  await expect(nameInput).toHaveAttribute('aria-invalid', 'true');

  await summary
    .getByRole('link', {
      name: 'Enter a client name with at least 2 characters.',
      exact: true,
    })
    .click();

  await expect(nameInput).toBeFocused();
});

test('valid submission shows a local result and editing clears it', async ({ page }) => {
  await page.goto('/dev/component-library');
  await fillRequiredFields(page);

  await page.getByLabel('Indicative budget', { exact: true }).fill('120000.50');

  await page
    .getByLabel('Include a sample site visit', {
      exact: true,
    })
    .check();

  await page
    .getByRole('switch', {
      name: 'Show a follow-up reminder',
      exact: true,
    })
    .press('Space');
  await expect(
    page.getByRole('switch', { name: 'Show a follow-up reminder', exact: true }),
  ).toBeChecked();

  await page
    .getByRole('button', {
      name: 'Validate sample',
      exact: true,
    })
    .click();

  const result = page.getByRole('status');

  await expect(result).toBeFocused();
  await expect(result).toContainText('Sample validated locally');
  await expect(result).toContainText('AED 120,000.50');
  await expect(result).toContainText('Nothing was saved or sent.');

  await page.getByLabel('Sample client name', { exact: true }).fill('Changed Example');

  await expect(page.getByRole('status')).toHaveCount(0);
});

test('invalid budget is rejected and can be corrected', async ({ page }) => {
  await page.goto('/dev/component-library');
  await fillRequiredFields(page);

  const budget = page.getByLabel('Indicative budget', {
    exact: true,
  });

  await budget.fill('-1');

  await page
    .getByRole('button', {
      name: 'Validate sample',
      exact: true,
    })
    .click();

  await expect(budget).toHaveAttribute('aria-invalid', 'true');

  await expect(
    page.getByRole('form', { name: 'Sample inquiry form', exact: true }).getByRole('alert'),
  ).toContainText('Enter an AED amount with no more than 2 decimal places.');

  await budget.fill('1000.50');

  await page
    .getByRole('button', {
      name: 'Validate sample',
      exact: true,
    })
    .click();

  await expect(page.getByRole('status')).toContainText('AED 1,000.50');
});

test('radio buttons and switch support keyboard interaction', async ({ page }) => {
  await page.goto('/dev/component-library');

  const whatsapp = page.getByRole('radio', {
    name: 'WhatsApp',
    exact: true,
  });

  await whatsapp.focus();
  await page.keyboard.press('ArrowRight');

  await expect(
    page.getByRole('radio', {
      name: 'Email',
      exact: true,
    }),
  ).toBeChecked();

  const reminder = page.getByRole('switch', {
    name: 'Show a follow-up reminder',
    exact: true,
  });

  await reminder.focus();
  await page.keyboard.press('Space');
  await expect(reminder).toBeChecked();

  await page.keyboard.press('Space');
  await expect(reminder).not.toBeChecked();
});

test('password visibility toggles without submitting the example', async ({ page }) => {
  await page.goto('/dev/component-library');

  const password = page.getByLabel('Preview password', {
    exact: true,
  });

  await password.fill('Example value');

  await expect(password).toHaveAttribute('type', 'password');

  await page
    .getByRole('button', {
      name: 'Show password',
      exact: true,
    })
    .click();

  await expect(password).toHaveAttribute('type', 'text');

  await page
    .getByRole('button', {
      name: 'Hide password',
      exact: true,
    })
    .click();

  await expect(password).toHaveAttribute('type', 'password');

  await expect(
    page.getByRole('form', { name: 'Sample inquiry form', exact: true }).getByRole('alert'),
  ).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('reset restores default values and focuses the first field', async ({ page }) => {
  await page.goto('/dev/component-library');
  await fillRequiredFields(page);

  await page
    .getByLabel('Include a sample site visit', {
      exact: true,
    })
    .check();

  await page
    .getByRole('button', {
      name: 'Reset example',
      exact: true,
    })
    .click();

  const nameInput = page.getByLabel('Sample client name', {
    exact: true,
  });

  await expect(nameInput).toHaveValue('');
  await expect(nameInput).toBeFocused();

  await expect(page.getByLabel('Property type', { exact: true })).toHaveValue('');

  await expect(
    page.getByRole('radio', {
      name: 'WhatsApp',
      exact: true,
    }),
  ).toBeChecked();

  await expect(
    page.getByLabel('Include a sample site visit', {
      exact: true,
    }),
  ).not.toBeChecked();
});

test('disabled controls remain unavailable', async ({ page }) => {
  await page.goto('/dev/component-library');

  await expect(
    page.getByLabel('Disabled input example', {
      exact: true,
    }),
  ).toBeDisabled();

  await expect(
    page.getByLabel('Disabled checkbox example', {
      exact: true,
    }),
  ).toBeDisabled();

  await expect(
    page.getByRole('switch', {
      name: 'Disabled switch example',
      exact: true,
    }),
  ).toBeDisabled();
});

for (const width of [375, 768, 1440]) {
  test(`component library fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: 1000,
    });

    await page.goto('/dev/component-library');

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}

test('component library has no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/dev/component-library');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('validation errors have no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Validate sample',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('form', { name: 'Sample inquiry form', exact: true }).getByRole('alert'),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
