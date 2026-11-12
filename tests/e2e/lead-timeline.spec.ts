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

test('combined timeline reuses all sources and deduplicates follow-up completion', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('super_admin');
  const manager = await leads.account('management_director');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);

  const command = {
    leadId: lead.id,
    requestId: randomUUID(),
    followUpId: randomUUID(),
    command: 'create',
    version: null,
    data: {
      title: 'Timeline task',
      description: null,
      kind: 'call',
      priority: 'normal',
      assigned_user_id: actor.id,
      due_at: new Date().toISOString(),
    },
  };

  expect((await client.rpc('crm_save_follow_up', { p_input: command })).error).toBeNull();

  expect(
    (
      await client.rpc('crm_save_follow_up', {
        p_input: {
          ...command,
          requestId: randomUUID(),
          command: 'complete',
          version: 1,
          data: {
            actual_at: new Date(Date.now() - 60000).toISOString(),
            outcome: 'Timeline outcome',
          },
        },
      })
    ).error,
  ).toBeNull();

  expect(
    (
      await client.rpc('crm_save_lead_detail', {
        p_input: {
          requestId: randomUUID(),
          leadId: lead.id,
          recordId: randomUUID(),
          command: 'save_note',
          version: null,
          data: { body: 'Internal timeline evidence' },
        },
      })
    ).error,
  ).toBeNull();

  expect(
    (
      await client.rpc('crm_save_site_visit', {
        p_input: {
          requestId: randomUUID(),
          leadId: lead.id,
          visitId: randomUUID(),
          command: 'create',
          version: null,
          data: {
            scheduled_at: new Date().toISOString(),
            assigned_user_id: actor.id,
            location: null,
            notes: null,
            measurements: null,
            observations: null,
          },
        },
      })
    ).error,
  ).toBeNull();

  expect(
    (
      await client.rpc('crm_log_manual_activity', {
        p_input: {
          requestId: randomUUID(),
          leadId: lead.id,
          activityId: randomUUID(),
          command: 'log',
          data: {
            kind: 'email',
            summary: 'Timeline communication',
            occurred_at: new Date(Date.now() - 60000).toISOString(),
            outcome: null,
            notes: null,
          },
        },
      })
    ).error,
  ).toBeNull();

  const read = await client.rpc('crm_lead_timeline', { p_lead_id: lead.id });

  expect(read.error).toBeNull();
  expect(read.data.total).toBe(6);
  expect(new Set(read.data.rows.map((row: { source: string }) => row.source)).size).toBe(5);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${lead.id}`);

  const section = page.getByRole('region', { name: 'Lead activity timeline', exact: true });

  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(6);
  await expect(
    section.getByRole('heading', { name: 'Follow-up completed', exact: true }),
  ).toHaveCount(1);

  await section
    .getByRole('heading', { name: 'note created', exact: true })
    .locator('..')
    .getByText('Recorded evidence', { exact: true })
    .click();

  await expect(section.getByText('Internal timeline evidence', { exact: true })).toBeVisible();

  await page.context().clearCookies();
  await signInLocalAccount(page, manager);
  await page.goto(`/leads/details/${lead.id}`);

  await expect(section.getByRole('heading', { level: 3 })).toHaveCount(6);
});
