import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createLeadFixtures } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createAttachmentWorkflow } from '../../src/features/lead-attachments/workflow';
import { conceptContextSchema } from '../../src/features/quotations/concept-ui-contracts';
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

test('private references handle real images, uncertain retries, selection, archive and revoked access', async ({
  page,
  baseURL,
}) => {
  const fixtures = createLeadFixtures(baseURL!);
  const quotes: string[] = [];
  let leadId: string | null = null;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(
    'http://127.0.0.1:57421',
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    options,
  );
  try {
    const actor = await fixtures.account('sales_executive');
    const other = await fixtures.account('sales_executive');
    const client = createClient(
      'http://127.0.0.1:57421',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      options,
    );
    expect((await client.auth.signInWithPassword(actor)).error).toBeNull();
    const lead = await client.rpc('crm_save_lead', {
      p_request_id: randomUUID(),
      p_command: 'create',
      p_lead_id: null,
      p_version: null,
      p_data: {
        customer_name: 'Synthetic concept UI fixture',
        assigned_user_id: actor.id,
        source_code: 'manual',
        priority: 'normal',
        inquiry_on: '2026-11-16',
      },
    });
    expect(lead.error).toBeNull();
    leadId = lead.data.lead.id;
    expect(leadId).toMatch(/^[a-f0-9-]{36}$/);
    const roomId = randomUUID();
    sql(
      `insert into crm_sales.detail_records(lead_id,id,kind,data,created_by,updated_by) values('${leadId}','${roomId}','room','{"name":"Synthetic living room","room_type":null,"sort_order":0,"requirements_notes":null,"measurement_notes":null,"deliverables_notes":null}','${actor.id}','${actor.id}');`,
    );
    const uploads = createAttachmentWorkflow(admin, actor.id);
    for (const format of ['png', 'jpeg', 'webp'] as const) {
      const bytes = await sharp({
        create: { width: 24, height: 24, channels: 3, background: '#96775c' },
      })
        .toFormat(format)
        .toBuffer();
      await uploads.upload(
        {
          requestId: randomUUID(),
          leadId,
          filename: `synthetic.${format}`,
          declaredMime: `image/${format}`,
          declaredBytes: bytes.length,
        },
        bytes,
      );
    }
    for (let i = 0; i < 2; i++) {
      const saved = await client.rpc('crm_save_quotation_draft', {
        p_input: {
          requestId: randomUUID(),
          quotationId: null,
          expectedVersion: null,
          leadId,
          title: `Synthetic concept quotation ${i}`,
          quotationDate: '2026-11-16',
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
      expect(saved.error).toBeNull();
      expect(saved.data.id).toMatch(/^[a-f0-9-]{36}$/);
      quotes.push(saved.data.id);
    }
    const context = await client.rpc('crm_quotation_concept_context', {
      p_id: quotes[0],
      p_revision: 1,
      p_image_page: 0,
    });
    expect(context.error).toBeNull();
    expect(conceptContextSchema.parse(context.data).images).toHaveLength(3);
    expect(JSON.stringify(context.data)).not.toContain('storage_path');
    await signInLocalAccount(page, actor);
    await page.goto(`/quotations/${quotes[0]}`);
    const region = page.getByRole('region', { name: 'Concept references', exact: true });
    await expect(region).toContainText('Live AI generation is not configured');
    await page.clock.install();
    let dropped = false;
    await page.route(`**/quotations/${quotes[0]}`, async (route) => {
      if (!dropped && route.request().method() === 'POST') {
        dropped = true;
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    });
    for (const [index, format] of ['png', 'jpeg', 'webp'].entries()) {
      await region
        .getByLabel('Reference image', { exact: true })
        .selectOption({ label: `synthetic.${format}` });
      await region
        .getByLabel('Reference title', { exact: true })
        .fill(`Synthetic ${format} reference`);
      await region.getByLabel('Room or area', { exact: true }).selectOption(roomId);
      await region
        .getByLabel('Prompt planning notes', { exact: true })
        .fill('Internal synthetic style notes.');
      await region.getByRole('button', { name: 'Register reference image', exact: true }).click();
      if (index === 0) {
        await expect(region.getByRole('alert')).toBeVisible();
        await region.getByRole('button', { name: 'Register reference image', exact: true }).click();
      }
      await expect(
        region.getByRole('heading', { name: `Synthetic ${format} reference`, exact: true }),
      ).toBeVisible();
      await expect(region.getByRole('article')).toHaveCount(index + 1);
      await region
        .getByRole('button', { name: `Preview Synthetic ${format} reference`, exact: true })
        .click();
      const image = region.getByRole('img', {
        name: `Private reference: Synthetic ${format} reference`,
        exact: true,
      });
      await expect(image).toBeVisible();
      await expect
        .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBe(24);
      const url = (await image.getAttribute('src'))!;
      const claims = JSON.parse(
        Buffer.from(new URL(url).searchParams.get('token')!.split('.')[1], 'base64url').toString(),
      );
      expect(claims.exp - claims.iat).toBe(60);
    }
    expect(dropped).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-labelledby="quotation-concepts-heading"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.clock.fastForward(61000);
    await expect(region.getByRole('img')).toHaveCount(0);
    await region
      .getByRole('button', { name: 'Select Synthetic png reference', exact: true })
      .click();
    await expect(region).toContainText('Selected for internal review');
    const referenceId = sql(
      `select id from crm_quotes.concept_references where quotation_id='${quotes[0]}' and title='Synthetic png reference';`,
    ).trim();
    expect(
      (
        await client.rpc('crm_quotation_concept_preview', {
          p_id: quotes[1],
          p_reference: referenceId,
        })
      ).error?.code,
    ).toBe('42501');
    await region
      .getByRole('button', { name: 'Archive Synthetic png reference', exact: true })
      .click();
    await expect(region.getByRole('article')).toHaveCount(2);
    expect(
      (
        await client.rpc('crm_quotation_concept_preview', {
          p_id: quotes[0],
          p_reference: referenceId,
        })
      ).error?.code,
    ).toBe('42501');
    expect(
      sql(
        `select count(*) from crm_sales.attachments where lead_id='${leadId}' and state='ready';`,
      ).trim(),
    ).toBe('3');
    await region.getByRole('button', { name: 'Show archived references', exact: true }).click();
    await expect(region.getByRole('article')).toHaveCount(1);
    await expect(region).toContainText('History retained');
    await region.getByText('Reference history — latest 50 events', { exact: true }).click();
    await expect(region.getByRole('list')).toContainText('archived');
    sql(
      `update crm_sales.leads set assigned_user_id='${other.id}' where id='${leadId}' and created_by='${actor.id}';`,
    );
    await region.getByRole('button', { name: 'Reload concept references', exact: true }).click();
    await expect(region.getByRole('alert')).toBeVisible();
    await expect(region.getByRole('article')).toHaveCount(0);
  } finally {
    if (quotes.length) {
      if (quotes.some((id) => !/^[a-f0-9-]{36}$/.test(id)))
        throw new Error('Invalid fixture quotation ID.');
      const ids = quotes.map((id) => `'${id}'`).join(',');
      sql(`begin;alter table crm_quotes.concept_events disable trigger immutable_concept_event;
        delete from crm_quotes.concept_events where reference_id in(select id from crm_quotes.concept_references where quotation_id in(${ids}));
        alter table crm_quotes.concept_events enable trigger immutable_concept_event;
        delete from crm_quotes.concept_requests where input->>'quotationId' in(${ids});
        delete from crm_quotes.concept_references where quotation_id in(${ids});
        delete from crm_quotes.requests where quotation_id in(${ids});delete from crm_quotes.saves where quotation_id in(${ids});
        delete from crm_quotes.drafts where quotation_id in(${ids});delete from crm_quotes.quotations where id in(${ids});commit;`);
    }
    if (leadId) {
      if (!/^[a-f0-9-]{36}$/.test(leadId)) throw new Error('Invalid fixture lead ID.');
      const paths = JSON.parse(
        sql(
          `select coalesce(json_agg(storage_path),'[]'::json) from crm_sales.attachments where lead_id='${leadId}';`,
        ),
      );
      if (paths.length)
        expect((await admin.storage.from('crm-private').remove(paths)).error).toBeNull();
    }
    await fixtures.cleanup();
  }
});