import { createHash, createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  CAPTURE_LIMITS,
  WEBSITE_CAPTURE_PATH,
  verifyMetaChallenge,
  verifyMetaLeadNotices,
  verifyWebsiteCapture,
} from '../../src/features/lead-capture/verification';

const key = 'synthetic-local-capture-secret-00000001';
const token = 'synthetic-local-verify-token-000000001';
const metaConfig = { appSecret: key, allowedForms: [{ pageId: '100', formId: '200' }] };
const text = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const hmac = (value: Uint8Array | string, secret = key) =>
  createHmac('sha256', secret).update(value).digest('hex');
const notice = (lead: string | number = '300') => ({
  field: 'leadgen',
  value: { leadgen_id: lead, page_id: '100', form_id: '200', created_time: 1700000000 },
});
const meta = (changes = [notice()]) => ({ object: 'page', entry: [{ id: '100', changes }] });
const verifiedMeta = (payload: unknown) => {
  const body = text(payload);
  return verifyMetaLeadNotices(body, `sha256=${hmac(body)}`, metaConfig);
};
const websiteConfig = { keyId: 'local-site', secret: key };
const requestId = 'b811f203-2fc6-4d13-a903-00c85ee90890';
const now = 1800000000;
const context = { method: 'POST', path: WEBSITE_CAPTURE_PATH, nowSeconds: now };

function websiteHeaders(
  body: Uint8Array,
  options: { timestamp?: string; path?: string; method?: string; requestId?: string } = {},
) {
  const timestamp = options.timestamp ?? String(now);
  const id = options.requestId ?? requestId;
  const digest = createHash('sha256').update(body).digest('hex');
  const canonical = [
    'AFAQ-WEBSITE-LEAD-V1',
    options.method ?? 'POST',
    options.path ?? WEBSITE_CAPTURE_PATH,
    websiteConfig.keyId,
    id,
    timestamp,
    digest,
  ].join('\n');
  return {
    keyId: websiteConfig.keyId,
    requestId: id,
    timestamp,
    signature: `v1=${hmac(canonical)}`,
  };
}

const inquiry = text({
  customer_name: 'Synthetic inquiry',
  email: 'PERSON@example.test',
  phone: '+971501234567',
});

test('Meta challenge returns only the challenge for a valid configured token and mode', () => {
  const query = { 'hub.mode': 'subscribe', 'hub.verify_token': token, 'hub.challenge': '1234567' };
  expect(verifyMetaChallenge(query, token)).toBe('1234567');
  for (const changed of [
    { 'hub.mode': 'unsubscribe' },
    { 'hub.verify_token': 'wrong' },
    { 'hub.challenge': '<script>' },
    { extra: 'value' },
  ]) {
    expect(verifyMetaChallenge({ ...query, ...changed }, token)).toBeNull();
  }
  expect(verifyMetaChallenge(query, '')).toBeNull();
});

test('Meta notifications verify exact bytes and return only bounded identifiers', () => {
  const result = verifiedMeta(meta());
  expect(result).toEqual([
    {
      provider: 'meta',
      pageId: '100',
      formId: '200',
      leadgenId: '300',
      createdTime: 1700000000,
      eventKey: 'meta:leadgen:300',
    },
  ]);
  const body = text(meta());
  expect(
    verifyMetaLeadNotices(new Uint8Array([...body, 32]), `sha256=${hmac(body)}`, metaConfig),
  ).toBeNull();
  expect(verifyMetaLeadNotices(body, `sha256=${hmac(body, token)}`, metaConfig)).toBeNull();
  expect(verifyMetaLeadNotices(body, `sha256=${'0'.repeat(64)}`, metaConfig)).toBeNull();
});

test('Meta signatures reject missing, short, alternate-algorithm and malformed values', () => {
  const body = text(meta());
  for (const signature of [null, '', 'sha1=abc', 'sha256=xyz', 'sha256=' + 'a'.repeat(63)]) {
    expect(verifyMetaLeadNotices(body, signature, metaConfig)).toBeNull();
  }
  expect(
    verifyMetaLeadNotices(body, `sha256=${hmac(body)}`, { ...metaConfig, appSecret: '' }),
  ).toBeNull();
});

test('Meta rejects unsupported objects, fields, Page/form pairs and inconsistent page IDs atomically', () => {
  expect(verifiedMeta({ ...meta(), object: 'user' })).toBeNull();
  expect(verifiedMeta(meta([{ ...notice(), field: 'feed' }]))).toBeNull();
  expect(
    verifiedMeta(
      meta([notice(), { ...notice('301'), value: { ...notice('301').value, form_id: '201' } }]),
    ),
  ).toBeNull();
  expect(verifiedMeta({ object: 'page', entry: [{ id: '101', changes: [notice()] }] })).toBeNull();
  expect(
    verifyMetaLeadNotices(text(meta()), `sha256=${hmac(text(meta()))}`, {
      ...metaConfig,
      allowedForms: [],
    }),
  ).toBeNull();
});

test('Meta IDs preserve string precision and accept only safe numeric identifiers', () => {
  expect(verifiedMeta(meta([notice('12345678901234567890')]))?.[0].leadgenId).toBe(
    '12345678901234567890',
  );
  expect(verifiedMeta(meta([notice(300)]))?.[0].leadgenId).toBe('300');
  expect(verifiedMeta(meta([notice(Number.MAX_SAFE_INTEGER + 1)]))).toBeNull();
  expect(verifiedMeta(meta([notice('0300')]))).toBeNull();
});

test('Meta repeated notices share stable keys; conflicting contexts do not produce partial output', () => {
  expect(verifiedMeta(meta([notice(), notice()]))).toHaveLength(1);
  const conflicting = meta([
    notice(),
    { ...notice(), value: { ...notice().value, created_time: 1700000001 } },
  ]);
  expect(verifiedMeta(conflicting)).toBeNull();
  expect(verifiedMeta(meta([notice()]))?.[0].eventKey).toBe(
    verifiedMeta(meta([notice(300)]))?.[0].eventKey,
  );
});

test('Meta enforces byte/change bounds and rejects malformed or invalid UTF-8 even when signed', () => {
  const oversized = new Uint8Array(CAPTURE_LIMITS.metaBytes + 1);
  expect(verifyMetaLeadNotices(oversized, `sha256=${hmac(oversized)}`, metaConfig)).toBeNull();
  expect(verifiedMeta(meta(Array.from({ length: 101 }, () => notice())))).toBeNull();
  for (const body of [new TextEncoder().encode('{broken'), new Uint8Array([0xc3, 0x28])]) {
    expect(verifyMetaLeadNotices(body, `sha256=${hmac(body)}`, metaConfig)).toBeNull();
  }
});

test('website HMAC authenticates the fixed contract and normalizes optional inquiry fields', () => {
  const result = verifyWebsiteCapture(inquiry, websiteHeaders(inquiry), websiteConfig, context);
  expect(result).toMatchObject({
    keyId: 'local-site',
    requestId,
    eventKey: `website:request:${requestId}`,
    sentAt: now,
    inquiry: {
      customer_name: 'Synthetic inquiry',
      email: 'person@example.test',
      budget: null,
      alternate_phone: null,
    },
  });
  expect(result?.bodyHash).toMatch(/^[0-9a-f]{64}$/);
});

test('website signatures bind method, path, timestamp, request ID, key and exact body', () => {
  const headers = websiteHeaders(inquiry);
  expect(
    verifyWebsiteCapture(text({ customer_name: 'Changed' }), headers, websiteConfig, context),
  ).toBeNull();
  for (const options of [{ path: '/different' }, { method: 'GET' }]) {
    expect(
      verifyWebsiteCapture(inquiry, websiteHeaders(inquiry, options), websiteConfig, context),
    ).toBeNull();
  }
  for (const changed of [
    { requestId: 'b811f203-2fc6-4d13-a903-00c85ee90891' },
    { timestamp: String(now + 1) },
    { keyId: 'other-site' },
  ]) {
    expect(
      verifyWebsiteCapture(inquiry, { ...headers, ...changed }, websiteConfig, context),
    ).toBeNull();
  }
  expect(
    verifyWebsiteCapture(inquiry, headers, { ...websiteConfig, secret: token }, context),
  ).toBeNull();
  expect(
    verifyWebsiteCapture(inquiry, headers, websiteConfig, { ...context, method: 'GET' }),
  ).toBeNull();
  expect(
    verifyWebsiteCapture(inquiry, headers, websiteConfig, {
      ...context,
      path: WEBSITE_CAPTURE_PATH + '?extra=1',
    }),
  ).toBeNull();
});

test('website clock skew is bounded in both directions with a trusted server clock', () => {
  for (const offset of [-300, 300])
    expect(
      verifyWebsiteCapture(
        inquiry,
        websiteHeaders(inquiry, { timestamp: String(now + offset) }),
        websiteConfig,
        context,
      ),
    ).not.toBeNull();
  for (const offset of [-301, 301])
    expect(
      verifyWebsiteCapture(
        inquiry,
        websiteHeaders(inquiry, { timestamp: String(now + offset) }),
        websiteConfig,
        context,
      ),
    ).toBeNull();
  expect(
    verifyWebsiteCapture(inquiry, websiteHeaders(inquiry), websiteConfig, {
      ...context,
      nowSeconds: NaN,
    }),
  ).toBeNull();
});

test('website header encodings and missing configuration fail closed', () => {
  const headers = websiteHeaders(inquiry);
  for (const changed of [
    { signature: 'v1=xyz' },
    { timestamp: `0${now}` },
    { requestId: requestId.toUpperCase() },
    { extra: true },
  ]) {
    expect(
      verifyWebsiteCapture(inquiry, { ...headers, ...changed }, websiteConfig, context),
    ).toBeNull();
  }
  expect(verifyWebsiteCapture(inquiry, headers, {}, context)).toBeNull();
});

test('website payload cannot choose source, owner, stage, actor or company', () => {
  for (const field of ['source_code', 'assigned_user_id', 'stage', 'created_by', 'companyId']) {
    const body = text({ customer_name: 'Synthetic inquiry', [field]: 'forged' });
    expect(verifyWebsiteCapture(body, websiteHeaders(body), websiteConfig, context)).toBeNull();
  }
});

test('website bodies enforce encoding, size and existing lead field validation', () => {
  for (const body of [
    new Uint8Array(CAPTURE_LIMITS.websiteBytes + 1),
    new Uint8Array([0xc3, 0x28]),
    text({ customer_name: 'X' }),
    text({ customer_name: 'Valid name', phone: '0501234567' }),
    text({ customer_name: 'Valid name', budget: 'AED 100' }),
    text({ customer_name: 'Valid name', expected_start_on: '0000-01-01' }),
  ]) {
    expect(verifyWebsiteCapture(body, websiteHeaders(body), websiteConfig, context)).toBeNull();
  }
});

test('website event keys support a future durable replay ledger but do not themselves consume requests', () => {
  const first = verifyWebsiteCapture(inquiry, websiteHeaders(inquiry), websiteConfig, context)!;
  const repeat = verifyWebsiteCapture(inquiry, websiteHeaders(inquiry), websiteConfig, context)!;
  expect(repeat).toEqual(first);
  const changed = text({ customer_name: 'Another inquiry' });
  const collision = verifyWebsiteCapture(changed, websiteHeaders(changed), websiteConfig, context)!;
  expect(collision.eventKey).toBe(first.eventKey);
  expect(collision.bodyHash).not.toBe(first.bodyHash);
});

test('Meta numeric tokens cannot silently round fractions or unsafe IDs before validation', () => {
  for (const token of ['300.00000000000000001', '3e2', '9007199254740993']) {
    const raw = new TextEncoder().encode(
      JSON.stringify(meta()).replace('"leadgen_id":"300"', `"leadgen_id":${token}`),
    );
    expect(verifyMetaLeadNotices(raw, `sha256=${hmac(raw)}`, metaConfig)).toBeNull();
  }
  expect(
    verifiedMeta({ ...meta(), ignored: 'Escaped "123" and 3e2 are literal text' }),
  ).toHaveLength(1);
});

test('website key rotation preserves the inquiry event key for the same trusted connection', () => {
  const rotated = { keyId: 'local-site-v2', secret: token };
  const bodyHash = createHash('sha256').update(inquiry).digest('hex');
  const canonical = [
    'AFAQ-WEBSITE-LEAD-V1',
    'POST',
    WEBSITE_CAPTURE_PATH,
    rotated.keyId,
    requestId,
    String(now),
    bodyHash,
  ].join('\n');
  const headers = {
    keyId: rotated.keyId,
    requestId,
    timestamp: String(now),
    signature: `v1=${hmac(canonical, token)}`,
  };
  const first = verifyWebsiteCapture(inquiry, websiteHeaders(inquiry), websiteConfig, context)!;
  const second = verifyWebsiteCapture(inquiry, headers, rotated, context)!;
  expect(second.eventKey).toBe(first.eventKey);
  expect(second.bodyHash).toBe(first.bodyHash);
});