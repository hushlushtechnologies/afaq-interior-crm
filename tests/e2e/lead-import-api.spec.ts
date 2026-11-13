import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createImportFixtures } from '../helpers/import-fixtures';
import {
  importConfirmResultSchema,
  importPageSchema,
  importStageResultSchema,
} from '../../src/features/lead-import/contracts';

test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(120000);

const origin = 'http://127.0.0.1:3100';
const path = '/api/leads/imports';
function metadata(assignedUserId: string | null = null) {
  return {
    requestId: randomUUID(),
    filename: 'fixture.csv',
    sourceCode: 'manual',
    assignedUserId,
    defaultInquiryOn: '2026-11-12',
    mapping: { customer_name: 0, email: 1 },
  };
}
async function stage(api: APIRequestContext, input: ReturnType<typeof metadata>, text: string) {
  return api.post(path, {
    headers: {
      origin,
      'content-type': 'application/octet-stream',
      'x-lead-import': encodeURIComponent(JSON.stringify(input)),
    },
    data: Buffer.from(text),
  });
}
async function confirm(
  api: APIRequestContext,
  batchId: string,
  version: number,
  skips: number[],
  requestId = randomUUID(),
) {
  return api.patch(path, {
    headers: { origin, 'content-type': 'application/json' },
    data: { requestId, batchId, version, skips },
  });
}

test('HTTP staging reparses bytes, protects uploads and confirms explicitly skipped invalid rows once', async ({
  page,
  context,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    await signInLocalAccount(page, await fixtures.account());
    const input = metadata();
    const text = `Name,Email\nSynthetic import,${randomUUID()}@example.test\nX,invalid`;
    const stagedResponse = await stage(context.request, input, text);
    expect(stagedResponse.status()).toBe(200);
    const staged = importStageResultSchema.parse((await stagedResponse.json()).data);
    expect(staged.batch.counts).toMatchObject({ total: 2, ready: 1, invalid: 1 });
    const batchId = staged.batch.id;
    expect(
      importStageResultSchema.parse((await (await stage(context.request, input, text)).json()).data)
        .replayed,
    ).toBe(true);
    expect((await confirm(context.request, batchId, 1, [])).status()).toBe(400);
    const requestId = randomUUID();
    const confirmed = importConfirmResultSchema.parse(
      (await (await confirm(context.request, batchId, 1, [3], requestId)).json()).data,
    );
    expect(confirmed).toMatchObject({
      applied: 1,
      skipped: 1,
      requiresReview: false,
      replayed: false,
    });
    const replay = importConfirmResultSchema.parse(
      (await (await confirm(context.request, batchId, 1, [3], requestId)).json()).data,
    );
    expect(replay.replayed).toBe(true);
    const saved = await context.request.get(`${path}?batchId=${batchId}&page=0`);
    expect(saved.headers()['cache-control']).toContain('no-store');
    const batch = importPageSchema.parse((await saved.json()).data);
    expect(batch.rows.map((row) => row.status)).toEqual(['applied', 'skipped']);
    expect(batch.events.map((event) => event.action)).toEqual(['confirmed', 'staged']);
    const forged = { ...metadata(), rows: [] };
    expect((await stage(context.request, forged, text)).status()).toBe(400);
    expect((await stage(context.request, metadata(), 'Name,Email\n"not closed')).status()).toBe(
      400,
    );
    expect((await stage(context.request, metadata(), 'A'.repeat(1024 * 1024 + 1))).status()).toBe(
      413,
    );
    expect(
      (
        await context.request.post(path, {
          headers: { origin: 'https://untrusted.example' },
          data: text,
        })
      ).status(),
    ).toBe(403);
  } finally {
    await fixtures.cleanup();
  }
});

test('concurrent batch confirmations create one lead and send the competing batch back to review', async ({
  page,
  context,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    await signInLocalAccount(page, await fixtures.account());
    const email = `${randomUUID()}@example.test`;
    const first = importStageResultSchema.parse(
      (await (await stage(context.request, metadata(), `Name,Email\nFirst,${email}`)).json()).data,
    );
    const second = importStageResultSchema.parse(
      (await (await stage(context.request, metadata(), `Name,Email\nSecond,${email}`)).json()).data,
    );
    const responses = await Promise.all([
      confirm(context.request, first.batch.id, 1, []),
      confirm(context.request, second.batch.id, 1, []),
    ]);
    const results = await Promise.all(
      responses.map(async (response) => {
        expect(response.status()).toBe(200);
        return importConfirmResultSchema.parse((await response.json()).data);
      }),
    );
    expect(results.reduce((sum, result) => sum + result.applied, 0)).toBe(1);
    const held = results.find((result) => result.requiresReview)!;
    expect(held.batch.counts.review).toBe(1);
    const skipped = importConfirmResultSchema.parse(
      (await (await confirm(context.request, held.batch.id, held.batch.version, [2])).json()).data,
    );
    expect(skipped).toMatchObject({ applied: 0, skipped: 1, requiresReview: false });
  } finally {
    await fixtures.cleanup();
  }
});

test('Sales ownership, cross-import access, reassignment redaction and permission revocation remain enforced', async ({
  page,
  context,
}) => {
  const fixtures = createImportFixtures(origin);
  try {
    const admin = await fixtures.account();
    const sales = await fixtures.account('sales_executive');
    await signInLocalAccount(page, sales);
    const text = `Name,Email\nScoped fixture,${randomUUID()}@example.test`;
    expect((await stage(context.request, metadata(admin.id), text)).status()).toBe(403);
    const staged = importStageResultSchema.parse(
      (await (await stage(context.request, metadata(sales.id), text)).json()).data,
    );
    const requestId = randomUUID();
    expect((await confirm(context.request, staged.batch.id, 1, [], requestId)).status()).toBe(200);
    let saved = importPageSchema.parse(
      (await (await context.request.get(`${path}?batchId=${staged.batch.id}&page=0`)).json()).data,
    );
    const leadId = saved.rows[0].resulting_lead_id!;
    const client = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect((await client.auth.signInWithPassword(admin)).error).toBeNull();
    const assigned = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'assign',
      p_lead_id: leadId,
      p_version: 1,
      p_data: { assigned_user_id: admin.id },
    });
    expect(assigned.error).toBeNull();
    saved = importPageSchema.parse(
      (await (await context.request.get(`${path}?batchId=${staged.batch.id}&page=0`)).json()).data,
    );
    expect(saved.rows[0]).toMatchObject({ redacted: true, data: null, resulting_lead_id: null });
    expect(
      (await client.rpc('crm_lead_import_page', { p_batch_id: staged.batch.id, p_page: 0 })).error
        ?.code,
    ).toBe('42501');
    expect(
      (
        await client.rpc('crm_change_user_role', {
          p_email: sales.email,
          p_role_key: 'sales_executive',
          p_operation: 'revoke',
        })
      ).error,
    ).toBeNull();
    expect((await context.request.get(`${path}?batchId=${staged.batch.id}&page=0`)).status()).toBe(
      403,
    );
    expect((await confirm(context.request, staged.batch.id, 1, [], requestId)).status()).toBe(403);
    await client.auth.signOut();
  } finally {
    await fixtures.cleanup();
  }
});
