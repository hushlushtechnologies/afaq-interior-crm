import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import {
  followUpPageSchema,
  followUpSaveSchema,
  manualActivityPageSchema,
  manualActivitySaveSchema,
} from '../../src/features/follow-ups/contracts';

test('session RPCs validate response contracts, serialize competing edits and replay completion once', async () => {
  // Exact loopback URL and dedicated project are checked before creating any account.
  const fixtures = createLeadFixtures('http://localhost:3000');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  const client = createClient(
    'http://127.0.0.1:57421',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options,
  );

  const stranger = createClient(
    'http://127.0.0.1:57421',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options,
  );

  try {
    const user = await fixtures.account('sales_executive');
    const other = await fixtures.account('sales_executive');

    expect((await client.auth.signInWithPassword(user)).error).toBeNull();
    expect((await stranger.auth.signInWithPassword(other)).error).toBeNull();

    const saved = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'Synthetic follow-up fixture',
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-10',
        assigned_user_id: user.id,
      },
    });

    expect(saved.error).toBeNull();

    const leadId: string = saved.data.lead.id;

    const fields = {
      title: 'Discuss requirements',
      description: null,
      kind: 'call',
      priority: 'normal',
      assigned_user_id: user.id,
      due_at: new Date().toISOString(),
    };

    const command = {
      leadId,
      followUpId: randomUUID(),
      requestId: randomUUID(),
      command: 'create',
      version: null,
      data: fields,
    };

    const created = await client.rpc('crm_save_follow_up', { p_input: command });

    expect(created.error).toBeNull();
    expect(followUpSaveSchema.parse(created.data).followUp.status).toBe('open');

    expect(
      (await stranger.rpc('crm_follow_up_page', { p_lead_id: leadId, p_mine: false })).error?.code,
    ).toBe('42501');

    const edit = {
      ...command,
      command: 'reschedule',
      version: 1,
      data: {
        due_at: new Date(Date.now() + 86400000).toISOString(),
        reason: 'Customer requested another time',
      },
    };

    const race = await Promise.all([
      client.rpc('crm_save_follow_up', { p_input: { ...edit, requestId: randomUUID() } }),
      client.rpc('crm_save_follow_up', { p_input: { ...edit, requestId: randomUUID() } }),
    ]);

    expect(race.filter((response) => !response.error)).toHaveLength(1);
    expect(race.find((response) => response.error)?.error?.code).toBe('40001');

    const completed = {
      ...command,
      command: 'complete',
      version: 2,
      requestId: randomUUID(),
      data: {
        actual_at: new Date(Date.now() - 1000).toISOString(),
        outcome: 'Confirmed the next discussion',
      },
    };

    const completionRace = await Promise.all([
      client.rpc('crm_save_follow_up', { p_input: completed }),
      client.rpc('crm_save_follow_up', { p_input: completed }),
    ]);

    expect(completionRace.every((response) => !response.error)).toBe(true);

    expect(
      completionRace.map((response) => followUpSaveSchema.parse(response.data).replayed).sort(),
    ).toEqual([false, true]);

    const page = await client.rpc('crm_follow_up_page', {
      p_lead_id: leadId,
      p_view: 'all',
      p_mine: false,
    });

    expect(page.error).toBeNull();

    const parsed = followUpPageSchema.parse(page.data);

    expect(parsed.total).toBe(1);
    expect(parsed.events.map((event) => event.actions[0]).sort()).toEqual([
      'completed',
      'created',
      'rescheduled',
    ]);

    const log = {
      leadId,
      activityId: randomUUID(),
      requestId: randomUUID(),
      command: 'log',
      data: {
        kind: 'whatsapp',
        summary: 'Employee recorded a discussion',
        occurred_at: new Date(Date.now() - 1000).toISOString(),
        outcome: null,
        notes: null,
      },
    };

    const logged = await client.rpc('crm_log_manual_activity', { p_input: log });

    expect(logged.error).toBeNull();
    expect(manualActivitySaveSchema.parse(logged.data).activity.follow_up_id).toBeNull();

    const activityPage = await client.rpc('crm_manual_activity_page', { p_lead_id: leadId });

    expect(activityPage.error).toBeNull();

    const activities = manualActivityPageSchema.parse(activityPage.data);

    expect(activities.total).toBe(2);
    expect(activities.rows.filter((row) => row.kind === 'follow_up')).toHaveLength(1);

    expect((await stranger.rpc('crm_log_manual_activity', { p_input: log })).error?.code).toBe(
      '42501',
    );
  } finally {
    await fixtures.cleanup();
  }
});
