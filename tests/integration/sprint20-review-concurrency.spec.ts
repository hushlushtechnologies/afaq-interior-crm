import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  reviewSubmissionResultSchema,
  reviewDecisionResultSchema,
} from '../../src/features/quotations/review-contracts';

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
  return execFileSync('docker', args, { env, input, encoding: 'utf8', timeout: 45000 });
}
function encoded(value: unknown) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('base64')}','base64'),'UTF8')::jsonb`;
}
function command(actor: string, rpc: string, input: unknown) {
  return `begin;set local statement_timeout='30s';
    do $$ begin perform set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated"}',true); end; $$;
    set local role authenticated;select public.${rpc}(${encoded(input)});commit;`;
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
    child.stdin.on('error', reject);
    child.on('close', (code) => resolve({ code, output, error }));
    child.stdin.end(input);
  });
}

test('actual concurrent submissions and decisions have one committed outcome', async () => {
  expect(
    execFileSync(
      'docker',
      [
        `--host=${host}`,
        'inspect',
        '--format',
        '{{.Name}}|{{.State.Running}}|{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
        container,
      ],
      { env, encoding: 'utf8' },
    ).trim(),
  ).toBe(`/${container}|true|57422`);
  expect(
    sql(
      "select exists(select 1 from supabase_migrations.schema_migrations where version='20261117000200');",
    ).trim(),
  ).toBe('t');
  const actor = randomUUID();
  const reviewer = randomUUID();
  const lead = randomUUID();
  const quotes: string[] = [];
  try {
    sql(`begin;insert into auth.users(id,email,email_confirmed_at) values
      ('${actor}','s20-race-${actor}@example.test',now()),('${reviewer}','s20-race-${reviewer}@example.test',now());
      insert into crm_access.user_roles(user_id,role_key) values('${actor}','sales_executive'),('${reviewer}','project_manager');
      insert into crm_sales.leads(id,customer_name,source_code,assigned_user_id,created_by)
        values('${lead}','Synthetic review race','manual','${actor}','${actor}');commit;`);
    for (let i = 0; i < 3; i++) {
      const input = {
        requestId: randomUUID(),
        quotationId: null,
        expectedVersion: null,
        leadId: lead,
        title: `Synthetic review race ${i}`,
        quotationDate: '2026-11-17',
        validUntil: null,
        companyVatNumber: null,
        clientNotes: null,
        internalNotes: null,
        terms: null,
        paymentTerms: null,
        sections: [],
        pricing: {
          policyId: 's18-exclusive-discount-before-tax-half-up-v1',
          currency: 'AED',
          items: [
            {
              id: randomUUID(),
              sectionId: null,
              description: 'Synthetic service',
              quantity: '1',
              unit: 'service',
              unitPrice: '100',
              discount: { mode: 'none' },
              tax: { treatment: 'exempt' },
            },
          ],
          overallDiscount: { mode: 'none' },
        },
      };
      const saved = JSON.parse(sql(command(actor, 'crm_save_quotation_draft', input)));
      expect(saved.id).toMatch(/^[a-f0-9-]{36}$/);
      quotes.push(saved.id);
    }
    const submission = {
      requestId: randomUUID(),
      quotationId: quotes[0],
      expectedRevision: 1,
      expectedVersion: 1,
      reviewerId: reviewer,
    };
    const retries = await Promise.all([
      concurrent(command(actor, 'crm_submit_quotation_review', submission)),
      concurrent(command(actor, 'crm_submit_quotation_review', submission)),
    ]);
    retries.forEach((result) => expect(result.code, result.error).toBe(0));
    const requests = retries.map((result) =>
      reviewSubmissionResultSchema.parse(JSON.parse(result.output)),
    );
    expect(requests[0].id).toBe(requests[1].id);
    expect(requests.filter((result) => !result.replayed)).toHaveLength(1);
    const decision = {
      requestId: randomUUID(),
      reviewId: requests[0].id,
      expectedRevision: 1,
      expectedSavedVersion: 1,
      decision: 'approve',
      comments: null,
    };
    const duplicateDecisions = await Promise.all([
      concurrent(command(reviewer, 'crm_decide_quotation_review', decision)),
      concurrent(command(reviewer, 'crm_decide_quotation_review', decision)),
    ]);
    duplicateDecisions.forEach((result) => expect(result.code, result.error).toBe(0));
    const recorded = duplicateDecisions.map((result) =>
      reviewDecisionResultSchema.parse(JSON.parse(result.output)),
    );
    expect(recorded[0].id).toBe(recorded[1].id);
    expect(recorded.filter((result) => !result.replayed)).toHaveLength(1);

    const competingSubmission = { ...submission, requestId: randomUUID(), quotationId: quotes[1] };
    const competing = await Promise.all([
      concurrent(command(actor, 'crm_submit_quotation_review', competingSubmission)),
      concurrent(
        command(actor, 'crm_submit_quotation_review', {
          ...competingSubmission,
          requestId: randomUUID(),
        }),
      ),
    ]);
    expect(competing.filter((result) => result.code === 0)).toHaveLength(1);
    expect(
      competing.filter((result) => result.code !== 0 && result.error.includes('40001')),
    ).toHaveLength(1);

    const request = reviewSubmissionResultSchema.parse(
      JSON.parse(
        sql(
          command(actor, 'crm_submit_quotation_review', {
            ...submission,
            requestId: randomUUID(),
            quotationId: quotes[2],
          }),
        ),
      ),
    );
    const base = { reviewId: request.id, expectedRevision: 1, expectedSavedVersion: 1 };
    const competingDecisions = await Promise.all([
      concurrent(
        command(reviewer, 'crm_decide_quotation_review', {
          ...base,
          requestId: randomUUID(),
          decision: 'approve',
          comments: null,
        }),
      ),
      concurrent(
        command(reviewer, 'crm_decide_quotation_review', {
          ...base,
          requestId: randomUUID(),
          decision: 'reject',
          comments: 'Concurrent rejection feedback.',
        }),
      ),
    ]);
    expect(competingDecisions.filter((result) => result.code === 0)).toHaveLength(1);
    expect(
      competingDecisions.filter((result) => result.code !== 0 && result.error.includes('40001')),
    ).toHaveLength(1);
    const winner = reviewDecisionResultSchema.parse(
      JSON.parse(competingDecisions.find((result) => result.code === 0)!.output),
    );
    expect(
      sql(`select status from crm_quotes.review_requests where id='${request.id}';`).trim(),
    ).toBe(winner.status);
    expect(
      sql(
        `select count(*) from crm_quotes.review_decisions where review_id='${request.id}';`,
      ).trim(),
    ).toBe('1');
  } finally {
    // Only generated UUIDs in the fixed local fixture database are deleted.
    if (![actor, reviewer, lead, ...quotes].every((id) => /^[a-f0-9-]{36}$/.test(id)))
      throw new Error('Invalid fixture identifier.');
    const ids = quotes.length ? quotes.map((id) => `'${id}'`).join(',') : 'NULL';
    sql(`begin;select pg_advisory_xact_lock(90310001::bigint);
      alter table crm_quotes.review_decisions disable trigger immutable_review_decision;
      alter table crm_quotes.review_requests disable trigger immutable_review_request;
      delete from crm_quotes.review_decisions where review_id in(select id from crm_quotes.review_requests where quotation_id in(${ids}));
      delete from crm_quotes.review_receipts where actor_id in('${actor}','${reviewer}');
      delete from crm_quotes.review_requests where quotation_id in(${ids});
      alter table crm_quotes.review_requests enable trigger immutable_review_request;
      alter table crm_quotes.review_decisions enable trigger immutable_review_decision;
      delete from crm_quotes.requests where quotation_id in(${ids});delete from crm_quotes.saves where quotation_id in(${ids});
      delete from crm_quotes.drafts where quotation_id in(${ids});delete from crm_quotes.quotations where id in(${ids});
      delete from crm_sales.leads where id='${lead}' and created_by='${actor}';
      delete from auth.users where id in('${actor}','${reviewer}') and email like 's20-race-%@example.test';commit;`);
  }
});