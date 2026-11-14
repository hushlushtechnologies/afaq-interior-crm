import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base } from '@playwright/test';
import { createLocalAuthFixtures, type LocalTestAccount } from '../helpers/local-auth-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import {
  quotationPageSchema,
  quotationContextSchema,
} from '../../src/features/quotations/query-contracts';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';

const container = 'supabase_db_afaq-interiors-crm-s09-local';

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
    ],
    { input, env, encoding: 'utf8', timeout: 45000 },
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

async function fixtures() {
  const auth = createLocalAuthFixtures('http://127.0.0.1:3100');
  const leadIds: string[] = [];
  const sales = await auth.createAccount({ role: 'sales_executive' });
  const client = await api(sales);

  return {
    auth,
    sales,
    client,
    async lead() {
      const result = await client.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'create',
        p_lead_id: null,
        p_version: null,
        p_data: {
          customer_name: 'Quotation browser fixture',
          assigned_user_id: sales.id,
          source_code: 'manual',
          priority: 'normal',
          inquiry_on: '2026-11-13',
        },
      });
      expect(result.error).toBeNull();
      const id = result.data.lead.id as string;
      leadIds.push(id);
      return id;
    },
    async cleanup() {
      if (leadIds.length) {
        if (leadIds.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
          throw new Error('Invalid fixture ID');

        const ids = leadIds.map((id) => `'${id}'`).join(',');
        sql(`begin; select pg_advisory_xact_lock(90310001::bigint);
          delete from crm_quotes.requests where quotation_id in(select id from crm_quotes.quotations where lead_id in(${ids}));
          delete from crm_quotes.saves where quotation_id in(select id from crm_quotes.quotations where lead_id in(${ids}));
          delete from crm_quotes.drafts where quotation_id in(select id from crm_quotes.quotations where lead_id in(${ids}));
          delete from crm_quotes.quotations where lead_id in(${ids});
          delete from crm_sales.requests where lead_id in(${ids});
          delete from crm_sales.events where lead_id in(${ids});
          delete from crm_sales.leads where id in(${ids});
          commit;`);
      }
      await auth.cleanup();
    },
  };
}

const test = base.extend<{ quotations: Awaited<ReturnType<typeof fixtures>> }>({
  quotations: [
    async ({ baseURL }, provide) => {
      if (baseURL !== 'http://127.0.0.1:3100')
        throw new Error('Dedicated local test URL required.');
      const f = await fixtures();
      try {
        await provide(f);
      } finally {
        await f.cleanup();
      }
    },
    { timeout: 45000 },
  ],
});

test('SQL read models enforce pagination, sorting and resource permissions', async () => {
  createLocalAuthFixtures('http://127.0.0.1:3100');
  expect(sql(readFileSync('tests/sql/quotation-queries.sql', 'utf8'))).toContain(
    'quotation query checks passed',
  );
});

test('create, calculate, save, edit, reorder and remove items through the browser', async ({
  page,
  quotations: f,
}) => {
  const lead = await f.lead();
  await signInLocalAccount(page, f.sales);
  await page.goto(`/leads/details/${lead}`);
  await page.getByRole('link', { name: 'Create quotation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create quotation', exact: true })).toBeVisible();
  await page.getByLabel('Quotation title', { exact: true }).fill('Interior works fixture');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByLabel('Section name', { exact: true }).fill('Living room');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();

  const item = page.getByRole('group', { name: 'Item 1', exact: true });
  await item.getByLabel('Description', { exact: true }).fill('Synthetic joinery');
  await item.getByLabel('Unit', { exact: true }).fill('m²');
  await item.getByLabel('Section', { exact: true }).selectOption({ label: 'Living room' });
  await item.getByLabel('Unit price (AED)', { exact: true }).fill('100');
  await item.getByLabel('Line discount mode', { exact: true }).selectOption('fixed');
  await item.getByLabel('Line discount (AED)', { exact: true }).fill('10');
  await item.getByLabel('Tax treatment', { exact: true }).selectOption('taxable');
  await item.getByLabel('VAT rate (%)', { exact: true }).fill('5');
  await page.getByLabel('Overall discount mode', { exact: true }).selectOption('percent');
  await page.getByLabel('Overall discount (%)', { exact: true }).fill('10');

  await expect(page.getByRole('region', { name: 'Quotation totals', exact: true })).toContainText(
    '85.05 AED',
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page).toHaveURL(/\/quotations\/[a-f0-9-]{36}$/);
  await expect(page.getByText('Saved draft version 1.', { exact: false })).toBeVisible();

  const quote = page.url().split('/').pop()!;
  const stored = await f.client.rpc('crm_get_quotation', { p_id: quote });
  expect(stored.error).toBeNull();
  expect(stored.data.calculation.totals.grandTotal).toBe('85.05');

  await page.goBack();
  await expect(page).toHaveURL(`/leads/details/${lead}`);
  await expect(
    page
      .getByRole('region', { name: 'Quotations', exact: true })
      .getByRole('link', { name: stored.data.number, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('region', { name: 'Quotations', exact: true })
    .getByRole('link', { name: stored.data.number, exact: true })
    .click();
  await expect(page.getByText('Saved draft version 1.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  const second = page.getByRole('group', { name: 'Item 2', exact: true });
  await second.getByLabel('Description', { exact: true }).fill('Zero-price fixture');
  await second.getByLabel('Unit', { exact: true }).fill('custom');
  await second.getByLabel('Tax treatment', { exact: true }).selectOption('exempt');
  await page.getByRole('button', { name: 'Move item 2 up', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Item 1', exact: true })
      .getByLabel('Description', { exact: true }),
  ).toHaveValue('Zero-price fixture');
  await page.getByRole('button', { name: 'Remove item 1', exact: true }).click();
  await page
    .getByRole('group', { name: 'Item 1', exact: true })
    .getByLabel('Quantity', { exact: true })
    .fill('2');

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Saved draft version 2.', { exact: false })).toBeVisible();
  expect(
    (await f.client.rpc('crm_get_quotation', { p_id: quote })).data.calculation.totals.grandTotal,
  ).toBe('179.55');

  const context = await f.client.rpc('crm_quotation_context', {
    p_lead_id: null,
    p_quotation_id: quote,
  });
  expect(quotationContextSchema.safeParse(context.data).success).toBe(true);
  const violations = await new AxeBuilder({ page }).include('main').analyze();
  expect(violations.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('link', { name: 'All quotations', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Search quotations', exact: true })
    .fill(stored.data.number);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 of 1 quotations' })).toBeVisible();

  const listed = await f.client.rpc('crm_quotation_page', {
    p_query: {
      page: 0,
      search: stored.data.number,
      sort: 'amount',
      direction: 'asc',
      owner: 'mine',
      status: 'draft',
      leadId: null,
    },
  });
  expect(quotationPageSchema.safeParse(listed.data).success).toBe(true);
});

test('validation, uncertain retry and unauthorized access are handled safely', async ({
  page,
  quotations: f,
}) => {
  const lead = await f.lead();
  await signInLocalAccount(page, f.sales);
  await page.goto(`/quotations/new?leadId=${lead}`);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('title');
  await page.getByLabel('Quotation title', { exact: true }).fill('Uncertain save fixture');

  let blocked = false;
  await page.route('**/quotations/new?*', async (route) => {
    if (route.request().method() === 'POST' && !blocked) {
      blocked = true;
      // Commit the real local Server Action, then lose its response at the browser.
      await route.fetch();
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Retry unchanged save', exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel('Quotation title', { exact: true })).toBeDisabled();

  const retryQuery = {
    page: 0,
    search: 'Uncertain save fixture',
    sort: 'created',
    direction: 'desc',
    owner: 'mine',
    status: 'draft',
    leadId: lead,
  };
  expect((await f.client.rpc('crm_quotation_page', { p_query: retryQuery })).data.total).toBe(1);
  await page.getByRole('button', { name: 'Retry unchanged save', exact: true }).click();
  await expect(page).toHaveURL(/\/quotations\/[a-f0-9-]{36}$/);
  expect((await f.client.rpc('crm_quotation_page', { p_query: retryQuery })).data.total).toBe(1);

  const quote = page.url().split('/').pop()!;
  await page.goto('/quotations/templates');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Document templates', exact: true }),
  ).toBeVisible();
  await page.goto('/quotations/approvals');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Approval queue', exact: true }),
  ).toBeVisible();

  const other = await f.auth.createAccount({ role: 'sales_executive' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signInLocalAccount(page, other);
  await page.goto(`/quotations/${quote}`);
  await expect(
    page.getByRole('heading', { name: 'Quotation unavailable', exact: true }),
  ).toBeVisible();
  const otherApi = await api(other);
  expect((await otherApi.rpc('crm_get_quotation', { p_id: quote })).error?.code).toBe('42501');

  const finance = await f.auth.createAccount({ role: 'finance_officer' });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signInLocalAccount(page, finance);
  await page.goto(`/quotations/${quote}`);
  await expect(page.getByText('Read-only quotation.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toHaveCount(0);

  const noRole = await f.auth.createAccount({ role: null });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await signInLocalAccount(page, noRole);
  await page.goto('/quotations');
  await expect(page.getByRole('heading', { name: /access|permission|restricted/i })).toBeVisible();
});

test('list pagination, filters, empty state and loading errors recover', async ({
  page,
  quotations: f,
}) => {
  const lead = await f.lead();
  for (let i = 1; i <= 22; i += 1) {
    const response = await f.client.rpc('crm_save_quotation_draft', {
      p_input: {
        requestId: randomUUID(),
        quotationId: null,
        expectedVersion: null,
        leadId: lead,
        title: `List fixture ${i}`,
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
      },
    });
    expect(response.error).toBeNull();
  }

  await signInLocalAccount(page, f.sales);
  await page.goto('/quotations');
  const count = page.getByRole('status').filter({ hasText: /^Page \d+:/ });
  await expect(count).toContainText('20 of 22 quotations');
  await page.getByRole('button', { name: 'Next quotation page', exact: true }).click();
  await expect(count).toContainText('2 of 22 quotations');

  await page.getByLabel('Owner filter', { exact: true }).selectOption('unassigned');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No quotations match these filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(count).toContainText('20 of 22 quotations');

  let fail = true;
  await page.route('**/quotations', async (route) => {
    if (fail && route.request().method() === 'POST') {
      fail = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.getByLabel('Sort quotations', { exact: true }).selectOption('amount');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be loaded');
  await page.getByRole('button', { name: 'Retry loading quotations', exact: true }).click();
  await expect(count).toContainText('20 of 22 quotations');
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
});
