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
import { toDubaiInput } from '../../src/features/lead-visits/schemas';

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

async function seedLead(client: Client, owner: string) {
  const result = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: `Visit ${randomUUID()}`,
      source_code: 'manual',
      priority: 'normal',
      assigned_user_id: owner,
      inquiry_on: '2026-11-07',
    },
  });
  expect(Boolean(result.error)).toBe(false);
  return result.data.lead;
}

async function seedVisit(client: Client, leadId: string, owner: string | null = null) {
  const input = {
    command: 'create',
    requestId: randomUUID(),
    leadId,
    visitId: randomUUID(),
    version: null,
    data: {
      scheduled_at: new Date(Date.now() - 7200000).toISOString(),
      assigned_user_id: owner,
      location: null,
      notes: 'Permitted visit evidence',
      measurements: null,
      observations: null,
    },
  };
  const result = await client.rpc('crm_save_site_visit', { p_input: input });
  expect(Boolean(result.error)).toBe(false);
  return input;
}

test('visits create, edit, complete and cancel with retained history and Dubai time', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Add site visit', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Scheduled visit time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() - 7200000).toISOString()));
  await dialog.getByLabel('Assigned visit employee', { exact: true }).selectOption(actor.id);
  await dialog.getByLabel('Visit notes', { exact: true }).fill('Collect room dimensions');
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit site visit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Edit site visit', exact: true }).click();
  await dialog
    .getByLabel('Visit measurements (unverified)', { exact: true })
    .fill('Approximate 4 x 5 m');
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await expect(
    page.getByRole('button', { name: 'Complete site visit', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Complete site visit', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Check the form' })).toBeVisible();
  await dialog
    .getByLabel('Actual visit time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() - 3600000).toISOString()));
  await dialog
    .getByLabel('Visit outcome', { exact: true })
    .fill('Measurements and access confirmed');
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page
      .getByRole('region', { name: 'Site visits', exact: true })
      .getByText('completed', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit site visit', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add site visit', exact: true }).click();
  await dialog
    .getByLabel('Scheduled visit time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() + 86400000).toISOString()));
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel site visit', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Cancel site visit', exact: true }).click();
  await dialog.getByLabel('Cancellation reason', { exact: true }).fill('Customer postponed access');
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Site visits', exact: true })
      .getByText('cancelled', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit site visit', exact: true })).toHaveCount(0);

  const result = await client.rpc('crm_site_visits', { p_lead_id: lead.id, p_page: 0 });
  expect(result.data.total).toBe(2);
  expect(
    result.data.rows.find((visit: { status: string }) => visit.status === 'completed').version,
  ).toBe(3);
  expect(
    result.data.events.filter((event: { actions: string[] }) =>
      event.actions.includes('completed'),
    ),
  ).toHaveLength(1);
  expect(
    (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('owner changes flag planned assignments without changing finalized history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const oldOwner = await leads.account('sales_executive');
  const owner = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, oldOwner.id);
  const planned = await seedVisit(client, lead.id, oldOwner.id);
  const finished = await seedVisit(client, lead.id, oldOwner.id);

  const completed = await client.rpc('crm_save_site_visit', {
    p_input: {
      ...finished,
      command: 'complete',
      requestId: randomUUID(),
      version: 1,
      data: {
        actual_at: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'Original visit completed',
      },
    },
  });
  expect(Boolean(completed.error)).toBe(false);

  const assigned = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'assign',
    p_lead_id: lead.id,
    p_version: 1,
    p_data: { assigned_user_id: owner.id },
  });
  expect(Boolean(assigned.error)).toBe(false);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);

  const card = page.getByTestId(`visit-${planned.visitId}`);
  await expect(card.getByRole('status')).toContainText('Assignment requires review');
  await card.getByRole('button', { name: 'Edit site visit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Assigned visit employee', { exact: true }).selectOption(owner.id);
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole('status')).toHaveCount(0);

  const result = await client.rpc('crm_site_visits', { p_lead_id: lead.id, p_page: 0 });
  const active = result.data.rows.find((visit: { id: string }) => visit.id === planned.visitId);
  expect(active.assigned_user_id).toBe(owner.id);
  expect(Date.parse(active.scheduled_at)).toBe(Date.parse(planned.data.scheduled_at));
  const historic = result.data.rows.find((visit: { id: string }) => visit.id === finished.visitId);
  expect(historic.assigned_user_id).toBe(oldOwner.id);
  expect(historic.needs_assignment_review).toBe(false);
});

test('uncertain visit creation retries its original identity and creates one visit', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Add site visit', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Scheduled visit time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() + 86400000).toISOString()));

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

  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByLabel('Scheduled visit time (Dubai)', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Cancel visit editing', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry same visit request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);

  const result = await client.rpc('crm_site_visits', { p_lead_id: lead.id, p_page: 0 });
  expect(result.data.total).toBe(1);
  expect(result.data.events).toHaveLength(1);
});

test('stale visit editing cannot overwrite another session', async ({ page, leads }) => {
  const actor = await leads.account();
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);
  const visit = await seedVisit(client, lead.id);
  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await page.getByRole('button', { name: 'Edit site visit', exact: true }).click();

  const changed = await client.rpc('crm_save_site_visit', {
    p_input: {
      ...visit,
      command: 'update',
      requestId: randomUUID(),
      version: 1,
      data: { ...visit.data, notes: 'Other session visit' },
    },
  });
  expect(Boolean(changed.error)).toBe(false);

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Visit notes', { exact: true }).fill('Stale note');
  await dialog.getByRole('button', { name: 'Save visit', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('visit changed');
  await dialog.getByRole('button', { name: 'Cancel visit editing', exact: true }).click();
  await page.getByRole('button', { name: 'Reload site visits', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Site visits', exact: true })
      .getByText('Other session visit', { exact: false }),
  ).toBeVisible();
});

test('Management reads visits while unrelated Sales cannot see their lead', async ({
  page,
  leads,
  browser,
  baseURL,
}) => {
  const actor = await leads.account();
  const manager = await leads.account('management_director');
  const stranger = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);
  await seedVisit(client, lead.id);

  await signInLocalAccount(page, manager);
  await page.goto(`/leads/details/${lead.id}`);
  await expect(
    page
      .getByRole('region', { name: 'Site visits', exact: true })
      .getByText('Permitted visit evidence', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add site visit', exact: true })).toHaveCount(0);

  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const hidden = await context.newPage();
    await signInLocalAccount(hidden, stranger);
    await hidden.goto(`/leads/details/${lead.id}`);
    await expect(hidden.getByText('Permitted visit evidence', { exact: false })).toHaveCount(0);
    await expect(
      hidden.getByRole('heading', { name: lead.customer_name, exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('visit pagination and Lost/archive read-only states retain records', async ({
  page,
  leads,
}) => {
  const actor = await leads.account();
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);
  for (let i = 0; i < 21; i++) await seedVisit(client, lead.id);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);
  await expect(page.getByRole('status').filter({ hasText: 'Site visits page 1:' })).toHaveText(
    'Site visits page 1: 20 of 21',
  );
  await page.getByRole('button', { name: 'Next visit page', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Site visits page 2:' })).toHaveText(
    'Site visits page 2: 1 of 21',
  );

  const lost = await client.rpc('crm_transition_lead', {
    p_request_id: randomUUID(),
    p_lead_id: lead.id,
    p_version: 1,
    p_command: 'lose',
    p_data: { reasonCode: 'cancelled' },
  });
  expect(Boolean(lost.error)).toBe(false);

  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Site visits page 1:' })).toHaveText(
    'Site visits page 1: 20 of 21',
  );
  await expect(page.getByRole('button', { name: 'Edit site visit', exact: true })).toHaveCount(0);

  const reopened = await client.rpc('crm_transition_lead', {
    p_request_id: randomUUID(),
    p_lead_id: lead.id,
    p_version: 2,
    p_command: 'reopen',
    p_data: { reason: 'Local resumption' },
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
  await expect(page.getByRole('status').filter({ hasText: 'Site visits page 1:' })).toHaveText(
    'Site visits page 1: 20 of 21',
  );
  await expect(page.getByRole('button', { name: 'Add site visit', exact: true })).toHaveCount(0);
});
