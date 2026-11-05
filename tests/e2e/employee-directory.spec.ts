import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Page } from '@playwright/test';
import { createLocalAuthFixtures, type LocalAuthFixtures } from '../helpers/local-auth-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';

function sql(query: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_afaq-interiors-crm-s09-local',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-X',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim();
}
const test = base.extend<{ localAuth: LocalAuthFixtures }>({
  localAuth: async ({ baseURL }, provide) => {
    if (!baseURL) throw new Error('Local test URL required.');
    const fixtures = createLocalAuthFixtures(baseURL);
    const ids: string[] = [];
    try {
      await provide({
        ...fixtures,
        createAccount: async (options) => {
          const account = await fixtures.createAccount(options);
          ids.push(account.id);
          return account;
        },
      });
    } finally {
      if (ids.length) {
        if (ids.some((id) => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('Invalid fixture ID.');
        const users = ids.map((id) => `'${id}'`).join(',');
        sql(`BEGIN; DELETE FROM crm_employees.account_status_events WHERE actor_id IN (${users}) AND target_user_id IN (${users});
          DELETE FROM crm_employees.employees WHERE auth_user_id IN (${users});
          DELETE FROM crm_employees.invitation_events WHERE invitation_id IN (SELECT id FROM crm_employees.invitations WHERE requested_by IN (${users})); DELETE FROM crm_employees.invitation_recovery_requests WHERE invitation_id IN (SELECT id FROM crm_employees.invitations WHERE requested_by IN (${users})); DELETE FROM crm_employees.invitation_receipts WHERE requested_by IN (${users});
          DELETE FROM crm_employees.invitations WHERE requested_by IN (${users}); COMMIT;`);
      }
      await fixtures.cleanup();
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
async function search(page: Page, value: string) {
  const form = page.getByRole('form', { name: 'Search employee directory', exact: true });
  await form.getByLabel('Find employee', { exact: true }).fill(value);
  await form.getByRole('button', { name: 'Search employees', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Search employees', exact: true })).toBeEnabled();
}
const rowFor = (page: Page, email: string) => page.getByRole('row').filter({ hasText: email });
function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

test('deactivation blocks an existing session and reactivation preserves roles and audits both changes', async ({
  page,
  browser,
  baseURL,
  localAuth,
}) => {
  const actor = await localAuth.createAccount({ role: 'super_admin' });
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const targetPage = await context.newPage();
  try {
    await signInLocalAccount(targetPage, target);
    const api = client();
    expect(
      (await api.auth.signInWithPassword({ email: target.email, password: target.password })).error,
    ).toBeNull();
    await signInLocalAccount(page, actor);
    await page.goto('/employees');
    await search(page, target.email);
    const row = rowFor(page, target.email);
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Deactivate employee account?', exact: true });
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(row.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm deactivation', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Activate', exact: true })).toBeVisible();
    await targetPage.reload();
    await expect(
      targetPage.getByRole('heading', { name: 'Account inactive', exact: true }),
    ).toBeVisible();
    expect((await api.rpc('crm_get_my_access')).error?.code).toBe('42501');
    expect(sql(`select count(*) from crm_access.user_roles where user_id='${target.id}';`)).toBe(
      '1',
    );
    await row.getByRole('button', { name: 'Activate', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Activate employee account?', exact: true })
      .getByRole('button', { name: 'Confirm activation', exact: true })
      .click();
    await expect(row.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
    await targetPage.reload();
    await expect(
      targetPage.getByRole('heading', { level: 1, name: 'Dashboard', exact: true }),
    ).toBeVisible();
    expect((await api.rpc('crm_get_my_access')).error).toBeNull();
    expect(
      sql(
        `select count(*) from crm_employees.account_status_events where target_user_id='${target.id}' and actor_id='${actor.id}';`,
      ),
    ).toBe('2');
  } finally {
    await context.close();
  }
});

test('an uncertain response retries one request ID without a duplicate audit event', async ({
  page,
  localAuth,
}) => {
  const actor = await localAuth.createAccount({ role: 'super_admin' });
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  await signInLocalAccount(page, actor);
  await page.goto('/employees');
  await search(page, target.email);
  const ids: string[] = [];
  await page.route('**/employees', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];
    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id)
      return route.continue();
    ids.push(id);
    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await rowFor(page, target.email).getByRole('button', { name: 'Deactivate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Deactivate employee account?', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Confirm deactivation', exact: true });
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(
    rowFor(page, target.email).getByRole('button', { name: 'Activate', exact: true }),
  ).toBeVisible();
  expect(ids).toHaveLength(2);
  expect(ids[1]).toBe(ids[0]);
  expect(
    sql(
      `select count(*) from crm_employees.account_status_events where target_user_id='${target.id}';`,
    ),
  ).toBe('1');
});

test('concurrent stale requests produce one change and one conflict', async ({ localAuth }) => {
  const actor = await localAuth.createAccount({ role: 'super_admin' });
  const target = await localAuth.createAccount({ role: 'sales_executive' });
  const api = client();
  expect(
    (await api.auth.signInWithPassword({ email: actor.email, password: actor.password })).error,
  ).toBeNull();
  const outcomes = await Promise.all(
    [0, 1].map(() =>
      api.rpc('crm_change_employee_status', {
        p_request_id: randomUUID(),
        p_user_id: target.id,
        p_expected: 'active',
        p_status: 'inactive',
      }),
    ),
  );
  expect(outcomes.filter((r) => !r.error)).toHaveLength(1);
  expect(outcomes.filter((r) => r.error?.code === '40001')).toHaveLength(1);
  expect(
    sql(
      `select count(*) from crm_employees.account_status_events where target_user_id='${target.id}';`,
    ),
  ).toBe('1');
});

test('Management can read but cannot mutate; Sales cannot read the directory', async ({
  page,
  localAuth,
}) => {
  const director = await localAuth.createAccount({ role: 'management_director' });
  const sales = await localAuth.createAccount({ role: 'sales_executive' });
  await signInLocalAccount(page, director);
  await page.goto('/employees');
  await search(page, sales.email);
  await expect(rowFor(page, sales.email)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deactivate', exact: true })).toHaveCount(0);
  const api = client();
  expect(
    (await api.auth.signInWithPassword({ email: director.email, password: director.password }))
      .error,
  ).toBeNull();
  expect(
    (
      await api.rpc('crm_change_employee_status', {
        p_request_id: randomUUID(),
        p_user_id: sales.id,
        p_expected: 'active',
        p_status: 'inactive',
      })
    ).error?.code,
  ).toBe('42501');
  expect(
    (await api.auth.signInWithPassword({ email: sales.email, password: sales.password })).error,
  ).toBeNull();
  expect((await api.rpc('crm_employee_directory', { p_search: '', p_page: 0 })).error?.code).toBe(
    '42501',
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signInLocalAccount(page, sales);
  await page.goto('/employees');
  await expect(
    page.getByRole('heading', { name: 'Access not available', exact: true }),
  ).toBeVisible();
});

test('search includes pending invitations without activation controls', async ({
  page,
  localAuth,
}) => {
  await signInLocalAccount(page, await localAuth.createAccount({ role: 'super_admin' }));
  const email = `s11-directory-${randomUUID()}@example.test`;
  await page.goto('/employees/invitations');
  await page.getByLabel('Employee name', { exact: true }).fill('Pending Directory Employee');
  await page.getByLabel('Work email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Record invitation request', exact: true }).click();
  await expect(
    page.getByRole('form', { name: 'Request employee invitation' }).getByRole('status'),
  ).toContainText('Invitation request recorded.');
  await page.goto('/employees');
  await search(page, email);
  const row = rowFor(page, email);
  await expect(row).toContainText('invited');
  await expect(row.getByRole('button')).toHaveCount(0);
  await search(page, `missing-${randomUUID()}`);
  await expect(
    page.getByText('No matching employee accounts or invitations.', { exact: true }),
  ).toBeVisible();
});
