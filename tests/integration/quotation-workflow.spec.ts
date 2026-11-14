import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  quotationRecordSchema,
  quotationSavedSchema,
} from '../../src/features/quotations/contracts';
import { PRICING_POLICY_ID, type QuotationDraft } from '../../src/features/quotations/schemas';

const container = 'supabase_db_afaq-interiors-crm-s09-local';
const host =
  process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';
const env = { ...process.env };
for (const key of [
  'DOCKER_HOST',
  'DOCKER_CONTEXT',
  'DOCKER_TLS',
  'DOCKER_TLS_VERIFY',
  'DOCKER_CERT_PATH',
])
  delete env[key];
const args = [
  `--host=${host}`,
  'exec',
  '-i',
  container,
  'psql',
  '-X',
  '-qAt',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  'VERBOSITY=sqlstate',
];
function sql(input: string) {
  return execFileSync('docker', args, {
    env,
    input,
    encoding: 'utf8',
    timeout: 45000,
    maxBuffer: 4 * 1024 * 1024,
  });
}
function concurrent(
  input: string,
): Promise<{ code: number | null; output: string; error: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env, timeout: 45000 });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output, error }));
    child.stdin.on('error', reject);
    child.stdin.end(input);
  });
}
function encoded(value: unknown) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('base64')}','base64'),'UTF8')::jsonb`;
}
function claims(actor: string) {
  return `do $$ begin perform set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true); end; $$;`;
}
function payload(lead: string): QuotationDraft {
  return {
    requestId: randomUUID(),
    quotationId: null,
    expectedVersion: null,
    leadId: lead,
    title: 'Synthetic concurrent draft',
    quotationDate: '2026-11-13',
    validUntil: null,
    companyVatNumber: null,
    clientNotes: null,
    internalNotes: null,
    terms: null,
    paymentTerms: null,
    sections: [],
    pricing: {
      policyId: PRICING_POLICY_ID,
      currency: 'AED',
      items: [],
      overallDiscount: { mode: 'none' },
    },
  };
}
function setup(actor: string, lead: string) {
  return `insert into auth.users(id,email,email_confirmed_at) values('${actor}','quote-${actor}@example.test',now());
    insert into crm_access.user_roles(user_id,role_key) values('${actor}','sales_executive');
    insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
    values('${lead}','Synthetic concurrency fixture','manual','${actor}','${actor}');`;
}
test.beforeAll(() => {
  const identity = execFileSync(
    'docker',
    [
      `--host=${host}`,
      'inspect',
      '--format',
      '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
      container,
    ],
    { env, encoding: 'utf8' },
  ).trim();
  expect(identity).toBe(`/${container}|true|57422`);
  expect(
    sql(
      "select exists(select 1 from supabase_migrations.schema_migrations where version='20261113000500');",
    ),
  ).toBe('t\n');
});

test('draft lifecycle, authorization, immutable save history and RLS fixtures', () => {
  expect(sql(readFileSync('tests/sql/quotation-drafts.sql', 'utf8'))).toContain(
    'quotation draft checks passed',
  );
});

test('actual authenticated database responses satisfy the server contracts', () => {
  const actor = randomUUID();
  const lead = randomUUID();
  const input = payload(lead);
  const output = sql(`begin; ${setup(actor, lead)} ${claims(actor)} set local role authenticated;
    create temporary table saved as select public.crm_save_quotation_draft(${encoded(input)}) result;
    select result from saved;
    select public.crm_get_quotation((result->>'id')::uuid) from saved;
    rollback;`)
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  expect(output).toHaveLength(2);
  expect(quotationSavedSchema.safeParse(output[0]).success).toBe(true);
  expect(quotationRecordSchema.safeParse(output[1]).success).toBe(true);
  expect(output[1].document.title).toBe(input.title);
});

test('concurrent numbering, duplicate retries and optimistic updates remain atomic', async () => {
  const actor = randomUUID();
  const lead = randomUUID();
  const input = payload(lead);
  const counterExisted =
    sql(
      "select exists(select 1 from crm_quotes.counters where year=extract(year from now() at time zone 'Asia/Dubai'));",
    ).trim() === 't';
  function command(value: QuotationDraft) {
    return `begin; set local statement_timeout='30s'; ${claims(actor)} set local role authenticated;
      select public.crm_save_quotation_draft(${encoded(value)}); commit;`;
  }
  try {
    sql(`begin; ${setup(actor, lead)} commit;`);
    const retries = await Promise.all(Array.from({ length: 6 }, () => concurrent(command(input))));
    retries.forEach((result) => expect(result.code, result.error).toBe(0));
    const saved = retries.map((result) =>
      quotationSavedSchema.parse(JSON.parse(result.output.trim())),
    );
    expect(new Set(saved.map((result) => result.id)).size).toBe(1);
    expect(saved.filter((result) => !result.replayed)).toHaveLength(1);
    const independent = await Promise.all(
      Array.from({ length: 6 }, () => concurrent(command({ ...input, requestId: randomUUID() }))),
    );
    independent.forEach((result) => expect(result.code, result.error).toBe(0));
    const numbers = independent.map((result) => JSON.parse(result.output.trim()).number);
    expect(new Set([saved[0].number, ...numbers]).size).toBe(7);
    const updates = await Promise.all(
      ['First edit', 'Second edit'].map((title) =>
        concurrent(
          command({
            ...input,
            title,
            quotationId: saved[0].id,
            expectedVersion: 1,
            requestId: randomUUID(),
          }),
        ),
      ),
    );
    expect(updates.filter((result) => result.code === 0)).toHaveLength(1);
    expect(
      updates.filter((result) => result.code !== 0 && result.error.includes('40001')),
    ).toHaveLength(1);
    expect(sql(`select count(*) from crm_quotes.quotations where lead_id='${lead}';`).trim()).toBe(
      '7',
    );
    expect(
      sql(
        `select count(*) from crm_quotes.saves where quotation_id in(select id from crm_quotes.quotations where lead_id='${lead}');`,
      ).trim(),
    ).toBe('8');
    expect(sql(`select count(*) from crm_quotes.requests where actor_id='${actor}';`).trim()).toBe(
      '8',
    );
  } finally {
    // Delete only synthetic rows created by this test, in the fixed local database.
    sql(`begin; select pg_advisory_xact_lock(90310001::bigint);
      delete from crm_quotes.requests where actor_id='${actor}';
      delete from crm_quotes.saves where quotation_id in(select id from crm_quotes.quotations where lead_id='${lead}');
      delete from crm_quotes.drafts where quotation_id in(select id from crm_quotes.quotations where lead_id='${lead}');
      delete from crm_quotes.quotations where lead_id='${lead}';
      delete from crm_sales.leads where id='${lead}' and created_by='${actor}';
      delete from auth.users where id='${actor}' and email='quote-${actor}@example.test';
      ${
        counterExisted
          ? ''
          : `delete from crm_quotes.counters c where c.year=extract(year from now() at time zone 'Asia/Dubai')
        and not exists(select 1 from crm_quotes.quotations q where q.number like 'AFAQ-Q-'||c.year||'-%');`
      }
      commit;`);
  }
});