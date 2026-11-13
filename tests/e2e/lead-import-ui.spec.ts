import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createImportFixtures } from '../helpers/import-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';

test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(120000);
const origin = 'http://127.0.0.1:3100';

async function choose(page: Page, text: string, manualName = false) {
  await expect(page.getByLabel('CSV file', { exact: true })).toBeEnabled();
  await page.getByLabel('CSV file', { exact: true }).setInputFiles({
    name: 'fixture.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(text),
  });
  await expect(page.getByRole('button', { name: 'Preview CSV', exact: true })).toBeEnabled();
  if (manualName) await page.getByLabel('Map Customer name', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Preview CSV', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local preview', exact: true })).toBeVisible();
}

async function stage(page: Page) {
  await page.getByRole('button', { name: 'Stage for review', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved import batch', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload batch', exact: true })).toBeEnabled();
}

async function confirm(page: Page) {
  await page.getByRole('button', { name: 'Review confirmation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm CSV import', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm import', exact: true }).click();
}

test('CSV mapping, validation, explicit skips and confirmation reuse the protected workflow', async ({
  page,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    await signInLocalAccount(page, await fixtures.account());
    await page.goto('/leads/imports');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Import CSV', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('CSV file', { exact: true })).toBeEnabled();
    await page.getByLabel('CSV file', { exact: true }).setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name\n"unclosed'),
    });
    await expect(
      page.getByRole('region', { name: 'Choose and map CSV', exact: true }).getByRole('alert'),
    ).toContainText('not closed');

    const duplicate = `${randomUUID()}@example.test`;
    await choose(
      page,
      `Name,Email\nValid fixture,${randomUUID()}@example.test\nX,broken\nSame one,${duplicate}\nSame two,${duplicate}`,
      true,
    );
    await expect(page.getByRole('region', { name: 'Local preview', exact: true })).toContainText(
      'Total 4 · Ready 1 · Invalid 1 · Review 2',
    );
    await expect(page.getByLabel('Map Customer name', { exact: true })).toHaveValue('0');
    await stage(page);
    await expect(
      page.getByRole('button', { name: 'Review confirmation', exact: true }),
    ).toBeDisabled();
    for (const row of [3, 4, 5]) await page.getByLabel(`Skip row ${row}`, { exact: true }).check();

    await expect(
      page.getByRole('button', { name: 'Review confirmation', exact: true }),
    ).toBeEnabled();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#workspace-content')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);

    await confirm(page);
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('Import completed: 1 lead created, 3 rows skipped.');
    await expect(page.getByRole('link', { name: 'Open created lead', exact: true })).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Review confirmation', exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Reload batch', exact: true })).toBeEnabled();
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('Applied 1 · Skipped 3');
  } finally {
    await fixtures.cleanup();
  }
});

test('lost staging and confirmation responses preserve request IDs and freeze mutable controls', async ({
  page,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    await signInLocalAccount(page, await fixtures.account());
    await page.goto('/leads/imports');
    const uploads: string[] = [];
    const confirmations: string[] = [];

    await page.route('**/api/leads/imports**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        uploads.push(JSON.parse(decodeURIComponent(request.headers()['x-lead-import'])).requestId);
        if (uploads.length === 1) {
          await route.fetch();
          await route.abort('failed');
          return;
        }
      }
      if (request.method() === 'PATCH') {
        confirmations.push(request.postDataJSON().requestId);
        if (confirmations.length === 1) {
          await route.fetch();
          await route.abort('failed');
          return;
        }
      }
      await route.continue();
    });

    await choose(page, `customer_name,email\nRetry fixture,${randomUUID()}@example.test`);
    await page.getByRole('button', { name: 'Stage for review', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Retry same upload', exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel('CSV file', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Map Customer name', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Retry same upload', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reload batch', exact: true })).toBeEnabled();
    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toBe(uploads[1]);

    await confirm(page);
    const dialog = page.getByRole('dialog', { name: 'Confirm CSV import', exact: true });
    await expect(
      dialog.getByRole('button', { name: 'Retry same confirmation', exact: true }),
    ).toBeEnabled();
    await expect(
      dialog.getByRole('button', { name: 'Cancel import confirmation', exact: true }),
    ).toBeDisabled();
    await dialog.getByRole('button', { name: 'Retry same confirmation', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('Applied 1 · Skipped 0');
    expect(confirmations).toHaveLength(2);
    expect(confirmations[0]).toBe(confirmations[1]);
    await expect(page.getByRole('link', { name: 'Open created lead', exact: true })).toHaveCount(1);
  } finally {
    await fixtures.cleanup();
  }
});

test('explicit skip selections survive pagination and confirmation imports only remaining rows', async ({
  page,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    await signInLocalAccount(page, await fixtures.account());
    await page.goto('/leads/imports');
    const rows = Array.from(
      { length: 22 },
      (_, index) =>
        `${index === 0 || index === 21 ? 'X' : `Paged fixture ${index}`},${randomUUID()}@example.test`,
    );
    await choose(page, `customer_name,email\n${rows.join('\n')}`);
    await stage(page);
    await page.getByLabel('Skip row 2', { exact: true }).check();
    await page.getByRole('button', { name: 'Next batch page', exact: true }).click();
    await expect(page.getByLabel('Skip row 23', { exact: true })).toBeEnabled();
    await page.getByLabel('Skip row 23', { exact: true }).check();
    await page.getByRole('button', { name: 'Previous batch page', exact: true }).click();
    await expect(page.getByLabel('Skip row 2', { exact: true })).toBeChecked();
    await confirm(page);
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('Import completed: 20 leads created, 2 rows skipped.');
  } finally {
    await fixtures.cleanup();
  }
});

test('a new database duplicate sends the UI back to review without creating another lead', async ({
  page,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    const account = await fixtures.account();
    await signInLocalAccount(page, account);
    await page.goto('/leads/imports');
    const email = `${randomUUID()}@example.test`;
    await choose(page, `customer_name,email\nLate fixture,${email}`);
    await stage(page);

    const client = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect((await client.auth.signInWithPassword(account)).error).toBeNull();
    expect(
      (
        await client.rpc('crm_save_lead', {
          p_request_id: randomUUID(),
          p_command: 'create',
          p_lead_id: null,
          p_version: null,
          p_data: {
            customer_name: 'Existing late fixture',
            email,
            assigned_user_id: account.id,
            source_code: 'manual',
            priority: 'normal',
            inquiry_on: '2026-11-12',
          },
        })
      ).error,
    ).toBeNull();

    await confirm(page);
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('New duplicate found. No leads were created.');
    await expect(page.getByLabel('Skip row 2', { exact: true })).toBeEnabled();
    await page.getByLabel('Skip row 2', { exact: true }).check();
    await confirm(page);
    await expect(
      page.getByRole('region', { name: 'Saved import batch', exact: true }),
    ).toContainText('Import completed: 0 leads created, 1 row skipped.');
    await client.auth.signOut();
  } finally {
    await fixtures.cleanup();
  }
});

test('read-only roles cannot open import UI; Sales assignment and saved-batch privacy remain enforced', async ({
  page,
  browser,
}) => {
  const fixtures = createImportFixtures(origin);
  const otherContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    baseURL: origin,
  });
  try {
    const sales = await fixtures.account('sales_executive');
    await signInLocalAccount(page, sales);
    await page.goto('/leads/imports');
    await expect(page.getByLabel('Assigned employee', { exact: true })).toBeDisabled();
    await expect(page.getByLabel('Assigned employee', { exact: true })).toHaveValue(sales.id);
    await choose(page, `customer_name,email\nPrivate batch fixture,${randomUUID()}@example.test`);
    await stage(page);
    const batchId = new URL(page.url()).searchParams.get('batchId')!;

    const other = await otherContext.newPage();
    await signInLocalAccount(other, await fixtures.account('management_director'));
    await other.goto('/leads/imports');
    await expect(
      other.getByRole('heading', { name: 'Access not available', exact: true }),
    ).toBeVisible();
    await expect(other.getByRole('link', { name: 'Import CSV', exact: true })).toHaveCount(0);
    await otherContext.close();

    const adminContext = await browser.newContext({
      storageState: { cookies: [], origins: [] },
      baseURL: origin,
    });
    try {
      const admin = await adminContext.newPage();
      await signInLocalAccount(admin, await fixtures.account());
      await admin.goto('/leads/imports');
      await admin.getByLabel('Saved batch ID', { exact: true }).fill(batchId);
      await admin.getByRole('button', { name: 'Open saved batch', exact: true }).click();
      await expect(
        admin.getByRole('region', { name: 'Saved import batch', exact: true }).getByRole('alert'),
      ).toContainText('Import access could not be verified');
      await expect(admin.getByText('Private batch fixture', { exact: true })).toHaveCount(0);
    } finally {
      await adminContext.close();
    }
  } finally {
    if (otherContext.pages().length) await otherContext.close();
    await fixtures.cleanup();
  }
});
