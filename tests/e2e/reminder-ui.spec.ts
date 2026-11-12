import { execFileSync } from 'node:child_process';
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

test.beforeEach(async ({ leads }) => {
  void leads;

  const baseline = execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      "select (select count(*) from cron.job)::text||':'||(select count(*) from crm_sales.follow_ups)::text;",
    ],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();

  expect(baseline, 'Use an isolated fixture database with no jobs or existing follow-ups.').toBe(
    '0:0',
  );
});

test('bell lists personal reminders, marks read and hides rescheduled notices', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);

  const command = {
    leadId: lead.id,
    requestId: randomUUID(),
    followUpId: randomUUID(),
    command: 'create',
    version: null,
    data: {
      title: 'Private reminder task',
      description: null,
      kind: 'call',
      priority: 'normal',
      assigned_user_id: actor.id,
      due_at: new Date(Date.now() - 60000).toISOString(),
    },
  };

  expect((await client.rpc('crm_save_follow_up', { p_input: command })).error).toBeNull();

  execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'select crm_sales.generate_follow_up_reminders();',
    ],
    { stdio: 'pipe' },
  );

  await signInLocalAccount(page, actor);
  await page.getByRole('button', { name: 'Open notifications', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Follow-up reminders', exact: true });

  await expect(dialog.getByRole('heading', { name: 'Follow-up due', exact: true })).toBeVisible();
  await expect(dialog.getByText('Private reminder task', { exact: true })).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Mark reminder read', exact: true }).click();
  await expect(dialog.getByText('Read', { exact: true })).toBeVisible();

  expect((await client.rpc('crm_my_reminders', { p_page: 0 })).data.unread).toBe(0);

  expect(
    (
      await client.rpc('crm_save_follow_up', {
        p_input: {
          ...command,
          requestId: randomUUID(),
          command: 'reschedule',
          version: 1,
          data: {
            due_at: new Date(Date.now() + 86400000).toISOString(),
            reason: 'Next day discussion',
          },
        },
      })
    ).error,
  ).toBeNull();

  await dialog.getByRole('button', { name: 'Refresh reminders', exact: true }).click();
  await expect(dialog.getByText('No current follow-up reminders.', { exact: true })).toBeVisible();
});

function generate() {
  execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'select crm_sales.generate_follow_up_reminders();',
    ],
    { stdio: 'pipe' },
  );
}

async function dueTask(client: Client, leadId: string, owner: string) {
  expect(
    (
      await client.rpc('crm_save_follow_up', {
        p_input: {
          leadId,
          requestId: randomUUID(),
          followUpId: randomUUID(),
          command: 'create',
          version: null,
          data: {
            title: 'Restricted fixture task',
            description: null,
            kind: 'call',
            priority: 'normal',
            assigned_user_id: owner,
            due_at: new Date(Date.now() - 60000).toISOString(),
          },
        },
      })
    ).error,
  ).toBeNull();
}

test('reminder pagination retains read state after a lost mark-read response', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  const client = await api(actor);
  const lead = await seedLead(client, actor.id);

  for (let i = 0; i < 21; i++) await dueTask(client, lead.id, actor.id);

  generate();

  await signInLocalAccount(page, actor);
  await page.getByRole('button', { name: 'Open notifications', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Follow-up due', exact: true })).toHaveCount(20);
  await dialog.getByRole('button', { name: 'Next reminder page', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Follow-up due', exact: true })).toHaveCount(1);

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

  await dialog.getByRole('button', { name: 'Mark reminder read', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();

  await dialog.getByRole('button', { name: 'Refresh reminders', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('20 unread');

  expect((await client.rpc('crm_my_reminders', { p_page: 0 })).data.unread).toBe(20);

  await page.unroute('**/*');
});

test('reminders remain recipient-only and disappear after owner access changes', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('super_admin');
  const other = await leads.account('sales_executive');
  const client = await api(actor);
  const otherClient = await api(other);
  const lead = await seedLead(client, actor.id);

  await dueTask(client, lead.id, actor.id);
  generate();

  const own = await client.rpc('crm_my_reminders', { p_page: 0 });

  expect(own.data.total).toBe(1);
  expect(
    (await otherClient.rpc('crm_read_reminder', { p_id: own.data.rows[0].id })).error?.code,
  ).toBe('42501');
  expect((await otherClient.rpc('crm_my_reminders', { p_page: 0 })).data.total).toBe(0);

  await signInLocalAccount(page, actor);
  await page.getByRole('button', { name: 'Open notifications', exact: true }).click();

  const dialog = page.getByRole('dialog');

  await expect(dialog.getByRole('heading', { name: 'Follow-up due', exact: true })).toBeVisible();

  expect(
    (
      await client.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'assign',
        p_lead_id: lead.id,
        p_version: 1,
        p_data: { assigned_user_id: other.id },
      })
    ).error,
  ).toBeNull();

  await dialog.getByRole('button', { name: 'Refresh reminders', exact: true }).click();
  await expect(dialog.getByText('No current follow-up reminders.', { exact: true })).toBeVisible();
});
