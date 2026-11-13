import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { createLeadFixtures, type LocalTestAccount } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';
import { parseLeadCsv } from '../../src/features/lead-import/csv';

test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(120000);
const origin = 'http://127.0.0.1:3100';
async function api(account: LocalTestAccount) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  expect((await client.auth.signInWithPassword(account)).error).toBeNull();
  return client;
}
async function lead(client: Awaited<ReturnType<typeof api>>, owner: string, name: string) {
  const saved = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: name,
      source_code: 'manual',
      assigned_user_id: owner,
      priority: 'high',
      inquiry_on: '2026-11-13',
      phone: '+971501234567',
      budget: '1234.50',
      description: 'PRIVATE DESCRIPTION',
      initial_note: 'PRIVATE NOTE',
    },
  });
  expect(saved.error).toBeNull();
}

test('download uses applied filters, scoped records, formula protection and the fixed field whitelist', async ({
  page,
}) => {
  const fixtures = createLeadFixtures(origin);
  try {
    const actor = await fixtures.account('sales_executive');
    const other = await fixtures.account('sales_executive');
    const client = await api(actor);
    const stranger = await api(other);
    const marker = randomUUID();
    await lead(client, actor.id, `=1+1 ${marker}`);
    await lead(client, actor.id, 'Different synthetic inquiry');
    await lead(stranger, other.id, `Hidden ${marker}`);
    await signInLocalAccount(page, actor);
    await page.goto('/leads');
    await page.getByLabel('Search leads', { exact: true }).fill(marker);
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Page 1: 1 of 1 visible leads' }),
    ).toBeVisible();
    await page.getByLabel('Search leads', { exact: true }).fill('Unapplied draft');
    const ready = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export applied filters', exact: true }).click();
    const download = await ready;
    expect(download.suggestedFilename()).toMatch(/^afaq-leads-[a-f0-9-]{36}\.csv$/);
    expect(await download.failure()).toBeNull();
    const bytes = readFileSync((await download.path())!);
    const csv = parseLeadCsv('export.csv', bytes);
    expect(csv.headers).toHaveLength(19);
    expect(csv.rows).toHaveLength(1);
    expect(csv.rows[0].cells[1]).toBe(`'=1+1 ${marker}`);
    expect(csv.rows[0].cells[3]).toBe("'+971501234567");
    expect(csv.rows[0].cells[12]).toBe('1234.50');
    expect(bytes.toString()).not.toContain('PRIVATE');
    expect(bytes.toString()).not.toContain(actor.email);
    expect(bytes.toString()).not.toContain('Hidden');
    await expect(page.getByRole('status').filter({ hasText: 'CSV prepared.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await fixtures.cleanup();
  }
});

test('Management export is bounded, private, rate limited and denied immediately after role revocation', async ({
  page,
}) => {
  const fixtures = createLeadFixtures(origin);
  try {
    const admin = await fixtures.account();
    const manager = await fixtures.account('management_director');
    const client = await api(admin);
    const managerApi = await api(manager);
    const marker = randomUUID();
    await lead(client, admin.id, marker);
    await signInLocalAccount(page, manager);
    const body = { search: marker };
    const wrong = await page.request.post('/api/leads/export', {
      headers: { Origin: 'https://example.invalid' },
      data: body,
    });
    expect(wrong.status()).toBe(403);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        page.request.post('/api/leads/export', { headers: { Origin: origin }, data: body }),
      ),
    );
    expect(attempts.map((response) => response.status()).sort()).toEqual([
      200, 200, 200, 200, 200, 429,
    ]);
    for (const response of attempts.filter((response) => response.status() === 200)) {
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['x-content-type-options']).toBe('nosniff');
      expect(response.headers()['x-export-row-count']).toBe('1');
      expect(response.headers()['content-disposition']).toMatch(
        /^attachment; filename="afaq-leads-/,
      );
    }
    expect(
      (
        await client.rpc('crm_change_user_role', {
          p_email: manager.email,
          p_role_key: 'management_director',
          p_operation: 'revoke',
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await page.request.post('/api/leads/export', { headers: { Origin: origin }, data: body })
      ).status(),
    ).toBe(403);
    expect((await managerApi.rpc('crm_lead_export', { p_query: body })).error?.code).toBe('42501');
  } finally {
    await fixtures.cleanup();
  }
});

test('anonymous and view-only callers cannot export; invalid filters and oversized bodies are rejected', async ({
  page,
}) => {
  const fixtures = createLeadFixtures(origin);
  try {
    const anonymous = await page.request.post('/api/leads/export', {
      headers: { Origin: origin },
      data: {},
    });
    expect(anonymous.status()).toBe(401);
    const admin = await fixtures.account();
    const viewer = await fixtures.account(null);
    const client = await api(admin);
    expect(
      (
        await client.rpc('crm_assign_user_role', {
          p_user_id: viewer.id,
          p_role_key: 'project_manager',
        })
      ).error,
    ).toBeNull();
    await signInLocalAccount(page, viewer);
    await page.goto('/leads');
    await expect(
      page.getByRole('button', { name: 'Export applied filters', exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.post('/api/leads/export', { headers: { Origin: origin }, data: {} })
      ).status(),
    ).toBe(403);
    const viewerApi = await api(viewer);
    expect((await viewerApi.rpc('crm_lead_export', { p_query: {} })).error?.code).toBe('42501');
    await page.context().clearCookies();
    await signInLocalAccount(page, admin);
    expect(
      (
        await page.request.post('/api/leads/export', {
          headers: { Origin: origin },
          data: { actor_id: admin.id },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post('/api/leads/export', {
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          data: 'x'.repeat(8193),
        })
      ).status(),
    ).toBe(413);
  } finally {
    await fixtures.cleanup();
  }
});