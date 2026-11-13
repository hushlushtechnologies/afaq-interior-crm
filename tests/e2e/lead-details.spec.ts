import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
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
type Client = Awaited<ReturnType<typeof api>>;
async function seed(client: Client, owner: string) {
  const result = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: `Detail ${randomUUID()}`,
      source_code: 'manual',
      priority: 'normal',
      inquiry_on: '2026-11-07',
      assigned_user_id: owner,
      initial_note: 'Original inquiry evidence',
    },
  });
  expect(Boolean(result.error)).toBe(false);
  return result.data.lead;
}
async function room(client: Client, leadId: string, name = 'Repeated room') {
  const input = {
    command: 'save_room',
    requestId: randomUUID(),
    leadId,
    recordId: randomUUID(),
    version: null,
    data: {
      name,
      room_type: null,
      sort_order: 0,
      requirements_notes: null,
      measurement_notes: null,
      deliverables_notes: null,
    },
  };
  const result = await client.rpc('crm_save_lead_detail', { p_input: input });
  expect(Boolean(result.error)).toBe(false);
  return input;
}

test('real details navigation, requirements, repeated rooms and internal notes persist', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seed(client, actor.id);
  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page
    .getByRole('link', { name: `Full details for ${lead.customer_name}`, exact: true })
    .click();
  await expect(page.getByRole('heading', { name: lead.customer_name, exact: true })).toBeVisible();
  await expect(page.getByText('Original inquiry evidence', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add requirements', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Design preferences', { exact: true }).fill('Warm minimal interiors');
  await dialog.getByLabel('Desired start date', { exact: true }).fill('2026-11-10');
  await dialog.getByLabel('Desired completion date', { exact: true }).fill('2026-11-09');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Check the form' })).toBeVisible();
  await dialog.getByLabel('Desired completion date', { exact: true }).fill('2026-11-20');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit requirements', exact: true })).toBeEnabled();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Add room', exact: true }).click();
    await dialog.getByLabel('Room or space name', { exact: true }).fill('Living room');
    await dialog
      .getByLabel('Measurements and units (unverified notes)', { exact: true })
      .fill('Approx. 4 x 5 m');
    await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add room', exact: true })).toBeEnabled();
  }
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await dialog.getByLabel('Internal note', { exact: true }).fill('First internal note');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit note', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await dialog.getByLabel('Internal note', { exact: true }).fill('Revised internal note');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Revised internal note', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Warm minimal interiors', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Living room', exact: true })).toHaveCount(2);
  await expect(page.getByText('Revised internal note', { exact: true })).toBeVisible();
  const detail = await client.rpc('crm_lead_details', {
    p_lead_id: lead.id,
    p_kind: 'note',
    p_page: 0,
  });
  expect(detail.data.rows[0].version).toBe(2);
  expect(detail.data.rows[0].created_by).toBe(actor.id);
  expect(detail.data.events).toHaveLength(2);
  expect(detail.data.events[0].before_data.data.body).toBe('First internal note');
  expect(
    (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('stale editor rejects replacement and reload retrieves the other session version', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seed(client, actor.id);
  const input = await room(client, lead.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Edit room', exact: true }).click();
  const changed = await client.rpc('crm_save_lead_detail', {
    p_input: {
      ...input,
      requestId: randomUUID(),
      version: 1,
      data: { ...input.data, name: 'Other session room' },
    },
  });
  expect(Boolean(changed.error)).toBe(false);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Room or space name', { exact: true }).fill('Stale replacement');
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('record changed');
  await dialog.getByRole('button', { name: 'Cancel detail editing', exact: true }).click();
  await page.getByRole('button', { name: 'Reload room', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Other session room', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Stale replacement', { exact: true })).toHaveCount(0);
});

test('unconfirmed note response locks the editor and retries the same command once', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seed(client, actor.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Internal note', { exact: true }).fill('Retry evidence');
  const ids: string[] = [];
  await page.route('**/leads/details/**', async (route) => {
    const req = route.request();
    const id = (req.postData() ?? '').match(/"requestId":"([0-9a-f-]+)"/i)?.[1];
    if (req.method() !== 'POST' || !req.headers()['next-action'] || !id) return route.continue();
    ids.push(id);
    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByLabel('Internal note', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Cancel detail editing', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry same detail request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const detail = await client.rpc('crm_lead_details', {
    p_lead_id: lead.id,
    p_kind: 'note',
    p_page: 0,
  });
  expect(detail.data.rows).toHaveLength(1);
  expect(detail.data.rows[0].version).toBe(1);
  expect(detail.data.events).toHaveLength(1);
});

test('Management reads without edit controls and unrelated Sales cannot see the record', async ({
  page,
  leads,
  browser,
  baseURL,
}) => {
  const actor = await leads.account();
  const manager = await leads.account('management_director');
  const other = await leads.account('sales_executive');
  const lead = await seed(await api(actor), actor.id);
  await signInLocalAccount(page, manager);
  await page.goto(`/leads/details/${lead.id}`);
  await expect(page.getByRole('heading', { name: lead.customer_name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add requirements', exact: true })).toHaveCount(0);
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const hidden = await context.newPage();
    await signInLocalAccount(hidden, other);
    await hidden.goto(`/leads/details/${lead.id}`);
    await expect(
      hidden.getByRole('heading', { name: lead.customer_name, exact: true }),
    ).toHaveCount(0);
    await expect(hidden.getByText('Original inquiry evidence', { exact: true })).toHaveCount(0);
    await expect(hidden.getByRole('button', { name: 'Add note', exact: true })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('room pagination returns all repeated room records across pages', async ({ page, leads }) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seed(client, actor.id);
  for (let i = 0; i < 21; i++) await room(client, lead.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await expect(page.getByRole('status').filter({ hasText: 'Rooms and scope page 1:' })).toHaveText(
    'Rooms and scope page 1: 20 of 21',
  );
  await page.getByRole('button', { name: 'Next room page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Rooms and scope page 2:' })).toHaveText(
    'Rooms and scope page 2: 1 of 21',
  );
  await page.getByRole('button', { name: 'Previous room page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Rooms and scope page 1:' })).toHaveText(
    'Rooms and scope page 1: 20 of 21',
  );
});

test('Lost and archived leads retain details but offer no mutation controls', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const client = await api(actor);
  const lead = await seed(client, actor.id);
  await room(client, lead.id, 'Preserved room');
  const lost = await client.rpc('crm_transition_lead', {
    p_request_id: randomUUID(),
    p_lead_id: lead.id,
    p_version: 1,
    p_command: 'lose',
    p_data: { reasonCode: 'cancelled' },
  });
  expect(Boolean(lost.error)).toBe(false);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await expect(page.getByRole('heading', { name: 'Preserved room', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit room', exact: true })).toHaveCount(0);
  const reopened = await client.rpc('crm_transition_lead', {
    p_request_id: randomUUID(),
    p_lead_id: lead.id,
    p_version: 2,
    p_command: 'reopen',
    p_data: { reason: 'Local test reopening' },
  });
  expect(Boolean(reopened.error)).toBe(false);
  const archived = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'archive',
    p_lead_id: lead.id,
    p_version: 3,
    p_data: {},
  });
  expect(Boolean(archived.error)).toBe(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Preserved room', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add note', exact: true })).toHaveCount(0);
});
