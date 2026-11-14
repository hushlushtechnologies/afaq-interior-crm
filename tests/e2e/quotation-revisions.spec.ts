import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base } from '@playwright/test';
import { createLeadFixtures, type LocalTestAccount } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import {
  quotationRecordSchema,
  quotationSavedSchema,
} from '../../src/features/quotations/contracts';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';

function sql(input: string) {
  const env = { ...process.env };

  for (const key of [
    'DOCKER_HOST',
    'DOCKER_CONTEXT',
    'DOCKER_TLS',
    'DOCKER_TLS_VERIFY',
    'DOCKER_CERT_PATH',
  ])
    delete env[key];

  const host =
    process.platform === 'win32' ? 'npipe:////./pipe/docker_engine' : 'unix:///var/run/docker.sock';

  return execFileSync(
    'docker',
    [
      `--host=${host}`,
      'exec',
      '-i',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-X',
      '-qAt',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { env, input, encoding: 'utf8', timeout: 45000 },
  );
}

async function api(account: LocalTestAccount) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  expect((await client.auth.signInWithPassword(account)).error).toBeNull();

  return client;
}

async function setup(baseURL: string) {
  const users = createLeadFixtures(baseURL);
  const quotes: string[] = [];

  try {
    const actor = await users.account('sales_executive');
    const client = await api(actor);

    const lead = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'S19 revision fixture',
        assigned_user_id: actor.id,
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-14',
      },
    });

    expect(lead.error).toBeNull();

    const draft = {
      requestId: randomUUID(),
      quotationId: null as string | null,
      expectedVersion: null as number | null,
      leadId: lead.data.lead.id as string,
      title: 'Revision original',
      quotationDate: '2026-11-14',
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
        items: [
          {
            id: randomUUID(),
            sectionId: null,
            description: 'Synthetic work',
            quantity: '1',
            unit: 'custom',
            unitPrice: '100',
            discount: { mode: 'none' },
            tax: { treatment: 'exempt' },
          },
        ],
        overallDiscount: { mode: 'none' },
      },
    };

    const response = await client.rpc('crm_save_quotation_draft', {
      p_input: draft,
    });

    expect(response.error).toBeNull();

    const quote = quotationSavedSchema.parse(response.data).id;
    quotes.push(quote);

    return { users, actor, client, quote, draft, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }

  async function cleanup() {
    for (const quote of quotes) {
      if (!/^[a-f0-9-]{36}$/.test(quote)) throw new Error('Invalid fixture quotation ID.');

      sql(`begin;
        delete from crm_quotes.requests where quotation_id='${quote}';
        delete from crm_quotes.saves where quotation_id='${quote}';
        delete from crm_quotes.drafts where quotation_id='${quote}';
        delete from crm_quotes.quotations where id='${quote}';
        commit;`);
    }

    await users.cleanup();
  }
}

const test = base.extend<{ revision: Awaited<ReturnType<typeof setup>> }>({
  revision: [
    async ({ baseURL }, runFixture) => {
      const fixture = await setup(baseURL!);

      try {
        await runFixture(fixture);
      } finally {
        await fixture.cleanup();
      }
    },
    { timeout: 45000 },
  ],
});

test('SQL revision permissions, history preservation and retry validation', async ({ baseURL }) => {
  createLeadFixtures(baseURL!);

  expect(sql(readFileSync('tests/sql/quotation-revisions.sql', 'utf8'))).toContain(
    'quotation revision checks passed',
  );
});

test('concurrent and duplicate revision requests produce one next revision', async ({
  revision: f,
  page,
}) => {
  const command = {
    requestId: randomUUID(),
    quotationId: f.quote,
    expectedVersion: 1,
    expectedRevision: 1,
    reason: 'Concurrent scope review',
  };

  const raced = await Promise.all(
    [command, { ...command, requestId: randomUUID() }].map((input) =>
      f.client.rpc('crm_create_quotation_revision', { p_input: input }),
    ),
  );

  expect(raced.filter((result) => !result.error)).toHaveLength(1);
  expect(raced.find((result) => result.error)?.error?.code).toBe('40001');

  const duplicate = {
    ...command,
    requestId: randomUUID(),
    expectedVersion: 2,
    expectedRevision: 2,
  };

  const retried = await Promise.all(
    [duplicate, duplicate].map((input) =>
      f.client.rpc('crm_create_quotation_revision', { p_input: input }),
    ),
  );

  expect(retried.every((result) => !result.error)).toBe(true);

  expect(retried.map((result) => quotationSavedSchema.parse(result.data).replayed).sort()).toEqual([
    false,
    true,
  ]);

  const current = quotationRecordSchema.parse(
    (await f.client.rpc('crm_get_quotation', { p_id: f.quote })).data,
  );

  expect([current.revision, current.version]).toEqual([3, 3]);

  expect(
    (
      await f.client.rpc('crm_save_quotation_draft', {
        p_input: {
          ...f.draft,
          requestId: randomUUID(),
          quotationId: f.quote,
          expectedVersion: 1,
        },
      })
    ).error?.code,
  ).toBe('40001');

  const other = await f.users.account('sales_executive');
  const outsider = await api(other);

  expect(
    (
      await outsider.rpc('crm_create_quotation_revision', {
        p_input: {
          ...duplicate,
          requestId: randomUUID(),
          expectedVersion: 3,
          expectedRevision: 3,
        },
      })
    ).error?.code,
  ).toBe('42501');

  await signInLocalAccount(page, other);
  await page.goto(`/quotations/${f.quote}/revisions/new`);

  await expect(
    page.getByRole('heading', { name: 'Revision unavailable', exact: true }),
  ).toBeVisible();

  await expect(page.getByRole('button', { name: 'Create next revision', exact: true })).toHaveCount(
    0,
  );
});

test('lost responses retry safely and editing a new revision preserves the old one', async ({
  revision: f,
  page,
}) => {
  await signInLocalAccount(page, f.actor);
  await page.goto(`/quotations/${f.quote}`);

  await page.getByRole('link', { name: 'Create next commercial revision', exact: true }).click();

  await page.getByLabel('Revision reason', { exact: true }).fill('Client requested a larger scope');

  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);

  let dropped = false;

  await page.route(`**/quotations/${f.quote}/revisions/new`, async (route) => {
    if (route.request().method() === 'POST' && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });

  await page.getByRole('button', { name: 'Create next revision', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'Retry revision creation', exact: true }),
  ).toBeEnabled();

  await expect(page.getByLabel('Revision reason', { exact: true })).toBeDisabled();

  expect((await f.client.rpc('crm_get_quotation', { p_id: f.quote })).data.revision).toBe(2);

  await page.getByRole('button', { name: 'Retry revision creation', exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/quotations/${f.quote}$`));

  expect((await f.client.rpc('crm_get_quotation', { p_id: f.quote })).data.version).toBe(2);

  await page.getByLabel('Quotation title', { exact: true }).fill('Revision two edited');
  await page.getByLabel('Quantity', { exact: true }).fill('2');

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();

  await expect(
    page.getByText('Revision 2 · Saved version 3 · Latest save', { exact: true }),
  ).toBeVisible();

  const current = quotationRecordSchema.parse(
    (await f.client.rpc('crm_get_quotation', { p_id: f.quote })).data,
  );

  expect([current.revision, current.version, current.calculation.totals.grandTotal]).toEqual([
    2,
    3,
    '200.00',
  ]);

  const original = (await f.client.rpc('crm_quotation_snapshot', {
    p_id: f.quote,
    p_version: 1,
  })).data;

  expect([
    original.revision,
    original.document.title,
    original.calculation.totals.grandTotal,
  ]).toEqual([1, 'Revision original', '100.00']);

  await page.getByLabel('Before saved version', { exact: true }).selectOption('1');
  await page.getByLabel('After saved version', { exact: true }).selectOption('3');

  await page.getByRole('button', { name: 'Compare saved versions', exact: true }).click();

  const history = page.getByRole('region', { name: 'Saved draft history', exact: true });

  await expect(history).toContainText('+100.00');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});