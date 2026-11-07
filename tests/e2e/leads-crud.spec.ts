import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
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

function fields(owner: string, name: string, email: string | null = null) {
  return {
    customer_name: name,
    assigned_user_id: owner,
    source_code: 'manual',
    priority: 'normal',
    inquiry_on: '2026-11-05',
    email,
  };
}

async function openNamedLead(page: Page, name: string) {
  // Company-scoped admins can see other concurrent local fixtures. Locate the
  // record through actual server pagination rather than assuming page one.
  for (let index = 0; index < 30; index++) {
    const status = page.getByRole('status').filter({ hasText: /^Page \d+:/ });
    await expect(status).toBeVisible();

    const target = page.getByRole('button', { name, exact: true });
    if (await target.count()) {
      await target.click();
      return;
    }

    const next = page.getByRole('button', { name: 'Next leads page', exact: true });
    if (await next.isDisabled()) break;

    const previous = await status.innerText();
    await next.click();
    await expect(status).not.toHaveText(previous);
  }

  throw new Error('The generated lead was not found in authorized server pages.');
}

test('create, retrieve, edit, assign and archive preserve history and accessible layouts', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const sales = await leads.account('sales_executive');

  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Create lead', exact: true });
  await dialog.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeFocused();

  const name = `UI Fixture ${randomUUID()}`;
  await dialog.getByLabel('Customer name', { exact: true }).fill(name);
  await dialog.getByLabel('Primary phone', { exact: true }).fill('+971501234567');
  await dialog.getByLabel('Estimated budget (AED)', { exact: true }).fill('100.50');
  await dialog
    .getByLabel('Initial internal note', { exact: true })
    .fill('Preserved initial evidence');

  await dialog.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await openNamedLead(page, name);

  const detail = page.getByRole('dialog', { name: 'Lead information', exact: true });
  await expect(detail.getByLabel('Lead source', { exact: true })).toBeDisabled();
  await expect(detail.getByLabel('Initial internal note', { exact: true })).toBeDisabled();

  await detail.getByLabel('Project location', { exact: true }).fill('Dubai synthetic location');
  await detail.getByRole('button', { name: 'Save lead changes', exact: true }).click();
  await expect(detail).toHaveCount(0);

  await openNamedLead(page, name);
  await detail.getByLabel('Assign employee', { exact: true }).selectOption(sales.id);
  await detail.getByRole('button', { name: 'Save assignment', exact: true }).click();
  await expect(detail).toHaveCount(0);

  await openNamedLead(page, name);
  await expect(detail).toContainText('assigned');
  await expect(detail.getByLabel('Project location', { exact: true })).toHaveValue(
    'Dubai synthetic location',
  );

  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(axe.violations).toEqual([]);

  await detail.getByRole('button', { name: 'Archive lead', exact: true }).click();

  const confirmation = page.getByRole('dialog', { name: 'Archive lead?', exact: true });
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();

  await confirmation.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(confirmation).toHaveCount(0);

  await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show archived leads', exact: true }).click();
  await openNamedLead(page, name);

  await expect(detail.getByRole('button', { name: 'Save lead changes', exact: true })).toHaveCount(
    0,
  );
  await expect(detail).toContainText('archived');

  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
});

test('visibility, duplicate warning and server page boundaries use real persisted records', async ({
  page,
  leads,
}) => {
  const sales = await leads.account('sales_executive');
  const other = await leads.account('sales_executive');
  const own = await api(sales);
  const foreign = await api(other);
  const email = `duplicate-${randomUUID()}@example.test`;

  const hidden = await foreign.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: fields(other.id, 'Hidden customer', email),
  });

  expect(Boolean(hidden.error)).toBe(false);

  const first = await own.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: fields(sales.id, 'Own customer', email),
  });

  expect(Boolean(first.error)).toBe(false);
  expect(first.data.possibleDuplicate).toBe(false);

  expect(
    (await own.rpc('crm_lead_page', { p_page: 0, p_archived: false, p_id: hidden.data.lead.id }))
      .data.rows,
  ).toEqual([]);

  const duplicate = await own.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: fields(sales.id, 'Another inquiry', email),
  });

  expect(duplicate.data.possibleDuplicate).toBe(true);

  expect(
    (
      await own.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'archive',
        p_lead_id: first.data.lead.id,
        p_version: 1,
        p_data: {},
      })
    ).error?.code,
  ).toBe('42501');

  for (let index = 0; index < 19; index++) {
    expect(
      Boolean(
        (
          await own.rpc('crm_save_lead', {
            p_request_id: randomUUID(),
            p_command: 'create',
            p_lead_id: null,
            p_version: null,
            p_data: fields(sales.id, `Page fixture ${index}`),
          })
        ).error,
      ),
    ).toBe(false);
  }

  await signInLocalAccount(page, sales);
  await page.goto('/leads');

  await expect(page.getByRole('status').filter({ hasText: 'Page 1:' })).toHaveText(
    'Page 1: 20 of 21 visible leads',
  );
  await expect(page.getByText('Hidden customer', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Next leads page', exact: true }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Page 2:' })).toHaveText(
    'Page 2: 1 of 21 visible leads',
  );

  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByLabel(/Move .* to stage/).first()).toBeEnabled();

  await page.getByRole('button', { name: 'Show archived leads', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No leads on this page', exact: true }),
  ).toBeVisible();
});

test('lost response retries the identical create request and double-submit cannot duplicate it', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();

  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Create lead', exact: true });
  await dialog.getByLabel('Customer name', { exact: true }).fill(`Retry ${randomUUID()}`);

  const ids: string[] = [];

  await page.route('**/leads', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id)
      return route.continue();

    ids.push(id);

    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });

  await dialog.getByRole('form', { name: 'Create lead', exact: true }).evaluate((node) => {
    const form = node as HTMLFormElement;
    form.requestSubmit();
    form.requestSubmit();
  });

  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByLabel('Customer name', { exact: true })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
});

test('loading, failed reload, anonymous and roleless access fail safely', async ({
  page,
  leads,
}) => {
  const sales = await leads.account('sales_executive');

  await signInLocalAccount(page, sales);
  await page.goto('/leads');

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/leads', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await gate;
    await route.abort('failed');
  });

  await page.getByRole('button', { name: 'Reload leads', exact: true }).click();

  await expect(
    page.getByRole('status', { name: '' }).filter({ hasText: 'Loading leads' }),
  ).toBeVisible();

  release();
  await expect(page.getByRole('alert').first()).toContainText('could not be loaded');

  await page.unroute('**/leads');
  await page.getByRole('button', { name: 'Reload leads', exact: true }).click();

  await expect(
    page.getByRole('heading', { name: 'No leads on this page', exact: true }),
  ).toBeVisible();

  const roleless = await leads.account(null);
  const client = await api(roleless);

  expect(
    (await client.rpc('crm_lead_page', { p_page: 0, p_archived: false, p_id: null })).error?.code,
  ).toBe('42501');

  await page.context().clearCookies();
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login$/);
});

test('an uncertain edit locks archive and retries the original update without duplicate history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const client = await api(actor);
  const name = `Edit retry ${randomUUID()}`;

  const created = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: fields(actor.id, name),
  });

  expect(Boolean(created.error)).toBe(false);

  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await openNamedLead(page, name);

  const dialog = page.getByRole('dialog', { name: 'Lead information', exact: true });
  await dialog.getByLabel('Project location', { exact: true }).fill('Retry-safe local fixture');

  const ids: string[] = [];

  await page.route('**/leads', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id)
      return route.continue();

    ids.push(id);

    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });

  await dialog.getByRole('button', { name: 'Save lead changes', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByRole('button', { name: 'Archive lead', exact: true })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);

  const detail = await client.rpc('crm_lead_page', {
    p_page: 0,
    p_archived: false,
    p_id: created.data.lead.id,
  });

  expect(Boolean(detail.error)).toBe(false);
  expect(detail.data.rows[0].location).toBe('Retry-safe local fixture');
  expect(detail.data.rows[0].version).toBe(2);

  expect(
    detail.data.events.filter((event: { action: string }) => event.action === 'updated'),
  ).toHaveLength(1);
});
