import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { leadFieldsSchema } from '@/features/leads/schemas';

// Node-only protocol utilities. Production consumers must import ./server.
// These functions neither persist events nor authorize database writes.
export const CAPTURE_LIMITS = {
  metaBytes: 64 * 1024,
  websiteBytes: 16 * 1024,
  metaChanges: 100,
  websiteSkewSeconds: 300,
} as const;
export const WEBSITE_CAPTURE_PATH = '/api/integrations/website/leads';
const secret = z.string().regex(/^[\x21-\x7e]{32,256}$/);
const id = z.string().regex(/^[1-9][0-9]{0,63}$/);
const metaId = z
  .union([id, z.number().int().positive().max(Number.MAX_SAFE_INTEGER)])
  .transform(String);
const seconds = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const pair = z.object({ pageId: id, formId: id }).strict();
const metaBinding = z
  .object({
    appSecret: secret,
    allowedForms: z
      .array(pair)
      .min(1)
      .max(1000)
      .refine(
        (pairs) => new Set(pairs.map((p) => `${p.pageId}:${p.formId}`)).size === pairs.length,
      ),
  })
  .strict();
const metaBody = z.object({
  object: z.literal('page'),
  entry: z
    .array(
      z.object({
        id: metaId,
        changes: z
          .array(
            z.object({
              field: z.literal('leadgen'),
              value: z.object({
                leadgen_id: metaId,
                page_id: metaId,
                form_id: metaId,
                created_time: seconds,
              }),
            }),
          )
          .min(1)
          .max(CAPTURE_LIMITS.metaChanges),
      }),
    )
    .min(1)
    .max(CAPTURE_LIMITS.metaChanges),
});
export type MetaLeadNotice = {
  provider: 'meta';
  pageId: string;
  formId: string;
  leadgenId: string;
  createdTime: number;
  eventKey: string;
};
const websiteHeaders = z
  .object({
    keyId: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/),
    requestId: z.uuid().refine((value) => value === value.toLowerCase()),
    timestamp: z.string().regex(/^(0|[1-9][0-9]{0,11})$/),
    signature: z.string().regex(/^v1=[0-9a-fA-F]{64}$/),
  })
  .strict();
const websiteBinding = z.object({ keyId: websiteHeaders.shape.keyId, secret }).strict();
const nullable = leadFieldsSchema.shape;
export const websiteInquirySchema = z
  .object({
    customer_name: nullable.customer_name,
    email: nullable.email.default(null),
    phone: nullable.phone.default(null),
    alternate_phone: nullable.alternate_phone.default(null),
    property_type: nullable.property_type.default(null),
    location: nullable.location.default(null),
    budget: nullable.budget.default(null),
    expected_start_on: nullable.expected_start_on.default(null),
    description: nullable.description.default(null),
  })
  .strict()
  .refine((value) => !value.expected_start_on?.startsWith('0000'), {
    message: 'Use a calendar year from 0001 onwards.',
    path: ['expected_start_on'],
  });
export type WebsiteCapture = {
  keyId: string;
  requestId: string;
  sentAt: number;
  bodyHash: string;
  eventKey: string;
  inquiry: z.infer<typeof websiteInquirySchema>;
};
function bounded(bytes: Uint8Array, limit: number) {
  return bytes.byteLength > 0 && bytes.byteLength <= limit;
}
function sameText(first: string, second: string) {
  const a = Buffer.from(first, 'utf8');
  const b = Buffer.from(second, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
function matchesHmac(message: Uint8Array | string, hex: string, key: string) {
  const expected = createHmac('sha256', key).update(message).digest();
  const supplied = Buffer.from(hex, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
function json(bytes: Uint8Array, integerTokensOnly = false): unknown {
  const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (integerTokensOnly) {
    // Remove JSON strings before inspecting numeric tokens. This catches raw
    // fractional/exponent encodings and rounding before JSON.parse loses them.
    const outsideStrings = value.replace(/"(?:\\[\s\S]|[^"\\])*"/g, '""');
    const tokens = outsideStrings.match(/-?[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/g) ?? [];
    if (
      tokens.some(
        (token) => !Number.isSafeInteger(Number(token)) || String(Number(token)) !== token,
      )
    ) {
      throw new Error('Unsupported numeric encoding.');
    }
  }
  return JSON.parse(value);
}
export function verifyMetaChallenge(query: unknown, verifyToken: string): string | null {
  if (!secret.safeParse(verifyToken).success) return null;
  const parsed = z
    .object({
      'hub.mode': z.literal('subscribe'),
      'hub.verify_token': z.string().min(1).max(256),
      'hub.challenge': z.string().regex(/^[0-9]{1,200}$/),
    })
    .strict()
    .safeParse(query);
  return parsed.success && sameText(parsed.data['hub.verify_token'], verifyToken)
    ? parsed.data['hub.challenge']
    : null;
}
export function verifyMetaLeadNotices(
  bytes: Uint8Array,
  signature: string | null,
  configuration: unknown,
): MetaLeadNotice[] | null {
  if (!bounded(bytes, CAPTURE_LIMITS.metaBytes)) return null;
  const config = metaBinding.safeParse(configuration);
  const digest = /^sha256=([0-9a-fA-F]{64})$/.exec(signature ?? '');
  if (!config.success || !digest || !matchesHmac(bytes, digest[1], config.data.appSecret))
    return null;
  try {
    const payload = metaBody.parse(json(bytes, true));
    const allowed = new Set(config.data.allowedForms.map((p) => `${p.pageId}:${p.formId}`));
    const notices = new Map<string, MetaLeadNotice>();
    let changes = 0;
    for (const entry of payload.entry)
      for (const change of entry.changes) {
        if (++changes > CAPTURE_LIMITS.metaChanges) return null;
        const value = change.value;
        if (entry.id !== value.page_id || !allowed.has(`${value.page_id}:${value.form_id}`))
          return null;
        const notice: MetaLeadNotice = {
          provider: 'meta',
          pageId: value.page_id,
          formId: value.form_id,
          leadgenId: value.leadgen_id,
          createdTime: value.created_time,
          eventKey: `meta:leadgen:${value.leadgen_id}`,
        };
        const previous = notices.get(notice.eventKey);
        if (previous && JSON.stringify(previous) !== JSON.stringify(notice)) return null;
        notices.set(notice.eventKey, notice);
      }
    return [...notices.values()];
  } catch {
    return null;
  }
}
export function verifyWebsiteCapture(
  bytes: Uint8Array,
  headers: unknown,
  configuration: unknown,
  context: unknown,
): WebsiteCapture | null {
  const receiver = z
    .object({
      method: z.literal('POST'),
      path: z.literal(WEBSITE_CAPTURE_PATH),
      nowSeconds: seconds,
    })
    .strict()
    .safeParse(context);
  if (!bounded(bytes, CAPTURE_LIMITS.websiteBytes) || !receiver.success) return null;
  const input = websiteHeaders.safeParse(headers);
  const config = websiteBinding.safeParse(configuration);
  if (!input.success || !config.success || !sameText(input.data.keyId, config.data.keyId))
    return null;
  const { keyId, requestId, timestamp, signature } = input.data;
  const sentAt = Number(timestamp);
  if (Math.abs(receiver.data.nowSeconds - sentAt) > CAPTURE_LIMITS.websiteSkewSeconds) return null;
  const bodyHash = createHash('sha256').update(bytes).digest('hex');
  const canonical = [
    'AFAQ-WEBSITE-LEAD-V1',
    'POST',
    WEBSITE_CAPTURE_PATH,
    keyId,
    requestId,
    timestamp,
    bodyHash,
  ].join('\n');
  if (!matchesHmac(canonical, signature.slice(3), config.data.secret)) return null;
  try {
    return {
      keyId,
      requestId,
      sentAt,
      bodyHash,
      eventKey: `website:request:${requestId}`,
      inquiry: websiteInquirySchema.parse(json(bytes)),
    };
  } catch {
    return null;
  }
}