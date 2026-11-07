import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';
import {
  createLeadFixtures,
  type LeadFixtures,
  type LocalTestAccount,
} from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
const test = base.extend<{ leads: LeadFixtures }>({
  leads: async ({ baseURL }, provide) => {
    const fixtures = createLeadFixtures(baseURL!);
    try {
      await provide(fixtures);
    } finally {
      await fixtures.cleanup();
    }
  },
});
test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(120_000);
async function api(account: LocalTestAccount) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect(Boolean((await client.auth.signInWithPassword(account)).error)).toBe(false);
  return client;
}
async function seed(
  client: Awaited<ReturnType<typeof api>>,
  owner: string | null,
  name: string,
  extra = {},
) {
  const result = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: name,
      assigned_user_id: owner,
      source_code: 'manual',
      priority: 'normal',
      inquiry_on: '2026-11-05',
      ...extra,
    },
  });
  expect(Boolean(result.error)).toBe(false);
  return result.data.lead;
}
async function apply(page: Page) {
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply filters', exact: true })).toBeEnabled();
}
test('server filters, sorting, pagination and counts preserve authorized visibility', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const other = await leads.account('sales_executive');
  const own = await api(actor);
  const foreign = await api(other);
  for (let i = 1; i <= 21; i++)
    await seed(own, actor.id, `Table Fixture ${String(i).padStart(2, '0')}`, {
      source_code: i <= 10 ? 'phone' : 'manual',
      priority: i === 21 ? 'urgent' : 'normal',
      inquiry_on: i <= 10 ? '2026-11-01' : '2026-11-05',
      budget: String(i),
    });
  await seed(foreign, other.id, 'Hidden only fixture');
  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 20 of 21 visible leads',
  );
  await page.getByLabel('Lead rows per page', { exact: true }).selectOption('10');
  await page.getByLabel('Sort leads by', { exact: true }).selectOption('customer_name');
  await page.getByLabel('Sort direction', { exact: true }).selectOption('asc');
  await apply(page);
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText(
    'Table Fixture 01',
  );
  await page.getByRole('button', { name: 'Next leads page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 2:' })).toHaveText(
    'Page 2: 10 of 21 visible leads',
  );
  await page.getByRole('button', { name: 'Sort by Budget', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 10 of 21 visible leads',
  );
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText(
    'Table Fixture 01',
  );
  await page.getByRole('button', { name: 'Sort by Budget', exact: true }).click();
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText(
    'Table Fixture 21',
  );
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByTestId('stage-new')).toContainText('21');
  await expect(page.getByTestId('stage-new').locator('[data-testid^="lead-card-"]')).toHaveCount(
    10,
  );
  await page.getByLabel('Source filter', { exact: true }).selectOption('phone');
  await page.getByLabel('Inquiry from', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Inquiry to', { exact: true }).fill('2026-11-01');
  await apply(page);
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 10 of 10 visible leads',
  );
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.getByLabel('Source filter', { exact: true })).toHaveValue('phone');
  await page.getByRole('button', { name: 'Clear lead filters', exact: true }).click();
  await page.getByLabel('Search leads', { exact: true }).fill('Hidden only fixture');
  await apply(page);
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 0 of 0 visible leads',
  );
  await expect(page.getByRole('region', { name: 'Bulk lead assignment', exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel('Search leads', { exact: true }).fill('%');
  await apply(page);
  await expect(
    page.getByRole('heading', { name: 'No leads on this page', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear lead filters', exact: true }).click();
  await page.getByLabel('Owner filter', { exact: true }).selectOption(actor.id);
  await apply(page);
  await page.getByRole('button', { name: 'Show archived leads', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 0 of 0 visible leads',
  );
  await expect(page.getByLabel('Owner filter', { exact: true })).toHaveValue(actor.id);
  await page.getByRole('button', { name: 'Show active leads', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 20 of 21 visible leads',
  );
  expect(
    (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
});
test('bulk UI rejects a stale selected lead atomically, then assigns the refreshed selection', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const owner = await leads.account('sales_executive');
  const client = await api(actor);
  const prefix = `Bulk ${randomUUID()}`;
  const first = await seed(client, actor.id, `${prefix} A`);
  const second = await seed(client, actor.id, `${prefix} B`);
  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page.getByLabel('Search leads', { exact: true }).fill(prefix);
  await apply(page);
  await page.getByLabel('Select all eligible leads on this page', { exact: true }).check();
  await page.getByLabel('Bulk assignment owner', { exact: true }).selectOption(owner.id);
  // Simulate another session changing one version after selection.
  const moved = await client.rpc('crm_transition_lead', {
    p_request_id: randomUUID(),
    p_lead_id: second.id,
    p_version: 1,
    p_command: 'move',
    p_data: { stage: 'contacted' },
  });
  expect(Boolean(moved.error)).toBe(false);
  await page.getByRole('button', { name: 'Assign selected leads', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm bulk assignment', exact: true });
  await dialog.getByRole('button', { name: 'Confirm assignment', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Nothing in this batch was assigned');
  const unchanged = await client.rpc('crm_lead_page', {
    p_page: 0,
    p_archived: false,
    p_id: first.id,
  });
  expect(unchanged.data.rows[0].assigned_user_id).toBe(actor.id);
  expect(unchanged.data.rows[0].version).toBe(1);
  await dialog.getByRole('button', { name: 'Cancel bulk assignment', exact: true }).click();
  await page.getByRole('button', { name: 'Reload leads', exact: true }).click();
  await expect(page.getByLabel('Search leads', { exact: true })).toBeEnabled();
  await page.getByLabel('Select all eligible leads on this page', { exact: true }).check();
  await page.getByRole('button', { name: 'Assign selected leads', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm assignment', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Bulk assignment recorded.' }),
  ).toContainText('2 of 2');
  const detail = await client.rpc('crm_lead_page', {
    p_page: 0,
    p_archived: false,
    p_id: first.id,
  });
  expect(detail.data.rows[0].assigned_user_id).toBe(owner.id);
  await expect(
    page.getByLabel('Select all eligible leads on this page', { exact: true }),
  ).not.toBeChecked();
});
test('an uncertain bulk response locks the selection and retries the same request', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const owner = await leads.account('sales_executive');
  const client = await api(actor);
  const name = `Bulk retry ${randomUUID()}`;
  const row = await seed(client, actor.id, name);
  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page.getByLabel('Search leads', { exact: true }).fill(name);
  await apply(page);
  await page.getByLabel(`Select ${name}`, { exact: true }).check();
  await page.getByLabel('Bulk assignment owner', { exact: true }).selectOption(owner.id);
  await page.getByRole('button', { name: 'Assign selected leads', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm bulk assignment', exact: true });
  const ids: string[] = [];
  await page.route('**/leads', async (route) => {
    const request = route.request();
    const id = (request.postData() ?? '').match(/"requestId":"([0-9a-f-]+)"/i)?.[1];
    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id)
      return route.continue();
    ids.push(id);
    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Confirm assignment', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(page.getByLabel('Search leads', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Cancel bulk assignment', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry same bulk request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const detail = await client.rpc('crm_lead_page', { p_page: 0, p_archived: false, p_id: row.id });
  expect(detail.data.rows[0].version).toBe(2);
  expect(
    detail.data.events.filter((event: { action: string }) => event.action === 'assigned'),
  ).toHaveLength(1);
});
test('concurrent bulk assignments permit one version and reject the stale competitor', async ({
  leads,
}) => {
  const actor = await leads.account();
  const a = await leads.account('sales_executive');
  const b = await leads.account('sales_executive');
  const client = await api(actor);
  const first = await seed(client, actor.id, 'Concurrent bulk A');
  const second = await seed(client, actor.id, 'Concurrent bulk B');
  const rows = [
    { id: first.id, version: 1 },
    { id: second.id, version: 1 },
  ];
  const results = await Promise.all(
    [a.id, b.id].map((owner) =>
      client.rpc('crm_bulk_assign_leads', {
        p_request_id: randomUUID(),
        p_rows: rows,
        p_owner: owner,
      }),
    ),
  );
  expect(results.filter((result) => !result.error)).toHaveLength(1);
  expect(results.filter((result) => result.error?.code === '40001')).toHaveLength(1);
  const one = await client.rpc('crm_lead_page', { p_page: 0, p_archived: false, p_id: first.id });
  const two = await client.rpc('crm_lead_page', { p_page: 0, p_archived: false, p_id: second.id });
  expect(one.data.rows[0].assigned_user_id).toBe(two.data.rows[0].assigned_user_id);
  expect(one.data.rows[0].version).toBe(2);
  expect(two.data.rows[0].version).toBe(2);
});
