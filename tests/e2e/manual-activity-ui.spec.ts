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

test('four manual activity kinds validate time and preserve immutable records', async ({
  page,
  leads,
}) => {
  const user = await leads.account('sales_executive');
  const client = await api(user);
  const lead = await seedLead(client, user.id);

  await signInLocalAccount(page, user);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Recorded sales activities', exact: true });

  for (const kind of ['call', 'meeting', 'whatsapp', 'email']) {
    await section.getByRole('button', { name: 'Log manual activity', exact: true }).click();

    const dialog = page.getByRole('dialog');

    await dialog.getByLabel('Activity type', { exact: true }).selectOption(kind);
    await dialog
      .getByLabel('Activity summary', { exact: true })
      .fill(`Recorded ${kind} discussion`);

    if (kind === 'call') {
      await dialog
        .getByLabel('Actual activity time (Dubai)', { exact: true })
        .fill(toDubaiInput(new Date(Date.now() + 86400000).toISOString()));

      await dialog.getByRole('button', { name: 'Save manual activity', exact: true }).click();
      await expect(dialog).toHaveCount(1);

      expect(
        (await client.rpc('crm_manual_activity_page', { p_lead_id: lead.id })).data.total,
      ).toBe(0);
    }

    await dialog
      .getByLabel('Actual activity time (Dubai)', { exact: true })
      .fill(toDubaiInput(new Date(Date.now() - 60000).toISOString()));

    await dialog.getByRole('button', { name: 'Save manual activity', exact: true }).click();
    await expect(dialog).toHaveCount(0);

    await expect(
      section.getByRole('heading', { name: `Recorded ${kind} discussion`, exact: true }),
    ).toBeVisible();
  }

  const response = await client.rpc('crm_manual_activity_page', { p_lead_id: lead.id });

  expect(response.data.total).toBe(4);

  expect(
    response.data.rows.every(
      (row: { outcome: unknown; notes: unknown }) => row.outcome === null && row.notes === null,
    ),
  ).toBe(true);

  await page.reload();

  await expect(
    section.getByRole('heading', { name: 'Recorded email discussion', exact: true }),
  ).toBeVisible();

  await expect(section.getByRole('button', { name: /edit|delete/i })).toHaveCount(0);
});

test('lost response retries once; management reads and unrelated Sales cannot access logs', async ({
  page,
  leads,
}) => {
  const user = await leads.account('super_admin');
  const manager = await leads.account('management_director');
  const stranger = await leads.account('sales_executive');
  const client = await api(user);
  const lead = await seedLead(client, user.id);

  await signInLocalAccount(page, user);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Recorded sales activities', exact: true });

  await section.getByRole('button', { name: 'Log manual activity', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Activity summary', { exact: true }).fill('Private retry discussion');
  await dialog
    .getByLabel('Actual activity time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() - 60000).toISOString()));

  let dropped = false;

  await page.route('**/*', async (route) => {
    if (
      !dropped &&
      route.request().method() === 'POST' &&
      route.request().headers()['next-action']
    ) {
      dropped = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });

  await dialog.getByRole('button', { name: 'Save manual activity', exact: true }).click();

  await expect(
    dialog.getByRole('button', { name: 'Retry same activity request', exact: true }),
  ).toBeVisible();

  await expect(dialog.getByLabel('Activity summary', { exact: true })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Retry same activity request', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  expect((await client.rpc('crm_manual_activity_page', { p_lead_id: lead.id })).data.total).toBe(1);

  await page.unroute('**/*');
  await page.context().clearCookies();
  await signInLocalAccount(page, manager);
  await page.goto(`/leads/details/${lead.id}`);

  await expect(
    section.getByRole('heading', { name: 'Private retry discussion', exact: true }),
  ).toBeVisible();

  await expect(
    section.getByRole('button', { name: 'Log manual activity', exact: true }),
  ).toHaveCount(0);

  await page.context().clearCookies();
  await signInLocalAccount(page, stranger);
  await page.goto(`/leads/details/${lead.id}`);

  await expect(section).toHaveCount(0);
  await expect(page.getByText('Private retry discussion', { exact: true })).toHaveCount(0);
});

test('activity pagination preserves older records', async ({ page, leads }) => {
  const user = await leads.account('sales_executive');
  const client = await api(user);
  const lead = await seedLead(client, user.id);

  for (let i = 0; i < 21; i++) {
    const saved = await client.rpc('crm_log_manual_activity', {
      p_input: {
        command: 'log',
        leadId: lead.id,
        activityId: randomUUID(),
        requestId: randomUUID(),
        data: {
          kind: 'call',
          summary: `Historical call ${i}`,
          occurred_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
          outcome: null,
          notes: null,
        },
      },
    });

    expect(saved.error).toBeNull();
  }

  await signInLocalAccount(page, user);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Recorded sales activities', exact: true });

  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(20);
  await section.getByRole('button', { name: 'Next activity page', exact: true }).click();

  await expect(
    section.getByRole('heading', { name: 'Historical call 20', exact: true }),
  ).toBeVisible();

  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(1);
  await section.getByRole('button', { name: 'Previous activity page', exact: true }).click();
  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(20);
});
