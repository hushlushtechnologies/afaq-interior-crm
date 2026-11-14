import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import { PRICING_POLICY_ID } from '../../src/features/quotations/schemas';
import {
  quotationHistorySchema,
  quotationSnapshotSchema,
} from '../../src/features/quotations/history-contracts';

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

test('local SQL history isolation, immutability and pagination', async ({ baseURL }) => {
  createLeadFixtures(baseURL!);

  expect(sql(readFileSync('tests/sql/quotation-history.sql', 'utf8'))).toContain(
    'quotation history checks passed',
  );
});

test('saved history compares exact evidence and clears it after access is revoked', async ({
  page,
  baseURL,
}) => {
  const users = createLeadFixtures(baseURL!);
  let quote: string | null = null;

  try {
    const actor = await users.account('sales_executive');
    const other = await users.account('sales_executive');

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    expect((await client.auth.signInWithPassword(actor)).error).toBeNull();

    const lead = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'S19 history browser fixture',
        assigned_user_id: actor.id,
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-14',
      },
    });

    expect(lead.error).toBeNull();

    const input = {
      requestId: randomUUID(),
      quotationId: null as string | null,
      expectedVersion: null as number | null,
      leadId: lead.data.lead.id as string,
      title: 'History original',
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
            description: 'Synthetic scope',
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

    const created = await client.rpc('crm_save_quotation_draft', { p_input: input });

    expect(created.error).toBeNull();

    quote = created.data.id;
    input.quotationId = quote;
    input.expectedVersion = 1;
    input.requestId = randomUUID();
    input.title = 'History edited';
    input.pricing.items[0].quantity = '2';

    expect((await client.rpc('crm_save_quotation_draft', { p_input: input })).error).toBeNull();

    const history = await client.rpc('crm_quotation_history', { p_id: quote, p_page: 0 });

    expect(quotationHistorySchema.safeParse(history.data).success).toBe(true);

    expect(
      quotationSnapshotSchema.safeParse(
        (await client.rpc('crm_quotation_snapshot', { p_id: quote, p_version: 1 })).data,
      ).success,
    ).toBe(true);

    await signInLocalAccount(page, actor);
    await page.goto(`/quotations/${quote}`);

    const region = page.getByRole('region', { name: 'Saved draft history', exact: true });

    await expect(region.getByRole('status')).toContainText('2 of 2 saved versions');

    await region.getByRole('button', { name: 'Compare saved versions', exact: true }).click();

    await expect(
      region.getByRole('heading', {
        name: 'Saved version 1 compared with saved version 2',
        exact: true,
      }),
    ).toBeVisible();

    await expect(region).toContainText('+100.00');

    await region.getByText('Title changed', { exact: true }).click();

    await expect(region).toContainText('History original');
    await expect(region).toContainText('History edited');

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    sql(
      `update crm_sales.leads set assigned_user_id='${other.id}' where id='${input.leadId}' and created_by='${actor.id}';`,
    );

    await region.getByRole('button', { name: 'Reload quotation history', exact: true }).click();

    await expect(region.getByRole('alert')).toBeVisible();

    await expect(
      region.getByRole('heading', {
        name: 'Saved version 1 compared with saved version 2',
        exact: true,
      }),
    ).toHaveCount(0);

    expect(
      (await client.rpc('crm_quotation_snapshot', { p_id: quote, p_version: 1 })).error?.code,
    ).toBe('42501');
  } finally {
    if (quote) {
      if (!/^[a-f0-9-]{36}$/.test(quote)) throw new Error('Invalid fixture quotation ID.');

      sql(
        `begin;delete from crm_quotes.requests where quotation_id='${quote}';delete from crm_quotes.saves where quotation_id='${quote}';delete from crm_quotes.drafts where quotation_id='${quote}';delete from crm_quotes.quotations where id='${quote}';commit;`,
      );
    }

    await users.cleanup();
  }
});