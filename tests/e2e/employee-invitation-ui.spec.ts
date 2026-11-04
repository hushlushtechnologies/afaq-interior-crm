import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInLocalAccount } from '../helpers/auth-browser';
import { createLocalAuthFixtures, type LocalAuthFixtures } from '../helpers/local-auth-fixtures';

const test = base.extend<{ localAuth: LocalAuthFixtures }>({
  localAuth: async ({ baseURL }, provide) => {
    if (!baseURL) throw new Error('The local test URL is missing.');

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
      // Receipt/queue records reference the temporary actor. Remove those first.
      // createLocalAuthFixtures has already verified the dedicated local project.
      if (ids.length) {
        if (ids.some((id) => !/^[0-9a-f-]{36}$/.test(id))) {
          throw new Error('Invalid fixture ID.');
        }

        const actorIds = ids.map((id) => `'${id}'`).join(',');

        execFileSync(
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
            '-v',
            'ON_ERROR_STOP=1',
          ],
          {
            input: `BEGIN; DELETE FROM crm_employees.invitation_receipts WHERE requested_by IN (${actorIds}); DELETE FROM crm_employees.invitations WHERE requested_by IN (${actorIds}); COMMIT;`,
            stdio: ['pipe', 'pipe', 'pipe'],
          },
        );
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

const form = (page: Page) =>
  page.getByRole('form', { name: 'Request employee invitation', exact: true });

const result = (page: Page) => form(page).getByRole('status');

const newEmail = () => `s11-ui-${randomUUID()}@example.test`;

async function fillInvitation(page: Page, email: string, name = 'Example Employee') {
  await form(page).getByLabel('Employee name', { exact: true }).fill(name);
  await form(page).getByLabel('Work email', { exact: true }).fill(email);
}

async function record(page: Page) {
  await form(page).getByRole('button', { name: 'Record invitation request', exact: true }).click();
}

test('invalid input focuses the summary without submitting a request', async ({
  page,
  localAuth,
}) => {
  await signInLocalAccount(page, await localAuth.createAccount({ role: 'super_admin' }));
  await page.goto('/employees/invitations');

  let submissions = 0;

  page.on('request', (request) => {
    if (request.method() === 'POST' && request.headers()['next-action']) submissions += 1;
  });

  await record(page);

  await expect(form(page).getByRole('alert')).toBeFocused();
  await expect(form(page).getByRole('alert').getByRole('link')).toHaveCount(2);
  expect(submissions).toBe(0);

  await form(page).getByRole('link', { name: 'Enter the employee name.', exact: true }).click();
  await expect(form(page).getByLabel('Employee name', { exact: true })).toBeFocused();
});

test('records, deduplicates, and reports an existing Auth account accurately', async ({
  page,
  localAuth,
}) => {
  const actor = await localAuth.createAccount({ role: 'super_admin' });
  const existing = await localAuth.createAccount({ role: 'sales_executive' });

  await signInLocalAccount(page, actor);
  await page.goto('/employees/invitations');

  const email = newEmail();

  await fillInvitation(page, email);
  await record(page);

  await expect(result(page)).toContainText('Invitation request recorded. No email has been sent.');
  await expect(result(page)).toBeFocused();

  await expect(form(page).getByLabel('Work email', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );

  await form(page).getByRole('button', { name: 'Start another request', exact: true }).click();

  await fillInvitation(page, email.toUpperCase(), 'Another Name');
  await record(page);

  await expect(result(page)).toContainText(
    'An invitation request is already pending for this email.',
  );

  await form(page).getByRole('button', { name: 'Start another request', exact: true }).click();

  await fillInvitation(page, existing.email);
  await record(page);

  await expect(result(page)).toContainText(
    'An authentication account already exists. No invitation was created.',
  );
});

test('retries the same ID and details after the response is lost', async ({ page, localAuth }) => {
  await signInLocalAccount(page, await localAuth.createAccount({ role: 'super_admin' }));
  await page.goto('/employees/invitations');

  const ids: string[] = [];
  const bodies: string[] = [];

  await page.route('**/employees/invitations', async (route) => {
    const request = route.request();

    if (request.method() !== 'POST' || !request.headers()['next-action']) {
      return route.continue();
    }

    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (!id) return route.continue();

    ids.push(id);
    bodies.push(body);

    if (ids.length === 1) {
      // Allow the database commit, then discard only the response.
      await route.fetch();
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  await fillInvitation(page, newEmail());

  await form(page).evaluate((element) => {
    const invitationForm = element as HTMLFormElement;
    invitationForm.requestSubmit();
    invitationForm.requestSubmit();
  });

  await expect(form(page).getByRole('alert')).toContainText('The result could not be confirmed.');

  await expect(form(page).getByLabel('Employee name', { exact: true })).toHaveAttribute(
    'readonly',
    '',
  );

  await expect(
    form(page).getByRole('button', { name: 'Start another request', exact: true }),
  ).toHaveCount(0);

  await form(page).getByRole('button', { name: 'Retry request', exact: true }).click();

  await expect(result(page)).toContainText('Invitation request recorded. No email has been sent.');

  expect(ids).toHaveLength(2);
  expect(ids[1]).toBe(ids[0]);
  expect(bodies[1]).toBe(bodies[0]);
});

test('reports a conflicting request ID without claiming success', async ({ page, localAuth }) => {
  await signInLocalAccount(page, await localAuth.createAccount({ role: 'super_admin' }));
  await page.goto('/employees/invitations');

  let firstId = '';

  await page.route('**/employees/invitations', async (route) => {
    const request = route.request();
    const body = request.postData() ?? '';
    const id = body.match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id) {
      return route.continue();
    }

    if (!firstId) {
      firstId = id;
      return route.continue();
    }

    await route.continue({ postData: body.replace(id, firstId) });
  });

  await fillInvitation(page, newEmail());
  await record(page);
  await expect(result(page)).toContainText('Invitation request recorded.');

  await form(page).getByRole('button', { name: 'Start another request', exact: true }).click();

  await fillInvitation(page, newEmail(), 'Changed Employee');
  await record(page);

  await expect(form(page).getByRole('alert')).toContainText(
    'This request ID was already used for different input.',
  );

  await expect(result(page)).toHaveCount(0);
});

test('denies a submission when Super Admin authority was revoked after opening the form', async ({
  page,
  localAuth,
}) => {
  const actor = await localAuth.createAccount({ role: 'super_admin' });

  await signInLocalAccount(page, actor);
  await page.goto('/employees/invitations');
  await expect(form(page)).toBeVisible();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const revoked = await admin.rpc('crm_revoke_user_role', {
    p_user_id: actor.id,
    p_role_key: 'super_admin',
  });

  expect(revoked.error).toBeNull();

  await fillInvitation(page, newEmail());
  await record(page);

  await expect(form(page).getByRole('alert')).toContainText(
    'Only Super Admin can request employee invitations.',
  );

  await expect(result(page)).toHaveCount(0);
});

for (const role of ['sales_executive', 'management_director'] as const) {
  test(`${role} cannot find or open employee invitations`, async ({ page, localAuth }) => {
    await signInLocalAccount(page, await localAuth.createAccount({ role }));
    await page.goto('/employees/invitations');

    await expect(
      page.getByRole('heading', { name: 'Access not available', exact: true }),
    ).toBeVisible();

    await expect(form(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Search navigation', exact: true }).click();

    const search = page.getByRole('dialog', { name: 'Search navigation', exact: true });

    await search.getByLabel('Find a page', { exact: true }).fill('Invitations');
    await expect(search.getByRole('link', { name: /Invitations/ })).toHaveCount(0);
  });
}

test('an expired browser session offers sign-in instead of claiming success', async ({
  page,
  localAuth,
}) => {
  await signInLocalAccount(page, await localAuth.createAccount({ role: 'super_admin' }));
  await page.goto('/employees/invitations');
  await expect(form(page)).toBeVisible();

  await page.context().clearCookies();

  await fillInvitation(page, newEmail());
  await record(page);

  await expect(form(page).getByRole('alert')).toContainText('Sign in again to continue.');
  await expect(result(page)).toHaveCount(0);

  await form(page).getByRole('link', { name: 'Sign in again', exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(form(page)).toHaveCount(0);
});
