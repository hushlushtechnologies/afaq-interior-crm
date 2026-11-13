import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';
import { createLeadFixtures, type LocalTestAccount } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';

const test = base.extend<{ fixture: Awaited<ReturnType<typeof fixture>> }>({
  fixture: async ({ baseURL }, provide) => {
    const f = fixture(baseURL!);
    try {
      await provide(f);
    } finally {
      await f.cleanup();
    }
  },
});

test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});

test.setTimeout(120000);

function fixture(baseURL: string) {
  const users = createLeadFixtures(baseURL);
  const ids: string[] = [];
  const admin = createClient(
    'http://127.0.0.1:57421',
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return {
    account: users.account,

    async lead(account: LocalTestAccount) {
      const client = createClient(
        'http://127.0.0.1:57421',
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );

      if ((await client.auth.signInWithPassword(account)).error)
        throw new Error('Fixture login failed.');

      const saved = await client.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'create',
        p_lead_id: null,
        p_version: null,
        p_data: {
          customer_name: 'Attachment browser fixture',
          assigned_user_id: account.id,
          source_code: 'manual',
          priority: 'normal',
          inquiry_on: '2026-11-07',
        },
      });

      if (saved.error) throw new Error('Fixture lead failed.');

      const id = saved.data.lead.id as string;

      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid fixture identity.');

      ids.push(id);
      return id;
    },

    async cleanup() {
      for (const id of ids) {
        const files = await admin.storage.from('crm-private').list(id, { limit: 100 });

        if (files.error) throw new Error('Fixture cleanup listing failed.');

        const paths = files.data.map((file) => `${id}/${file.name}`);

        if (paths.length && (await admin.storage.from('crm-private').remove(paths)).error)
          throw new Error('Fixture cleanup failed.');
      }

      await users.cleanup();
    },
  };
}

async function image(format: 'png' | 'jpeg' | 'webp' = 'png') {
  return sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } })
    .toFormat(format)
    .toBuffer();
}

test('upload, duplicate filenames, browser download, removal and accessible history', async ({
  page,
  fixture: f,
}) => {
  const actor = await f.account();
  const id = await f.lead(actor);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${id}`);

  await expect(
    page
      .getByRole('region', { name: 'Private attachments', exact: true })
      .getByText('No active attachments on this page.', { exact: true }),
  ).toBeVisible();

  const section = page.getByRole('region', { name: 'Private attachments', exact: true });

  for (let i = 0; i < 2; i++) {
    await page
      .locator('input#lead-attachment-file')
      .setInputFiles({ name: 'Room.png', mimeType: 'image/png', buffer: await image() });

    await section.getByRole('button', { name: 'Upload attachment', exact: true }).click();

    await expect(section.getByText('Room.png', { exact: true })).toHaveCount(i + 1);
    await expect(section.getByRole('button', { name: 'Reload attachments' })).toBeEnabled();
  }

  const download = page.waitForEvent('download');

  await section.getByRole('button', { name: 'Download attachment' }).first().click();

  expect((await download).suggestedFilename()).toBe('Room.png');

  await section.getByRole('button', { name: 'Remove attachment', exact: true }).first().click();
  await section.getByRole('button', { name: 'Confirm removal', exact: true }).click();

  await expect(section.getByText('Room.png', { exact: true })).toHaveCount(1);

  await section.getByRole('button', { name: 'Show removed attachments' }).click();

  await expect(section.getByText('Room.png', { exact: true })).toHaveCount(1);
  await expect(section.getByRole('button', { name: 'Download attachment' })).toHaveCount(0);

  const axe = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(axe.violations).toEqual([]);
});

test('PDF/JPEG/WebP upload; Management reads and unrelated Sales is denied', async ({
  page,
  browser,
  fixture: f,
  baseURL,
}) => {
  const actor = await f.account();
  const id = await f.lead(actor);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${id}`);

  await expect(
    page
      .getByRole('region', { name: 'Private attachments', exact: true })
      .getByText('No active attachments on this page.', { exact: true }),
  ).toBeVisible();

  const pdf = await PDFDocument.create();
  pdf.addPage();

  const files = [
    { name: 'Plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) },
    { name: 'Room.jpg', mimeType: 'image/jpeg', buffer: await image('jpeg') },
    { name: 'Room.webp', mimeType: 'image/webp', buffer: await image('webp') },
  ];

  for (const file of files) {
    await page.locator('input#lead-attachment-file').setInputFiles(file);

    await page
      .getByRole('region', { name: 'Private attachments', exact: true })
      .getByRole('button', { name: 'Upload attachment', exact: true })
      .click();

    await expect(
      page
        .getByRole('region', { name: 'Private attachments', exact: true })
        .getByText(file.name, { exact: true }),
    ).toBeVisible();

    await expect(
      page
        .getByRole('region', { name: 'Private attachments', exact: true })
        .getByRole('button', { name: 'Reload attachments' }),
    ).toBeEnabled();
  }

  for (const role of ['management_director', 'sales_executive'] as const) {
    const user = await f.account(role);
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const other = await context.newPage();

    try {
      await signInLocalAccount(other, user);

      const response = await context.request.get(`/api/leads/${id}/attachments`);

      expect(response.status()).toBe(role === 'management_director' ? 200 : 403);

      if (role === 'management_director') {
        await other.goto(`/leads/details/${id}`);

        await expect(
          other
            .getByRole('region', { name: 'Private attachments', exact: true })
            .getByText('Plan.pdf', { exact: true }),
        ).toBeVisible();

        await expect(
          other.getByRole('button', { name: 'Upload attachment', exact: true }),
        ).toHaveCount(0);
      }
    } finally {
      await context.close();
    }
  }
});

test('lost upload response retries its original request and creates one attachment', async ({
  page,
  fixture: f,
}) => {
  const actor = await f.account();
  const id = await f.lead(actor);

  await signInLocalAccount(page, actor);
  await page.goto(`/leads/details/${id}`);

  await expect(
    page
      .getByRole('region', { name: 'Private attachments', exact: true })
      .getByText('No active attachments on this page.', { exact: true }),
  ).toBeVisible();

  let first = true;
  let rejected = false;
  const requests: string[] = [];

  await page.route(`**/api/leads/${id}/attachments`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    requests.push(route.request().headers()['x-attachment-request']);

    if (first) {
      first = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort('failed');
    } else if (!rejected) {
      rejected = true;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          message: 'Temporary validation rejection after the lost response.',
          retryable: false,
        }),
      });
    } else await route.continue();
  });

  await page
    .locator('input#lead-attachment-file')
    .setInputFiles({ name: 'Retry.png', mimeType: 'image/png', buffer: await image() });

  await page.getByRole('button', { name: 'Upload attachment', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Retry same upload', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry same upload', exact: true }).click();

  await expect(page.getByRole('button', { name: 'Retry same upload', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Retry same upload', exact: true }).click();

  await expect(
    page
      .getByRole('region', { name: 'Private attachments', exact: true })
      .getByText('Retry.png', { exact: true }),
  ).toHaveCount(1);

  expect(requests).toHaveLength(3);
  expect(requests[0]).toBe(requests[1]);
  expect(requests[1]).toBe(requests[2]);

  const listed = await page.request.get(`/api/leads/${id}/attachments`);
  expect((await listed.json()).data.total).toBe(1);
});

test('request origin, actual body limit, invalid bytes and pre-parser attempt limits are enforced', async ({
  page,
  fixture: f,
  baseURL,
}) => {
  const actor = await f.account();
  const id = await f.lead(actor);

  await signInLocalAccount(page, actor);

  const endpoint = `/api/leads/${id}/attachments`;
  const input = {
    leadId: id,
    requestId: randomUUID(),
    filename: 'Bad.png',
    declaredMime: 'image/png',
    declaredBytes: 4,
  };
  const headers = {
    Origin: baseURL!,
    'Content-Type': 'image/png',
    'x-attachment-request': encodeURIComponent(JSON.stringify(input)),
  };

  expect(
    (
      await page.request.post(endpoint, {
        headers: { ...headers, Origin: 'https://example.test' },
        data: 'fake',
      })
    ).status(),
  ).toBe(403);

  for (let i = 0; i < 10; i++) {
    const data = i === 0 ? Buffer.alloc(10 * 1024 * 1024 + 1) : Buffer.from('fake');
    expect((await page.request.post(endpoint, { headers, data })).status()).toBe(400);
  }

  expect((await page.request.post(endpoint, { headers, data: 'fake' })).status()).toBe(429);
  expect((await (await page.request.get(endpoint)).json()).data.total).toBe(0);
});
