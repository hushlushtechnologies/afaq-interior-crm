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
async function seed(actor: LocalTestAccount, owner = actor.id) {
  const client = await api(actor);
  const created = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: `Archive ${randomUUID()}`,
      assigned_user_id: owner,
      source_code: 'manual',
      priority: 'normal',
      inquiry_on: '2026-11-07',
    },
  });
  expect(Boolean(created.error)).toBe(false);
  const lead = created.data.lead;
  const input = {
    command: 'save_room',
    requestId: randomUUID(),
    leadId: lead.id,
    recordId: randomUUID(),
    version: null,
    data: {
      name: 'Archive candidate',
      room_type: null,
      sort_order: 0,
      requirements_notes: 'Retained evidence',
      measurement_notes: null,
      deliverables_notes: null,
    },
  };
  const saved = await client.rpc('crm_save_lead_detail', { p_input: input });
  expect(Boolean(saved.error)).toBe(false);
  return { client, lead, input };
}

test('confirmation cancellation preserves the room; confirmed archive retains content and history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const { client, lead } = await seed(actor);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Archive room', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Archive room', exact: true });
  await dialog.getByRole('button', { name: 'Cancel detail archive', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Archive candidate', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive room', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm detail archive', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Archive candidate', exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Show archived rooms', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Show archived rooms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Archive candidate', exact: true })).toBeVisible();
  await expect(page.getByText('Retained evidence', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit room', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive room', exact: true })).toHaveCount(0);
  const detail = await client.rpc('crm_archived_lead_details', {
    p_lead_id: lead.id,
    p_kind: 'room',
    p_page: 0,
  });
  expect(detail.data.total).toBe(1);
  expect(detail.data.rows[0].created_by).toBe(actor.id);
  expect(detail.data.rows[0].version).toBe(2);
  expect(
    detail.data.events.filter((event: { action: string }) => event.action === 'archived'),
  ).toHaveLength(1);
  await page.reload();
  await page.getByRole('button', { name: 'Show archived rooms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Archive candidate', exact: true })).toBeVisible();
});

test('stale archive rejects the operation without hiding a changed room', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const { client, lead, input } = await seed(actor);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Archive room', exact: true }).click();
  const changed = await client.rpc('crm_save_lead_detail', {
    p_input: {
      ...input,
      requestId: randomUUID(),
      version: 1,
      data: { ...input.data, name: 'New version room' },
    },
  });
  expect(Boolean(changed.error)).toBe(false);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirm detail archive', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('record changed');
  await dialog.getByRole('button', { name: 'Cancel detail archive', exact: true }).click();
  await page.getByRole('button', { name: 'Reload room', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New version room', exact: true })).toBeVisible();
  const archived = await client.rpc('crm_archived_lead_details', {
    p_lead_id: lead.id,
    p_kind: 'room',
    p_page: 0,
  });
  expect(archived.data.total).toBe(0);
});

test('uncertain archive keeps the same request and records one archive event', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const { client, lead } = await seed(actor);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Archive room', exact: true }).click();
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
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Confirm detail archive', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(
    dialog.getByRole('button', { name: 'Cancel detail archive', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry same archive request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);
  const detail = await client.rpc('crm_archived_lead_details', {
    p_lead_id: lead.id,
    p_kind: 'room',
    p_page: 0,
  });
  expect(detail.data.rows[0].version).toBe(2);
  expect(
    detail.data.events.filter((event: { action: string }) => event.action === 'archived'),
  ).toHaveLength(1);
});

test('Sales can read permitted archived rooms without acquiring archive permission', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const sales = await leads.account('sales_executive');
  const { client, lead, input } = await seed(actor, sales.id);
  const archived = await client.rpc('crm_archive_lead_detail', {
    p_input: { requestId: randomUUID(), leadId: lead.id, recordId: input.recordId, version: 1 },
  });
  expect(Boolean(archived.error)).toBe(false);
  await signInLocalAccount(page, sales);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Show archived rooms', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Archive candidate', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive room', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit room', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add room', exact: true })).toHaveCount(0);
});