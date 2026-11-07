import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { createAttachmentWorkflow } from '../../src/features/lead-attachments/workflow';

function sql(query: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-X',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}
async function fixtures() {
  // Validates the exact local API, project ID and configuration before privileged work.
  const users = createLeadFixtures('http://localhost:3000');
  const leadIds: string[] = [];
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    'http://127.0.0.1:57421',
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    options,
  );
  async function account(role: 'super_admin' | 'sales_executive' | 'management_director') {
    const user = await users.account(role);
    const client = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      options,
    );
    const signed = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    if (signed.error) throw new Error('Fixture sign-in failed.');
    return { user, client, workflow: createAttachmentWorkflow(admin, user.id) };
  }
  async function cleanup() {
    for (const leadId of leadIds) {
      const listed = await admin.storage.from('crm-private').list(leadId, { limit: 100 });
      if (listed.error) throw new Error('Fixture Storage cleanup listing failed.');
      const paths = listed.data.map((object) => `${leadId}/${object.name}`);
      if (paths.length && (await admin.storage.from('crm-private').remove(paths)).error) {
        throw new Error('Fixture Storage cleanup failed.');
      }
    }
    await users.cleanup();
  }
  try {
    const owner = await account('sales_executive');
    const root = await account('super_admin');
    const stranger = await account('sales_executive');
    const manager = await account('management_director');
    const saved = await root.client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'Synthetic attachment fixture',
        assigned_user_id: owner.user.id,
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-07',
      },
    });
    if (saved.error) throw new Error('Fixture lead creation failed.');
    const leadId = saved.data.lead.id as string;
    if (!/^[a-f0-9-]{36}$/.test(leadId)) throw new Error('Invalid fixture lead identity.');
    leadIds.push(leadId);
    return { admin, owner, root, stranger, manager, leadId, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
function request(leadId: string, bytes: Buffer, mime = 'image/png', filename = 'Reference.png') {
  return {
    leadId,
    requestId: randomUUID(),
    filename,
    declaredMime: mime,
    declaredBytes: bytes.length,
  };
}
async function png() {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: 'white' } })
    .png()
    .toBuffer();
}

test('all four formats upload, retry, download and remove through the protected gateway', async () => {
  const f = await fixtures();
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const files: [Buffer, string, string][] = [
      [Buffer.from(await pdf.save()), 'application/pdf', 'Reference.pdf'],
    ];
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      files.push([
        await sharp(await png())
          .toFormat(format)
          .toBuffer(),
        `image/${format}`,
        `Reference.${format}`,
      ]);
    }
    for (const [bytes, mime, filename] of files) {
      const input = request(f.leadId, bytes, mime, filename);
      const uploaded = await f.owner.workflow.upload(input, bytes);
      expect((await f.owner.workflow.upload(input, bytes)).id).toBe(uploaded.id);
      const ref = { leadId: f.leadId, attachmentId: uploaded.id };
      const signed = await f.owner.workflow.download(ref);
      const response = await fetch(signed.url);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')?.startsWith(mime)).toBe(true);
      expect(response.headers.get('content-disposition')?.includes('attachment')).toBe(true);
      expect(
        Boolean((await f.owner.client.storage.from('crm-private').list(f.leadId)).data?.length),
      ).toBe(false);
      await expect(
        f.owner.workflow.remove({ ...ref, requestId: randomUUID(), version: 1 }),
      ).rejects.toThrow();
      const removal = { ...ref, requestId: randomUUID(), version: 1 };
      await f.root.workflow.remove(removal);
      await f.root.workflow.remove(removal);
      await expect(f.owner.workflow.download(ref)).rejects.toThrow();
      expect(
        sql(
          `select string_agg(action,',' order by id) from crm_sales.attachment_events where attachment_id='${uploaded.id}'`,
        ),
      ).toBe('uploaded,download_access_issued,removed');
    }
    expect(
      (await f.owner.client.rpc('crm_lead_attachments', { p_lead_id: f.leadId, p_removed: true }))
        .data.total,
    ).toBe(4);
  } finally {
    await f.cleanup();
  }
});

test('unrelated Sales, read-only managers and direct employee finalization are rejected', async () => {
  const f = await fixtures();
  try {
    const bytes = await png();
    await expect(f.stranger.workflow.upload(request(f.leadId, bytes), bytes)).rejects.toThrow();
    await expect(f.manager.workflow.upload(request(f.leadId, bytes), bytes)).rejects.toThrow();
    const uploaded = await f.owner.workflow.upload(request(f.leadId, bytes), bytes);
    const ref = { leadId: f.leadId, attachmentId: uploaded.id };
    await expect(f.stranger.workflow.download(ref)).rejects.toThrow();
    await expect(f.owner.workflow.download({ ...ref, leadId: randomUUID() })).rejects.toThrow();
    const forged = await f.owner.client.rpc('crm_attachment_gateway', {
      p_actor: f.root.user.id,
      p_operation: 'finish',
      p_input: ref,
    });
    expect(Boolean(forged.error)).toBe(true);
    const pending = request(f.leadId, bytes);
    await expect(
      f.owner.workflow.upload({ ...pending, filename: '../Reference.png' }, bytes),
    ).rejects.toThrow();
  } finally {
    await f.cleanup();
  }
});

test('failed finalization cleans up; a lost committed response preserves the object and safe retry', async () => {
  const f = await fixtures();
  try {
    for (const committed of [false, true]) {
      let intercepted = false;
      const proxy = new Proxy(f.admin, {
        get(target, property) {
          if (property === 'rpc')
            return async (name: string, args: Record<string, unknown>) => {
              if (
                !intercepted &&
                name === 'crm_attachment_gateway' &&
                args.p_operation === 'finish'
              ) {
                intercepted = true;
                if (committed) {
                  const saved = await target.rpc(name, args);
                  if (saved.error) throw new Error('Fault fixture could not commit.');
                }
                return { data: null, error: { code: 'TEST_LOST_RESPONSE' } };
              }
              return target.rpc(name, args);
            };
          return Reflect.get(target, property);
        },
      });
      const workflow = createAttachmentWorkflow(proxy, f.owner.user.id);
      const bytes = await png();
      const input = request(f.leadId, bytes);
      await expect(workflow.upload(input, bytes)).rejects.toThrow();
      const state = sql(
        `select state from crm_sales.attachments where actor_id='${f.owner.user.id}' and request_id='${input.requestId}'`,
      );
      expect(state).toBe(committed ? 'ready' : 'failed');
      if (committed) {
        const replay = await workflow.upload(input, bytes);
        expect(
          (
            await fetch(
              (await workflow.download({ leadId: f.leadId, attachmentId: replay.id })).url,
            )
          ).status,
        ).toBe(200);
      } else {
        const path = sql(
          `select storage_path from crm_sales.attachments where actor_id='${f.owner.user.id}' and request_id='${input.requestId}'`,
        );
        expect(Boolean((await f.admin.storage.from('crm-private').download(path)).error)).toBe(
          true,
        );
      }
    }
  } finally {
    await f.cleanup();
  }
});