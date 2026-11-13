import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createAttachmentWorkflow } from '../../src/features/lead-attachments/workflow';

function fixtures(baseURL: string) {
  const users = createLeadFixtures(baseURL);
  const leads: string[] = [];
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    'http://127.0.0.1:57421',
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    options,
  );

  return {
    account: users.account,

    async seed(role: 'super_admin' | 'sales_executive') {
      const actor = await users.account(role);
      const client = createClient(
        'http://127.0.0.1:57421',
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        options,
      );

      if ((await client.auth.signInWithPassword(actor)).error)
        throw new Error('Fixture sign-in failed.');

      const saved = await client.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'create',
        p_lead_id: null,
        p_version: null,
        p_data: {
          customer_name: 'Reference browser fixture',
          assigned_user_id: actor.id,
          source_code: 'manual',
          priority: 'normal',
          inquiry_on: '2026-11-10',
        },
      });

      if (saved.error) throw new Error('Fixture lead failed.');

      const leadId: string = saved.data.lead.id;

      if (!/^[a-f0-9-]{36}$/.test(leadId)) throw new Error('Invalid fixture identity.');

      leads.push(leadId);

      const roomId = randomUUID();
      const visitId = randomUUID();

      const room = await client.rpc('crm_save_lead_detail', {
        p_input: {
          requestId: randomUUID(),
          leadId,
          recordId: roomId,
          command: 'save_room',
          version: null,
          data: {
            name: 'Living room',
            room_type: null,
            sort_order: 0,
            requirements_notes: null,
            measurement_notes: null,
            deliverables_notes: null,
          },
        },
      });

      if (room.error) throw new Error('Fixture room failed.');

      const visit = await client.rpc('crm_save_site_visit', {
        p_input: {
          requestId: randomUUID(),
          leadId,
          visitId,
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
      });

      if (visit.error) throw new Error('Fixture visit failed.');

      const bytes = await sharp({
        create: { width: 8, height: 8, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer();

      const file = await createAttachmentWorkflow(admin, actor.id).upload(
        {
          requestId: randomUUID(),
          leadId,
          filename: 'Reference.png',
          declaredMime: 'image/png',
          declaredBytes: bytes.length,
        },
        bytes,
      );

      return { actor, client, leadId, roomId, visitId, attachmentId: file.id };
    },

    async cleanup() {
      for (const id of leads) {
        const files = await admin.storage.from('crm-private').list(id, { limit: 100 });

        if (files.error) throw new Error('Fixture Storage listing failed.');

        if (
          files.data.length &&
          (
            await admin.storage
              .from('crm-private')
              .remove(files.data.map((file) => `${id}/${file.name}`))
          ).error
        )
          throw new Error('Fixture cleanup failed.');
      }

      await users.cleanup();
    },
  };
}

const test = base.extend<{ refs: ReturnType<typeof fixtures> }>({
  refs: async ({ baseURL }, provide) => {
    const f = fixtures(baseURL!);

    try {
      await provide(f);
    } finally {
      await f.cleanup();
    }
  },
});

test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

test.setTimeout(120000);

test('room/visit references retain retry identity, unlink history and finalized evidence', async ({
  page,
  refs,
}) => {
  const f = await refs.seed('super_admin');

  await signInLocalAccount(page, f.actor);
  await page.goto(`/leads/details/${f.leadId}`);

  const panel = page.getByRole('region', { name: 'Private attachments', exact: true });

  await expect(panel.getByText('Reference.png', { exact: true })).toBeVisible();

  const summary = panel.getByText('Room and site-visit references', { exact: true });

  await summary.click();
  await expect(panel.getByLabel('Reference target', { exact: true })).toBeEnabled();
  await panel.getByLabel('Reference target', { exact: true }).selectOption(f.roomId);

  const ids: string[] = [];

  await page.route('**/leads/details/**', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (request.method() !== 'POST' || !body.includes('"command":"link"') || !id)
      return route.continue();

    ids.push(id);

    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });

  await panel.getByRole('button', { name: 'Link reference', exact: true }).click();

  await expect(panel.getByRole('button', { name: 'Retry same reference request' })).toBeEnabled();

  await summary.click();
  await summary.click();

  await panel.getByRole('button', { name: 'Retry same reference request' }).click();

  await expect(panel.getByText('Room: Living room', { exact: true })).toHaveCount(1);

  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);

  await panel.getByRole('button', { name: 'Unlink reference', exact: true }).click();

  await expect(panel.getByText('Unlinked — history retained', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Download attachment' })).toBeEnabled();

  await panel.getByLabel('Reference type', { exact: true }).selectOption('visit');
  await expect(panel.getByLabel('Reference target', { exact: true })).toBeEnabled();
  await panel.getByLabel('Reference target', { exact: true }).selectOption(f.visitId);

  await panel.getByRole('button', { name: 'Link reference', exact: true }).click();

  await expect(
    panel
      .getByRole('list', { name: 'File references' })
      .getByRole('listitem')
      .filter({ hasText: 'Site visit:' }),
  ).toHaveCount(1);

  const completed = await f.client.rpc('crm_save_site_visit', {
    p_input: {
      requestId: randomUUID(),
      leadId: f.leadId,
      visitId: f.visitId,
      command: 'complete',
      version: 1,
      data: {
        actual_at: new Date(Date.now() - 3600000).toISOString(),
        outcome: 'Synthetic visit evidence recorded',
      },
    },
  });

  expect(Boolean(completed.error)).toBe(false);

  await panel.getByRole('button', { name: 'Reload references', exact: true }).click();

  const visitLink = panel
    .getByRole('list', { name: 'File references' })
    .getByRole('listitem')
    .filter({ hasText: 'Site visit:' });

  await expect(visitLink.getByRole('button', { name: 'Unlink reference' })).toHaveCount(0);

  await expect(
    panel.getByLabel('Reference target').locator(`option[value="${f.visitId}"]`),
  ).toBeDisabled();
});

test('Sales links permitted rooms; read-only managers and unrelated employees cannot change references', async ({
  page,
  browser,
  refs,
  baseURL,
}) => {
  const f = await refs.seed('sales_executive');

  await signInLocalAccount(page, f.actor);
  await page.goto(`/leads/details/${f.leadId}`);

  const panel = page.getByRole('region', { name: 'Private attachments', exact: true });

  await expect(panel.getByText('Reference.png', { exact: true })).toBeVisible();

  await panel.getByText('Room and site-visit references', { exact: true }).click();
  await expect(panel.getByLabel('Reference target')).toBeEnabled();
  await panel.getByLabel('Reference target').selectOption(f.roomId);

  await panel.getByRole('button', { name: 'Link reference', exact: true }).click();

  await expect(panel.getByText('Room: Living room', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Unlink reference' })).toHaveCount(0);

  for (const role of ['management_director', 'sales_executive'] as const) {
    const actor = await refs.account(role);
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });

    try {
      const other = await context.newPage();

      await signInLocalAccount(other, actor);
      await other.goto(`/leads/details/${f.leadId}`);

      if (role === 'management_director') {
        const section = other.getByRole('region', { name: 'Private attachments', exact: true });

        await expect(section.getByText('Reference.png', { exact: true })).toBeVisible();
        await section.getByText('Room and site-visit references', { exact: true }).click();

        await expect(section.getByText('Room: Living room', { exact: true })).toBeVisible();

        await expect(
          section.getByRole('button', { name: 'Link reference', exact: true }),
        ).toHaveCount(0);

        await expect(section.getByRole('button', { name: 'Unlink reference' })).toHaveCount(0);
      } else
        await expect(
          other.getByRole('region', { name: 'Private attachments', exact: true }),
        ).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});
