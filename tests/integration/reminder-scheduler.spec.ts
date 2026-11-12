import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { reminderPageSchema } from '../../src/features/reminders/contracts';

function sql(query: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
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
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}

test('actual local cron tick creates one authorized reminder and is disabled after verification', async () => {
  test.setTimeout(120000);

  const fixtures = createLeadFixtures('http://localhost:3000');

  expect(sql('select count(*) from cron.job;')).toBe('0');
  expect(sql('select count(*) from crm_sales.follow_ups;')).toBe('0');

  let jobId: string | null = null;

  try {
    const owner = await fixtures.account('sales_executive');

    const client = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    expect((await client.auth.signInWithPassword(owner)).error).toBeNull();

    const lead = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'Scheduled synthetic fixture',
        source_code: 'manual',
        priority: 'normal',
        assigned_user_id: owner.id,
        inquiry_on: '2026-11-12',
      },
    });

    expect(lead.error).toBeNull();

    expect(
      (
        await client.rpc('crm_save_follow_up', {
          p_input: {
            requestId: randomUUID(),
            followUpId: randomUUID(),
            leadId: lead.data.lead.id,
            command: 'create',
            version: null,
            data: {
              title: 'Synthetic scheduled task',
              description: null,
              kind: 'call',
              priority: 'normal',
              assigned_user_id: owner.id,
              due_at: new Date(Date.now() - 60000).toISOString(),
            },
          },
        })
      ).error,
    ).toBeNull();

    expect(sql('select count(*) from crm_sales.follow_ups;')).toBe('1');

    jobId = sql(
      "select cron.schedule('afaq-local-follow-up-reminders','* * * * *','select crm_sales.generate_follow_up_reminders();');",
    );

    if (!/^\d+$/.test(jobId)) throw new Error('Unexpected local job identity.');

    await expect
      .poll(
        async () => {
          const read = await client.rpc('crm_my_reminders', { p_page: 0 });

          if (read.error) throw new Error('Local reminder read failed.');

          return reminderPageSchema.parse(read.data).total;
        },
        { timeout: 90000, intervals: [1000] },
      )
      .toBe(1);

    await expect
      .poll(
        () =>
          sql(
            `select count(*) from cron.job_run_details where jobid=${jobId} and status='succeeded';`,
          ),
        { timeout: 10000 },
      )
      .not.toBe('0');

    sql('select crm_sales.generate_follow_up_reminders();');

    const read = await client.rpc('crm_my_reminders', { p_page: 0 });

    expect(reminderPageSchema.parse(read.data).total).toBe(1);
  } finally {
    if (jobId && /^\d+$/.test(jobId)) sql(`select cron.unschedule(${jobId});`);

    await fixtures.cleanup();
  }

  expect(sql('select count(*) from cron.job;')).toBe('0');
});
