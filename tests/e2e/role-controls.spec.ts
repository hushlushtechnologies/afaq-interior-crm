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

test.setTimeout(90_000);

test('Super Admin can assign and remove an existing account role', async ({ page, localAuth }) => {
  const actor = await localAuth.createAccount({
    role: 'super_admin',
  });

  const target = await localAuth.createAccount({
    role: 'sales_executive',
  });

  await signInLocalAccount(page, actor);
  await page.goto('/settings/access');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Role access',
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel('Employee email', { exact: true }).fill(target.email);

  await page
    .getByRole('button', {
      name: 'Find account',
      exact: true,
    })
    .click();

  const finance = page.getByRole('checkbox', {
    name: 'Finance Officer',
    exact: true,
  });

  await expect(finance).not.toBeChecked();
  await finance.check();

  const assignDialog = page.getByRole('dialog', {
    name: 'Assign Finance Officer?',
    exact: true,
  });

  await expect(
    assignDialog.getByRole('button', {
      name: 'Cancel',
      exact: true,
    }),
  ).toBeFocused();

  await assignDialog
    .getByRole('button', {
      name: 'Assign role',
      exact: true,
    })
    .click();

  await expect(assignDialog).toHaveCount(0);
  await expect(finance).toBeChecked();

  await finance.uncheck();

  const removeDialog = page.getByRole('dialog', {
    name: 'Remove Finance Officer?',
    exact: true,
  });

  await removeDialog
    .getByRole('button', {
      name: 'Remove role',
      exact: true,
    })
    .click();

  await expect(removeDialog).toHaveCount(0);
  await expect(finance).not.toBeChecked();

  await expect(
    page.getByRole('checkbox', {
      name: 'Sales Executive',
      exact: true,
    }),
  ).toBeChecked();
});

test('Sales navigation excludes Finance and role administration', async ({ page, localAuth }) => {
  const account = await localAuth.createAccount({
    role: 'sales_executive',
  });

  await signInLocalAccount(page, account);

  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page
      .getByRole('button', {
        name: 'Open navigation',
        exact: true,
      })
      .click();

    const drawer = page.getByRole('dialog', {
      name: 'Workspace navigation',
      exact: true,
    });

    const modules = drawer.getByRole('navigation', {
      name: 'Modules in drawer',
      exact: true,
    });

    await expect(
      modules.getByRole('link', {
        name: 'Leads',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      modules.getByRole('link', {
        name: 'Finance',
        exact: true,
      }),
    ).toHaveCount(0);

    await page.keyboard.press('Escape');
  } else {
    const rail = page.getByRole('navigation', {
      name: 'Primary navigation',
      exact: true,
    });

    await expect(
      rail.getByRole('link', {
        name: 'Leads',
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      rail.getByRole('link', {
        name: 'Finance',
        exact: true,
      }),
    ).toHaveCount(0);
  }

  await page
    .getByRole('button', {
      name: 'Search navigation',
      exact: true,
    })
    .click();

  const search = page.getByRole('dialog', {
    name: 'Search navigation',
    exact: true,
  });

  await search.getByLabel('Find a page', { exact: true }).fill('Finance');

  await expect(
    search.getByRole('link', {
      name: 'Finance — Finance',
      exact: true,
    }),
  ).toHaveCount(0);

  await page.keyboard.press('Escape');

  await page.goto('/settings/access');

  await expect(
    page.getByRole('heading', {
      name: 'Access not available',
      exact: true,
    }),
  ).toBeVisible();

  await expect(
    page.getByRole('form', {
      name: 'Find role account',
      exact: true,
    }),
  ).toHaveCount(0);
});
