import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createDraftQuotationPdfModel } from '../../src/features/quotations/pdf-model';
import { createDraftPdfWorkflow } from '../../src/features/quotations/pdf-workflow';
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

test('local draft uploads, concurrent retries, download UI, expiry display and revoked access', async ({
  page,
  baseURL,
}, info) => {
  const fixtures = createLeadFixtures(baseURL!);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    'http://127.0.0.1:57421',
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    options,
  );
  let quote: string | null = null;
  try {
    const actor = await fixtures.account('sales_executive');
    const other = await fixtures.account('sales_executive');
    const employee = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      options,
    );
    expect((await employee.auth.signInWithPassword(actor)).error).toBeNull();
    const lead = await employee.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'Synthetic PDF browser fixture',
        assigned_user_id: actor.id,
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-16',
      },
    });
    expect(lead.error).toBeNull();
    const saved = await employee.rpc('crm_save_quotation_draft', {
      p_input: {
        requestId: randomUUID(),
        quotationId: null,
        expectedVersion: null,
        leadId: lead.data.lead.id,
        title: 'Synthetic saved PDF scope',
        quotationDate: '2026-11-16',
        validUntil: null,
        companyVatNumber: null,
        clientNotes: 'Client-safe scope.',
        internalNotes: 'PRIVATE_BROWSER_PDF_29',
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
    expect(saved.error).toBeNull();
    quote = saved.data.id;
    expect(quote).toMatch(/^[a-f0-9-]{36}$/);
    const record = await employee.rpc('crm_get_quotation', { p_id: quote });
    const snapshot = await employee.rpc('crm_quotation_snapshot', { p_id: quote, p_version: 1 });
    expect(record.error).toBeNull();
    expect(snapshot.error).toBeNull();
    const model = createDraftQuotationPdfModel(record.data, snapshot.data);
    const workflow = createDraftPdfWorkflow(admin, actor.id);
    const requestId = randomUUID();
    const [first, retry] = await Promise.all([
      workflow.generate(requestId, model),
      workflow.generate(requestId, model),
    ]);
    expect(first).toEqual(retry);
    expect(
      sql(
        `select count(*) from crm_quotes.draft_pdf_events where document_id='${first.documentId}' and action='generated';`,
      ).trim(),
    ).toBe('1');
    const stored = JSON.parse(
      sql(
        `select json_build_object('path',path,'sha256',sha256) from crm_quotes.draft_pdfs where id='${first.documentId}';`,
      ),
    );
    expect(
      (await employee.storage.from('crm-quotation-drafts').download(stored.path)).error,
    ).not.toBeNull();
    expect(
      (
        await employee.rpc('crm_draft_pdf_gateway', {
          p_actor: actor.id,
          p_operation: 'authorize_download',
          p_input: { documentId: first.documentId },
        })
      ).error,
    ).not.toBeNull();
    const outsider = createDraftPdfWorkflow(admin, other.id);
    await expect(outsider.download(first.documentId)).rejects.toThrow('PDF access');

    // Inject a truncated upload into real local Storage, then verify physical cleanup.
    const bucket = admin.storage.from('crm-quotation-drafts');
    const partialAdmin = {
      rpc: admin.rpc.bind(admin),
      storage: {
        from: () => ({
          async upload(path: string, bytes: Uint8Array) {
            const result = await bucket.upload(path, bytes.slice(0, 5), {
              contentType: 'application/pdf',
              upsert: false,
            });
            expect(result.error).toBeNull();
            return { error: { message: 'Injected partial upload failure' } };
          },
          download: bucket.download.bind(bucket),
          remove: bucket.remove.bind(bucket),
        }),
      },
    } as unknown as SupabaseClient;
    const partialRequest = randomUUID();
    await expect(
      createDraftPdfWorkflow(partialAdmin, actor.id).generate(partialRequest, model),
    ).rejects.toMatchObject({ retryable: false });
    const failed = JSON.parse(
      sql(
        `select json_build_object('id',id,'state',state) from crm_quotes.draft_pdfs where actor_id='${actor.id}' and request_id='${partialRequest}';`,
      ),
    );
    expect(failed.state).toBe('failed');
    const cleaned = await bucket.list(failed.id);
    expect(cleaned.error).toBeNull();
    expect(cleaned.data).toHaveLength(0);

    await signInLocalAccount(page, actor);
    await page.goto(`/quotations/${quote}`);
    const region = page.getByRole('region', { name: 'Internal draft PDF', exact: true });
    await expect(region).toContainText('Uses saved version 1');
    await region.getByRole('button', { name: 'Prepare saved draft PDF', exact: true }).click();
    await expect(region.getByRole('status')).toContainText('Internal draft PDF prepared');
    await page.clock.install();
    await region.getByRole('button', { name: 'Create draft download link', exact: true }).click();
    const link = region.getByRole('link', { name: 'Download internal draft PDF', exact: true });
    await expect(link).toBeVisible();
    const url = (await link.getAttribute('href'))!;
    const token = new URL(url).searchParams.get('token')!;
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(claims.exp - claims.iat).toBe(60);
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    const bytes = await response.body();
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(stored.sha256);
    const downloadEvent = page.waitForEvent('download');
    await link.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/^quotation-draft-[a-f0-9-]+\.pdf$/);
    await download.delete();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-labelledby="quotation-draft-pdf-heading"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    // UI expiry is convenience only; the Storage service enforces signed expiry.
    await page.clock.fastForward(61000);
    await expect(link).toHaveCount(0);
    sql(
      `update crm_sales.leads set assigned_user_id='${other.id}' where id='${lead.data.lead.id}' and created_by='${actor.id}';`,
    );
    await region.getByRole('button', { name: 'Create draft download link', exact: true }).click();
    await expect(region.getByRole('alert')).toContainText('PDF access is unavailable');
    await expect(link).toHaveCount(0);
    if (info.project.name === 'desktop') {
      // Actual Storage expiry, independent of the browser's simulated UI clock.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, claims.exp * 1000 - Date.now() + 1500)),
      );
      expect((await page.request.get(url)).ok()).toBe(false);
    }
  } finally {
    if (quote) {
      if (!/^[a-f0-9-]{36}$/.test(quote)) throw new Error('Invalid fixture quotation ID.');
      const paths = JSON.parse(
        sql(
          `select coalesce(json_agg(path),'[]'::json) from crm_quotes.draft_pdfs where quotation_id='${quote}';`,
        ),
      );
      if (paths.length)
        expect((await admin.storage.from('crm-quotation-drafts').remove(paths)).error).toBeNull();
      // Fixed local fixture only. Trigger restoration and scoped deletion commit atomically.
      sql(`begin;
        alter table crm_quotes.draft_pdf_events disable trigger immutable_pdf_event;
        delete from crm_quotes.draft_pdf_events where document_id in (select id from crm_quotes.draft_pdfs where quotation_id='${quote}');
        alter table crm_quotes.draft_pdf_events enable trigger immutable_pdf_event;
        delete from crm_quotes.draft_pdfs where quotation_id='${quote}';
        delete from crm_quotes.requests where quotation_id='${quote}';
        delete from crm_quotes.saves where quotation_id='${quote}';
        delete from crm_quotes.drafts where quotation_id='${quote}';
        delete from crm_quotes.quotations where id='${quote}';commit;`);
    }
    await fixtures.cleanup();
  }
});