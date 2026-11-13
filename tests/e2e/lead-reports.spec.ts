import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createLeadFixtures, type LocalTestAccount } from '../helpers/lead-fixtures';

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
  expect(
    (await client.auth.signInWithPassword({ email: account.email, password: account.password }))
      .error,
  ).toBeNull();
  return client;
}

test('real dashboard and report counts respect assignment, dates, empty states and accessible layout', async ({
  page,
}) => {
  const fixtures = createLeadFixtures(origin);
  try {
    const actor = await fixtures.account('sales_executive');
    const stranger = await fixtures.account('sales_executive');
    const client = await api(actor);
    const other = await api(stranger);
    for (const [owner, connection] of [
      [actor.id, client],
      [stranger.id, other],
    ] as const) {
      const created = await connection.rpc('crm_save_lead', {
        p_request_id: randomUUID(),
        p_command: 'create',
        p_lead_id: null,
        p_version: null,
        p_data: {
          customer_name: 'Synthetic report inquiry',
          email: null,
          phone: null,
          alternate_phone: null,
          source_code: 'manual',
          assigned_user_id: owner,
          priority: 'normal',
          property_type: null,
          location: null,
          budget: null,
          expected_start_on: null,
          inquiry_on: '2026-11-12',
          follow_up_on: null,
          description: null,
          initial_note: null,
        },
      });
      expect(created.error).toBeNull();
    }
    await signInLocalAccount(page, actor);
    await page.goto('/dashboard');
    await expect(page.getByTestId('report-lead-total')).toHaveText('1');
    await expect(page.getByTestId('report-new-total')).toHaveText('1');
    await expect(page.getByText('Demonstration data')).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#workspace-content')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.goto('/reports/sales');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Sales reports', exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId('report-lead-total')).toHaveText('1');
    await page.getByLabel('From', { exact: true }).fill('2060-01-01');
    await page.getByLabel('To', { exact: true }).fill('2060-01-31');
    await page.getByRole('button', { name: 'Apply dates' }).click();
    await expect(page.getByTestId('report-lead-total')).toHaveText('0');
    await expect(page.getByRole('status').filter({ hasText: 'No visible leads' })).toBeVisible();
    await page.goto('/reports/sales?from=2060-02-01&to=2060-01-01');
    await expect(page.locator('#workspace-content').getByRole('alert')).toContainText(
      'Choose valid',
    );
    await expect(page.getByTestId('report-lead-total')).toHaveCount(0);
    await page.goto('/reports/sales?from=2060-01-01&from=2060-02-01&to=2060-03-01');
    await expect(page.locator('#workspace-content').getByRole('alert')).toContainText(
      'Choose valid',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  } finally {
    await fixtures.cleanup();
  }
});

test('a session without report access cannot read aggregates through the page or RPC', async ({
  page,
}) => {
  const fixtures = createLeadFixtures(origin);
  try {
    const actor = await fixtures.account(null);
    const client = await api(actor);
    await signInLocalAccount(page, actor);
    await page.goto('/reports/sales');
    await expect(page.getByTestId('report-lead-total')).toHaveCount(0);
    const denied = await client.rpc('crm_lead_report', {
      p_from: '2026-11-01',
      p_to: '2026-11-30',
      p_mode: 'report',
    });
    expect(denied.error?.code).toBe('42501');
    expect(denied.data).toBeNull();
  } finally {
    await fixtures.cleanup();
  }
});