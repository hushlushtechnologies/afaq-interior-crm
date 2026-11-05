import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Page } from '@playwright/test';
import { createLocalAuthFixtures, type LocalAuthFixtures } from '../helpers/local-auth-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';

const test = base.extend<{ localAuth: LocalAuthFixtures }>({
  localAuth: async ({ baseURL }, provide) => {
    const fixture = createLocalAuthFixtures(baseURL!);
    try {
      await provide(fixture);
    } finally {
      await fixture.cleanup();
    }
  },
});
test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  screenshot: 'off',
  video: 'off',
});
test.setTimeout(90_000);
const panel = (page: Page) => page.getByRole('region', { name: 'Security audit', exact: true });
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}
async function openAudit(page: Page, auth: LocalAuthFixtures) {
  const actor = await auth.createAccount({ role: 'super_admin' });
  await signInLocalAccount(page, actor);
  await page.goto('/settings/access');
  await expect(panel(page)).toBeVisible();
  return actor;
}
async function show(page: Page, id: string) {
  await panel(page).getByLabel('Target record UUID (optional)').fill(id);
  await panel(page).getByRole('button', { name: 'Show audit', exact: true }).click();
}

test('human role change is visible with actor and target, is read-only, and fits mobile accessibly', async ({
  page,
  localAuth,
}) => {
  const actor = await openAudit(page, localAuth);
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  await page.getByLabel('Employee email', { exact: true }).fill(target.email);
  await page.getByRole('button', { name: 'Find account', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Finance Officer', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Assign Finance Officer?', exact: true })
    .getByRole('button', { name: 'Assign role', exact: true })
    .click();
  await expect(page.getByRole('checkbox', { name: 'Finance Officer', exact: true })).toBeChecked();
  await show(page, target.id);
  const events = panel(page).getByRole('list', { name: 'Security events' });
  await expect(events).toContainText('role assigned');
  await expect(events).toContainText('finance_officer');
  await expect(events).toContainText(`employee (${actor.id})`);
  await expect(events).toContainText(target.id);
  await expect(panel(page).getByRole('button', { name: /delete|edit|export/i })).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  const axe = await new AxeBuilder({ page })
    .include('[aria-labelledby="security-audit-heading"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test('target filtering, invalid input and pagination preserve the selected audit scope', async ({
  page,
  localAuth,
}) => {
  await openAudit(page, localAuth);
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  const admin = adminClient();
  for (let index = 0; index < 16; index++) {
    for (const name of ['crm_assign_user_role', 'crm_revoke_user_role']) {
      expect(
        Boolean(
          (await admin.rpc(name, { p_user_id: target.id, p_role_key: 'finance_officer' })).error,
        ),
      ).toBe(false);
    }
  }
  await show(page, 'invalid');
  await expect(panel(page).getByRole('alert')).toContainText('valid optional record UUID');
  await show(page, target.id);
  await expect(panel(page).getByRole('status')).toHaveText('Page 1: 25 events');
  await panel(page).getByRole('button', { name: 'Next audit page', exact: true }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Page 2: 8 events');
  await expect(
    panel(page).getByRole('button', { name: 'Next audit page', exact: true }),
  ).toBeDisabled();
  const events = panel(page).getByRole('list', { name: 'Security events' });
  await expect(events).toContainText(target.id);
  await expect(events).toContainText('trusted service');
});

test('revoked Super Admin cannot reload history and stale results are cleared', async ({
  page,
  localAuth,
}) => {
  const actor = await openAudit(page, localAuth);
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  await show(page, target.id);
  await expect(panel(page).getByRole('list', { name: 'Security events' })).toBeVisible();
  const admin = adminClient();
  expect(
    Boolean(
      (await admin.rpc('crm_revoke_user_role', { p_user_id: actor.id, p_role_key: 'super_admin' }))
        .error,
    ),
  ).toBe(false);
  await panel(page).getByRole('button', { name: 'Show audit', exact: true }).click();
  await expect(panel(page).getByRole('alert')).toContainText(
    'Super Admin access could not be confirmed',
  );
  await expect(panel(page).getByRole('list', { name: 'Security events' })).toHaveCount(0);
});

test('anonymous, service, Management, Sales and forged user metadata cannot read security audit', async ({
  localAuth,
}) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const anonymous = createClient(url, key, { auth: { persistSession: false } });
  expect(
    Boolean(
      (await anonymous.rpc('crm_get_security_audit', { p_page: 0, p_target_id: null })).error,
    ),
  ).toBe(true);
  const admin = adminClient();
  expect(
    Boolean((await admin.rpc('crm_get_security_audit', { p_page: 0, p_target_id: null })).error),
  ).toBe(true);
  for (const role of ['management_director', 'sales_executive', null] as const) {
    const account = await localAuth.createAccount({ role });
    expect(
      Boolean(
        (
          await admin.auth.admin.updateUserById(account.id, {
            user_metadata: { role: 'super_admin', roles: ['super_admin'] },
          })
        ).error,
      ),
    ).toBe(false);
    const client = createClient(url, key, { auth: { persistSession: false } });
    expect(
      Boolean(
        (await client.auth.signInWithPassword({ email: account.email, password: account.password }))
          .error,
      ),
    ).toBe(false);
    const result = await client.rpc('crm_get_security_audit', { p_page: 0, p_target_id: null });
    expect(result.error?.code).toBe('42501');
    expect(result.data).toBeNull();
  }
});
