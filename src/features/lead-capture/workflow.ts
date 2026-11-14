import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { getSupabasePublicConfig } from '@/lib/supabase/public-config';
import { retrieveMetaInquiry } from './meta-adapter';
import {
  verifyMetaChallenge,
  verifyMetaLeadNotices,
  verifyWebsiteCapture,
  websiteInquirySchema,
  WEBSITE_CAPTURE_PATH,
} from './verification';

export class CaptureError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const bindingSchema = z
  .object({
    email: z.email(),
    password: z.string().min(20),
    secret: z.string().min(32).max(256),
    keyId: z.string().optional(),
    verifyToken: z.string().min(32).optional(),
    apiVersion: z
      .string()
      .regex(/^v[1-9][0-9]?\.0$/)
      .optional(),
    fixtures: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
const connectionSchema = z.object({
  id: z.uuid(),
  provider: z.enum(['website', 'meta']),
  binding: z.string(),
  page_id: z.string().nullable(),
  form_id: z.string().nullable(),
});
export function localCapture() {
  if (
    process.env.ENABLE_LOCAL_LEAD_CAPTURE !== 'true' ||
    !/^http:\/\/(127\.0\.0\.1|localhost):57421$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  )
    throw new CaptureError(404, 'Local capture is disabled.');
}
function privateSettings() {
  localCapture();
  try {
    return z
      .object({
        bindings: z.record(z.string().regex(/^CAPTURE_[A-Z0-9_]{1,60}$/), bindingSchema),
        connections: z.record(z.uuid(), z.string()),
        workerSecret: z.string().min(32).max(256),
      })
      .strict()
      .parse(
        JSON.parse(
          readFileSync(
            /* turbopackIgnore: true */
            process.env.LOCAL_CAPTURE_CONFIG_FILE ?? join(tmpdir(), 'afaq-local-capture.json'),
            'utf8',
          ),
        ),
      );
  } catch {
    throw new CaptureError(503, 'Private local capture configuration unavailable.');
  }
}
function settings(id: string) {
  if (!z.uuid().safeParse(id).success) throw new CaptureError(400, 'Invalid connection.');
  const config = privateSettings();
  const key = config.connections[id];
  const binding = config.bindings[key];
  if (!binding) throw new CaptureError(404, 'Connection unavailable.');
  return { binding, key };
}

async function principal(id: string) {
  const { binding, key } = settings(id);
  const config = getSupabasePublicConfig();
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({
    email: binding.email,
    password: binding.password,
  });
  if (signed.error) throw new CaptureError(503, 'Capture identity unavailable.');
  const read = await client.rpc('crm_capture_binding', { p_id: id });
  const connection = connectionSchema.safeParse(read.data);
  if (read.error || !connection.success || connection.data.binding !== key)
    throw new CaptureError(403, 'Capture authority unavailable.');
  return { client, binding, connection: connection.data };
}
function assertRpc(error: { code?: string } | null) {
  if (!error) return;
  throw new CaptureError(
    error.code === '42501'
      ? 403
      : error.code === '22023'
        ? 409
        : error.code === 'P0001'
          ? 429
          : 503,
    'Capture request was not accepted.',
  );
}
export async function receiveWebsite(
  id: string,
  headers: Headers,
  bytes: Uint8Array,
  path: string,
) {
  const { binding } = settings(id);
  const verified = verifyWebsiteCapture(
    bytes,
    {
      keyId: headers.get('x-afaq-key-id'),
      requestId: headers.get('x-afaq-request-id'),
      timestamp: headers.get('x-afaq-timestamp'),
      signature: headers.get('x-afaq-signature'),
    },
    { keyId: binding.keyId, secret: binding.secret },
    { method: 'POST', path, nowSeconds: Math.floor(Date.now() / 1000) },
  );
  if (!verified || path !== WEBSITE_CAPTURE_PATH)
    throw new CaptureError(403, 'Capture verification failed.');
  const { client, connection } = await principal(id);
  if (connection.provider !== 'website')
    throw new CaptureError(403, 'Capture verification failed.');
  const result = await client.rpc('crm_capture_stage', {
    p_id: id,
    p_key: verified.eventKey,
    p_digest: verified.bodyHash,
    p_metadata: {},
    p_inquiry: verified.inquiry,
  });
  assertRpc(result.error);
  return result.data as unknown;
}
export async function challengeMeta(id: string, query: Record<string, string>) {
  const { binding, connection } = await principal(id);
  if (connection.provider !== 'meta') throw new CaptureError(403, 'Capture verification failed.');
  const challenge = verifyMetaChallenge(query, binding.verifyToken ?? '');
  if (challenge === null) throw new CaptureError(403, 'Capture verification failed.');
  return challenge;
}
export async function receiveMeta(id: string, signature: string | null, bytes: Uint8Array) {
  const { binding } = settings(id);
  // Verify against the database-approved pair after authenticating the non-employee principal.
  const { client, connection } = await principal(id);
  if (connection.provider !== 'meta') throw new CaptureError(403, 'Capture verification failed.');
  const notices = verifyMetaLeadNotices(bytes, signature, {
    appSecret: binding.secret,
    allowedForms: [{ pageId: connection.page_id, formId: connection.form_id }],
  });
  if (!notices) throw new CaptureError(403, 'Capture verification failed.');
  const events = notices.map((notice) => {
    const metadata = {
      pageId: notice.pageId,
      formId: notice.formId,
      leadgenId: notice.leadgenId,
      createdTime: notice.createdTime,
    };
    return {
      key: notice.eventKey,
      digest: createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
      metadata,
    };
  });
  const result = await client.rpc('crm_capture_stage_batch', { p_id: id, p_events: events });
  assertRpc(result.error);
  return { accepted: events.length, receipts: result.data as unknown };
}

const jobsSchema = z
  .array(
    z.object({
      id: z.uuid(),
      lease: z.uuid(),
      metadata: z.record(z.string(), z.unknown()),
      inquiry: websiteInquirySchema.nullable(),
    }),
  )
  .max(10);
export async function processCapture(id: string) {
  const { client, binding, connection } = await principal(id);
  const claimed = await client.rpc('crm_capture_claim', { p_id: id });
  assertRpc(claimed.error);
  const jobs = jobsSchema.parse(claimed.data);
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      const inquiry =
        connection.provider === 'website'
          ? websiteInquirySchema.parse(job.inquiry)
          : await retrieveMetaInquiry(
              String(job.metadata.leadgenId),
              connection.form_id ?? '',
              binding.apiVersion ?? 'v1.0',
              async (url) => {
                // No real fetch/token is used. Fixtures are private server configuration only.
                const key = new URL(url).pathname.split('/').at(-1) ?? '';
                if (!binding.fixtures || !(key in binding.fixtures))
                  throw new Error('Synthetic provider response unavailable.');
                return binding.fixtures[key];
              },
            );
      const result = await client.rpc('crm_capture_finish', {
        p_event: job.id,
        p_lease: job.lease,
        p_inquiry: inquiry,
      });
      assertRpc(result.error);
      succeeded++;
    } catch {
      const result = await client.rpc('crm_capture_fail', {
        p_event: job.id,
        p_lease: job.lease,
        p_code: 'processing_failed',
      });
      assertRpc(result.error);
      failed++;
    }
  }
  return { claimed: jobs.length, succeeded, failed };
}
export function verifyWorker(bytes: Uint8Array, signature: string | null) {
  localCapture();
  const secret = privateSettings().workerSecret;
  if (!secret || secret.length < 32 || !signature || !/^[0-9a-f]{64}$/.test(signature))
    throw new CaptureError(403, 'Worker verification failed.');
  const expected = createHmac('sha256', secret).update(bytes).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    throw new CaptureError(403, 'Worker verification failed.');
  const input = z
    .object({ connectionId: z.uuid(), at: z.number().int(), nonce: z.uuid() })
    .strict()
    .safeParse(JSON.parse(Buffer.from(bytes).toString('utf8')));
  if (!input.success || Math.abs(Date.now() / 1000 - input.data.at) > 60)
    throw new CaptureError(403, 'Worker verification failed.');
  return input.data.connectionId;
}
export async function captureBody(request: Request, max = 16384) {
  localCapture();
  const reader = request.body?.getReader();
  if (!reader) throw new CaptureError(400, 'Request body required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CaptureError(408, 'Capture request timed out.')), 15000);
  });
  try {
    while (true) {
      const read = await Promise.race([reader.read(), timeout]);
      if (read.done) break;
      size += read.value.byteLength;
      if (size > max) throw new CaptureError(413, 'Capture request exceeds its byte limit.');
      chunks.push(read.value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}