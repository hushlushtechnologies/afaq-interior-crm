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

async function task(client: Client, leadId: string, owner: string, title: string, due: string) {
  const command = {
    leadId,
    requestId: randomUUID(),
    followUpId: randomUUID(),
    command: 'create',
    version: null,
    data: {
      title,
      description: null,
      kind: 'call',
      priority: 'normal',
      assigned_user_id: owner,
      due_at: due,
    },
  };

  expect((await client.rpc('crm_save_follow_up', { p_input: command })).error).toBeNull();

  return command;
}

test('Sales daily views stay scoped, filter and paginate with real records', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const stranger = await leads.account('sales_executive');
  const client = await api(actor);
  const other = await api(stranger);
  const lead = await seedLead(client, actor.id);
  const hidden = await seedLead(other, stranger.id);

  await task(other, hidden.id, stranger.id, 'Restricted team task', new Date().toISOString());

  for (let i = 0; i < 21; i++)
    await task(
      client,
      lead.id,
      actor.id,
      `Overdue task ${i}`,
      new Date(Date.now() - 86400000).toISOString(),
    );

  const upcoming = await task(
    client,
    lead.id,
    actor.id,
    'Future discussion',
    new Date(Date.now() + 86400000).toISOString(),
  );

  const completed = await task(
    client,
    lead.id,
    actor.id,
    'Finished discussion',
    new Date().toISOString(),
  );

  expect(
    (
      await client.rpc('crm_save_follow_up', {
        p_input: {
          ...completed,
          requestId: randomUUID(),
          command: 'complete',
          version: 1,
          data: {
            actual_at: new Date(Date.now() - 60000).toISOString(),
            outcome: 'Confirmed requirements',
          },
        },
      })
    ).error,
  ).toBeNull();

  expect(
    (
      await client.rpc('crm_save_follow_up', {
        p_input: {
          ...upcoming,
          requestId: randomUUID(),
          command: 'cancel',
          version: 1,
          data: { reason: 'Customer postponed' },
        },
      })
    ).error,
  ).toBeNull();

  await task(
    client,
    lead.id,
    actor.id,
    'Upcoming discussion',
    new Date(Date.now() + 86400000).toISOString(),
  );

  expect((await client.rpc('crm_follow_up_page', { p_mine: false })).error?.code).toBe('42501');

  await signInLocalAccount(page, actor);
  await page.goto('/leads/follow-ups');

  const section = page.getByRole('region', { name: 'My follow-ups', exact: true });

  await expect(section.getByText('No follow-ups match this view.', { exact: true })).toBeVisible();

  await expect(
    page.getByLabel('Follow-up scope', { exact: true }).locator('option[value="team"]'),
  ).toHaveCount(0);

  await page.getByLabel('Daily follow-up view', { exact: true }).selectOption('overdue');
  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(20);
  await expect(section.getByText('Restricted team task', { exact: true })).toHaveCount(0);

  await section.getByRole('button', { name: 'Next daily page', exact: true }).click();
  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(1);

  await page.getByLabel('Daily follow-up view', { exact: true }).selectOption('upcoming');
  await expect(
    section.getByRole('heading', { name: 'Upcoming discussion', exact: true }),
  ).toBeVisible();

  await page.getByLabel('Daily follow-up view', { exact: true }).selectOption('completed');
  await expect(section.getByText('Confirmed requirements', { exact: true })).toBeVisible();

  await page.getByLabel('Daily follow-up view', { exact: true }).selectOption('cancelled');
  await expect(section.getByText('Customer postponed', { exact: true })).toBeVisible();

  await section.getByRole('link', { name: 'Open lead follow-ups', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lead follow-ups', exact: true })).toBeVisible();
});

test('company-wide Management reads team tasks and archived lead links preserve history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('super_admin');
  const owner = await leads.account('sales_executive');
  const manager = await leads.account('management_director');
  const client = await api(actor);
  const lead = await seedLead(client, owner.id);

  await task(client, lead.id, owner.id, 'Historical team task', new Date().toISOString());

  expect(
    (
      await client.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'archive',
        p_lead_id: lead.id,
        p_version: 1,
        p_data: {},
      })
    ).error,
  ).toBeNull();

  await signInLocalAccount(page, manager);
  await page.goto('/leads/follow-ups');
  await page.getByLabel('Follow-up scope', { exact: true }).selectOption('team');

  const section = page.getByRole('region', { name: 'Team follow-ups', exact: true });

  await expect(
    section.getByRole('heading', { name: 'Historical team task', exact: true }),
  ).toBeVisible();

  const card = section
    .getByRole('heading', { name: 'Historical team task', exact: true })
    .locator('..');

  await expect(
    card.getByText('Read-only task: finalized, closed lead or restricted update permission.', {
      exact: true,
    }),
  ).toBeVisible();

  await card.getByRole('link', { name: 'Open lead follow-ups', exact: true }).click();

  const details = page.getByRole('region', { name: 'Lead follow-ups', exact: true });

  await expect(
    details.getByRole('heading', { name: 'Historical team task', exact: true }),
  ).toBeVisible();

  await expect(details.getByRole('button', { name: 'Edit follow-up', exact: true })).toHaveCount(0);
});
