import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getApplicationOrigin } from '@/lib/supabase/server-config';
import { createAttachmentWorkflow } from './workflow';
import { z } from 'zod';
import { attachmentPageSchema } from './contracts';

// Local-only until a separate production security/deployment decision is approved.
export async function getLocalAttachmentWorkflow() {
  const app = new URL(getApplicationOrigin());
  const config = readFileSync(resolve('supabase/config.toml'), 'utf8');
  if (
    process.env.ENABLE_LOCAL_LEAD_ATTACHMENTS !== 'true' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:57421' ||
    app.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(app.hostname) ||
    !/^project_id\s*=\s*"afaq-interiors-crm-s09-local"\s*$/m.test(config)
  ) {
    throw new Error('Local attachment operations are disabled.');
  }
  const employee = await createSupabaseServerClient();
  const { data, error } = await employee.auth.getUser();
  if (error || !data.user) throw new Error('Sign in with an active employee account.');
  const key = process.env.SUPABASE_LOCAL_TEST_SECRET_KEY?.trim();
  if (!key) throw new Error('The local administrative binding is unavailable.');
  const admin = createClient('http://127.0.0.1:57421', key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    ...createAttachmentWorkflow(admin, data.user.id),
    async authorizeUpload(leadId: string) {
      z.uuid().parse(leadId);
      const attempt = await admin.rpc('crm_attachment_upload_attempt', {
        p_actor: data.user.id,
        p_lead_id: leadId,
      });
      if (attempt.error) {
        if (attempt.error.code === '54000')
          throw new Error('Upload attempt limit reached. Wait one minute.');
        throw new Error('Your current account cannot upload to this lead.');
      }
    },
    async list(leadId: string, page: number, removed: boolean) {
      const result = await employee.rpc('crm_lead_attachments', {
        p_lead_id: leadId,
        p_page: page,
        p_removed: removed,
      });
      if (result.error) {
        if (result.error.code === '42501')
          throw new Error('Your current account cannot access this lead.');
        throw new Error('Attachment listing is unavailable.');
      }
      return attachmentPageSchema.parse(result.data);
    },
  };
}

export async function uploadLocalAttachment(input: unknown, bytes: Buffer) {
  const workflow = await getLocalAttachmentWorkflow();
  const leadId = z.object({ leadId: z.uuid() }).parse(input).leadId;
  await workflow.authorizeUpload(leadId);
  return workflow.upload(input, bytes);
}

export async function downloadLocalAttachment(input: unknown) {
  return (await getLocalAttachmentWorkflow()).download(input);
}

export async function removeLocalAttachment(input: unknown) {
  return (await getLocalAttachmentWorkflow()).remove(input);
}
