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

test('follow-up controls create, reschedule and complete with retained history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Lead follow-ups', exact: true });

  await section.getByRole('button', { name: 'Add follow-up', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Follow-up title', { exact: true }).fill('Discuss room preferences');
  await dialog
    .getByLabel('Follow-up due time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() - 7200000).toISOString()));

  await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section.getByText('Discuss room preferences', { exact: true })).toHaveCount(1);

  await section.getByRole('button', { name: 'Reschedule follow-up', exact: true }).click();
  await dialog
    .getByLabel('Follow-up due time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() + 86400000).toISOString()));

  await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await expect(dialog).toHaveCount(1);

  await dialog.getByLabel('Reschedule reason', { exact: true }).fill('Customer requested tomorrow');
  await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section.getByText(/Version 2/)).toBeVisible();

  await section.getByRole('button', { name: 'Complete follow-up', exact: true }).click();
  await dialog
    .getByLabel('Actual follow-up time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date(Date.now() - 60000).toISOString()));
  await dialog
    .getByLabel('Follow-up outcome', { exact: true })
    .fill('Confirmed the next discussion');

  await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await expect(
    section.getByRole('button', { name: 'Complete follow-up', exact: true }),
  ).toHaveCount(0);

  await expect(section.getByText('Confirmed the next discussion', { exact: true })).toHaveCount(2);

  const records = await client.rpc('crm_manual_activity_page', { p_lead_id: lead.id });

  expect(records.data.total).toBe(1);

  await section.getByLabel('Follow-up view', { exact: true }).selectOption('open');
  await expect(section.getByText('No follow-ups in this view.', { exact: true })).toBeVisible();
});

test('uncertain creation retries its original request and read-only management cannot write', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('super_admin');
  const manager = await leads.account('management_director');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Lead follow-ups', exact: true });

  await section.getByRole('button', { name: 'Add follow-up', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Follow-up title', { exact: true }).fill('Retry fixture');
  await dialog
    .getByLabel('Follow-up due time (Dubai)', { exact: true })
    .fill(toDubaiInput(new Date().toISOString()));

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

  await dialog.getByRole('button', { name: 'Save follow-up', exact: true }).click();

  await expect(
    dialog.getByRole('button', { name: 'Retry same follow-up request', exact: true }),
  ).toBeVisible();

  await expect(dialog.getByLabel('Follow-up title', { exact: true })).toBeDisabled();

  await dialog.getByRole('button', { name: 'Retry same follow-up request', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  expect(
    (await client.rpc('crm_follow_up_page', { p_lead_id: lead.id, p_view: 'all', p_mine: false }))
      .data.total,
  ).toBe(1);

  await page.unroute('**/*');
  await page.context().clearCookies();
  await signInLocalAccount(page, manager);
  await page.goto(`/leads/details/${lead.id}`);

  await expect(section.getByText('Retry fixture', { exact: true })).toHaveCount(1);
  await expect(section.getByRole('button', { name: 'Add follow-up', exact: true })).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Edit follow-up', exact: true })).toHaveCount(0);
});
