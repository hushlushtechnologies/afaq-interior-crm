import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { getAuthTestCredentials } from '../helpers/auth-environment';

for (const width of [375, 600, 768, 900, 1024, 1440]) {
  test(`workspace shell fits at ${width}px`, async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.setViewportSize({
      width,
      height: 1000,
    });

    await page.goto('/dashboard');

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Dashboard',
        exact: true,
      }),
    ).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);

    const rail = page.getByRole('navigation', {
      name: 'Primary navigation',
      exact: true,
    });

    if (width >= 768) {
      await expect(rail).toBeVisible();
    } else {
      await expect(rail).not.toBeVisible();
    }

    const sidebar = page.locator('#secondary-navigation');

    if (width >= 1024) {
      await expect(sidebar).toBeVisible();
    } else {
      await expect(sidebar).not.toBeVisible();
    }

    expect(errors).toEqual([]);
  });
}

test('desktop navigation, breadcrumbs, and sidebar controls work', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Search navigation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search navigation', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search navigation', exact: true })).toHaveCount(0);

  const rail = page.getByRole('navigation', {
    name: 'Primary navigation',
    exact: true,
  });

  const leads = rail.getByRole('link', {
    name: 'Leads',
    exact: true,
  });

  await leads.hover();

  await expect(
    page.getByRole('tooltip', {
      name: 'Leads',
      exact: true,
    }),
  ).toBeVisible();

  await leads.click();

  const sidebar = page.locator('#secondary-navigation');

  await sidebar
    .getByRole('link', {
      name: 'Follow-ups',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/leads\/follow-ups$/);

  await expect(
    page.getByRole('navigation', {
      name: 'Breadcrumb',
      exact: true,
    }),
  ).toContainText('Follow-ups');

  await page.getByRole('button', { name: /collapse/i }).click();

  await expect(sidebar).toHaveAttribute('aria-hidden', 'true');

  await expect(sidebar).toHaveAttribute('inert', '');

  await page.getByRole('button', { name: /expand/i }).click();

  await expect(sidebar).toBeVisible();
});

test('mobile navigation traps focus and restores its trigger', async ({ page }) => {
  await page.setViewportSize({
    width: 375,
    height: 900,
  });

  await page.goto('/dashboard');

  const trigger = page.getByRole('button', {
    name: 'Open navigation',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Workspace navigation',
    exact: true,
  });

  await expect(dialog).toBeVisible();

  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press('Tab');

    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
  }

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();

  await dialog
    .getByRole('link', {
      name: 'Inventory',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/inventory$/);
  await expect(dialog).toHaveCount(0);
});

test('tablet drawer closes when resized to desktop', async ({ page }) => {
  await page.setViewportSize({
    width: 900,
    height: 1000,
  });

  await page.goto('/dashboard');

  await page
    .getByRole('button', {
      name: 'Open navigation',
      exact: true,
    })
    .click();

  const dialog = page.getByRole('dialog', {
    name: 'Workspace navigation',
    exact: true,
  });

  await expect(dialog).toBeVisible();

  await page.setViewportSize({
    width: 1280,
    height: 1000,
  });

  await expect(dialog).toHaveCount(0);
});

test('navigation search works with the keyboard shortcut', async ({ page }) => {
  await page.goto('/dashboard');
  // A successful interaction establishes hydration before a window keyboard event.
  await page.getByRole('button', { name: 'Search navigation', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search navigation', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Search navigation', exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+k');

  const dialog = page.getByRole('dialog', {
    name: 'Search navigation',
    exact: true,
  });

  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Find a page', { exact: true }).fill('Procurement');

  await dialog
    .getByRole('link', {
      name: 'Procurement — Procurement',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/procurement$/);
});

test('profile displays the authenticated email and menus navigate', async ({ page }) => {
  const credentials = getAuthTestCredentials();

  await page.goto('/dashboard');

  await page
    .getByRole('button', {
      name: 'Open profile menu',
      exact: true,
    })
    .click();

  const profile = page.getByRole('menu');

  await expect(profile).toContainText(credentials.email);

  await expect(profile).not.toContainText('Development-only preview');

  await profile
    .getByRole('menuitem', {
      name: 'Profile',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/settings\/profile$/);

  await page
    .getByRole('button', {
      name: 'Open notifications',
      exact: true,
    })
    .click();

  const notifications = page.getByRole('menu');

  await expect(notifications).toContainText('No live notifications are connected.');

  await notifications
    .getByRole('menuitem', {
      name: 'Notification settings',
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/settings\/notifications$/);
});

test('workspace details restores focus after closing', async ({ page }) => {
  await page.goto('/projects');

  const trigger = page.getByRole('button', {
    name: 'Workspace details',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Workspace details',
    exact: true,
  });

  await expect(
    dialog.getByText('UI placeholder', {
      exact: true,
    }),
  ).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('mobile drawer respects reduced motion', async ({ page }) => {
  await page.emulateMedia({
    reducedMotion: 'reduce',
  });

  await page.setViewportSize({
    width: 375,
    height: 900,
  });

  await page.goto('/dashboard');

  await page
    .getByRole('button', {
      name: 'Open navigation',
      exact: true,
    })
    .click();

  const dialog = page.getByRole('dialog', {
    name: 'Workspace navigation',
    exact: true,
  });

  await expect(dialog).toBeVisible();

  const animationName = await dialog.evaluate((element) => getComputedStyle(element).animationName);

  expect(animationName).toBe('none');
});

test('authenticated dashboard has no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dashboard',
      exact: true,
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('mobile navigation has no detected WCAG A or AA violations', async ({ page }) => {
  await page.setViewportSize({
    width: 375,
    height: 900,
  });

  await page.goto('/dashboard');

  await page
    .getByRole('button', {
      name: 'Open navigation',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('dialog', {
      name: 'Workspace navigation',
      exact: true,
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
