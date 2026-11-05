import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test as base, type Page } from '@playwright/test';
import {
  createLocalAuthFixtures,
  createTestPassword,
  type LocalAuthFixtures,
} from '../helpers/local-auth-fixtures';
import { fillPrivateInput, signInLocalAccount } from '../helpers/auth-browser';
import { waitForLocalAuthMail } from '../helpers/local-auth-mail';

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

const test = base.extend<{ localAuth: LocalAuthFixtures; email: string }>({
  email: async ({}, provide) => {
    await provide(`s11-delivery-${randomUUID()}@example.test`);
  },
  localAuth: async ({ baseURL, email }, provide) => {
    if (!baseURL) throw new Error('Local base URL required.');
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
      if (!/^s11-delivery-[0-9a-f-]+@example[.]test$/.test(email))
        throw new Error('Invalid fixture email.');
      const invited = sql(`select id from auth.users where email = '${email}';`);
      if (ids.length) {
        if (ids.some((id) => !/^[0-9a-f-]{36}$/.test(id))) throw new Error('Invalid fixture ID.');
        const actors = ids.map((id) => `'${id}'`).join(',');
        sql(`BEGIN; DELETE FROM crm_employees.employees WHERE work_email = '${email}';
          DELETE FROM crm_employees.invitation_events WHERE invitation_id IN (SELECT id FROM crm_employees.invitations WHERE requested_by IN (${actors})); DELETE FROM crm_employees.invitation_recovery_requests WHERE invitation_id IN (SELECT id FROM crm_employees.invitations WHERE requested_by IN (${actors})); DELETE FROM crm_employees.invitation_receipts WHERE requested_by IN (${actors});
          DELETE FROM crm_employees.invitations WHERE requested_by IN (${actors}); COMMIT;`);
      }
      if (invited) {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
          { auth: { persistSession: false } },
        );
        if ((await admin.auth.admin.deleteUser(invited)).error)
          throw new Error('Invited fixture cleanup failed.');
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
const delivery = (page: Page) =>
  page.getByRole('region', { name: 'Local invitation delivery', exact: true });
async function queue(page: Page, auth: LocalAuthFixtures, email: string) {
  const actor = await auth.createAccount({ role: 'super_admin' });
  await signInLocalAccount(page, actor);
  await page.goto('/employees/invitations');
  const form = page.getByRole('form', { name: 'Request employee invitation', exact: true });
  await form.getByLabel('Employee name', { exact: true }).fill('Local Invite Employee');
  await form.getByLabel('Work email', { exact: true }).fill(email);
  await form.getByRole('button', { name: 'Record invitation request', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Invitation request recorded.');
  return actor;
}
async function send(page: Page) {
  await delivery(page)
    .getByRole('button', { name: 'Deliver or check local invitation', exact: true })
    .click();
}
async function openProof(page: Page, token: string, type: 'invite' | 'recovery' = 'invite') {
  await page.goto('/auth/accept-invitation');
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
  await page.evaluate(
    (proof) =>
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}#token_hash=${proof.token}&type=${proof.type}`,
      ),
    { token, type },
  );
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}
async function proof(email: string, origin: string) {
  const mail = await waitForLocalAuthMail(email);
  for (const match of mail.html.replace(/&amp;/g, '&').matchAll(/href=["']([^"']+)["']/gi)) {
    const link = new URL(match[1]);
    if (link.origin === origin && link.pathname === '/auth/accept-invitation') {
      const token = new URLSearchParams(link.hash.slice(1)).get('token_hash');
      if (token && /^[A-Za-z0-9_-]{16,512}$/.test(token)) return token;
    }
  }
  throw new Error('No matching local invitation proof.');
}
async function mailCount(email: string) {
  const response = await fetch('http://127.0.0.1:57424/api/v1/messages?limit=100');
  const data = await response.json();
  return data.messages.filter((message: { To: { Address: string }[] }) =>
    message.To.some((to) => to.Address.toLowerCase() === email),
  ).length;
}

test('delivers once, accepts with an initial password, links the employee, and grants no roles', async ({
  page,
  browser,
  baseURL,
  localAuth,
  email,
}) => {
  await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered.');
  const token = await proof(email, baseURL!);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('already delivered');
  expect(await mailCount(email)).toBe(1);
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const recipient = await context.newPage();
  const password = createTestPassword();
  try {
    await openProof(recipient, token);
    const form = recipient.getByRole('form', { name: 'Accept employee invitation', exact: true });
    await expect
      .poll(async () => {
        if (await form.getByLabel('New password', { exact: true }).count()) return 'ready';
        if (await form.getByRole('alert').count()) return await form.getByRole('alert').innerText();
        return 'pending';
      })
      .toBe('ready');
    await fillPrivateInput(
      form.getByLabel('New password', { exact: true }),
      password,
      'new password',
    );
    await fillPrivateInput(
      form.getByLabel('Confirm password', { exact: true }),
      password,
      'password confirmation',
    );
    await form.getByRole('button', { name: 'Set initial password', exact: true }).click();
    await expect(recipient.getByRole('status')).toContainText(
      'Invitation accepted. No roles were assigned.',
    );
    expect(
      sql(`select employment_status from crm_employees.employees where work_email='${email}';`),
    ).toBe('active');
    expect(
      sql(
        `select count(*) from crm_access.user_roles where user_id=(select id from auth.users where email='${email}');`,
      ),
    ).toBe('0');
    await signInLocalAccount(recipient, { email, password });
    await expect(
      recipient.getByRole('heading', { name: 'Access not configured', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
  const retryContext = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const retry = await retryContext.newPage();
    await openProof(retry, token);
    await expect(
      retry.getByRole('form', { name: 'Accept employee invitation' }).getByRole('alert'),
    ).toContainText('invalid, expired, or already used');
  } finally {
    await retryContext.close();
  }
});

test('does not resend when the delivery response is lost', async ({ page, localAuth, email }) => {
  await queue(page, localAuth, email);
  let discarded = false;
  await page.route('**/employees/invitations', async (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().headers()['next-action'] &&
      !discarded
    ) {
      discarded = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('could not be confirmed');
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('already delivered');
  expect(await mailCount(email)).toBe(1);
});

test('rejects an expired invitation link', async ({ page, browser, baseURL, localAuth, email }) => {
  await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered.');
  const token = await proof(email, baseURL!);
  sql(
    `update auth.users set confirmation_sent_at = now() - interval '1 day' where email='${email}';`,
  );
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const recipient = await context.newPage();
    await openProof(recipient, token);
    await expect(
      recipient.getByRole('form', { name: 'Accept employee invitation' }).getByRole('alert'),
    ).toContainText('invalid, expired, or already used');
    expect(sql(`select count(*) from crm_employees.employees where work_email='${email}';`)).toBe(
      '0',
    );
  } finally {
    await context.close();
  }
});

test('an uncertain attempt without an Auth identity is never automatically resent', async ({
  page,
  localAuth,
  email,
}) => {
  await queue(page, localAuth, email);
  sql(
    `update crm_employees.invitations set status='delivering', delivery_attempt=gen_random_uuid(), delivery_started_at=now()-interval '2 minutes' where work_email='${email}';`,
  );
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Delivery is uncertain.');
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Delivery is uncertain.');
  expect(await mailCount(email)).toBe(0);
  expect(sql(`select count(*) from auth.users where email='${email}';`)).toBe('0');
});

test('revoked Super Admin cannot send and a forged acceptance cannot activate an account', async ({
  page,
  localAuth,
  email,
}) => {
  const actor = await queue(page, localAuth, email);
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_LOCAL_TEST_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await admin.rpc('crm_revoke_user_role', { p_user_id: actor.id, p_role_key: 'super_admin' }))
      .error,
  ).toBeNull();
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('not permitted');
  expect(await mailCount(email)).toBe(0);
  expect(sql(`select count(*) from auth.users where email='${email}';`)).toBe('0');
  const publicClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await publicClient.auth.signInWithPassword({ email: actor.email, password: actor.password }))
      .error,
  ).toBeNull();
  expect((await publicClient.rpc('crm_accept_employee_invitation')).error?.code).toBe('42501');
});

test('a non-test recipient cannot be delivered to', async ({ page, localAuth, email }) => {
  await queue(page, localAuth, email.replace('@example.test', '@example.invalid'));
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('not permitted');
});

test('reconciles a previously created identity without sending again', async ({
  page,
  browser,
  baseURL,
  localAuth,
  email,
}) => {
  await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered.');
  const token = await proof(email, baseURL!);
  // Simulate a crash after Auth created/sent the invitation but before acknowledgment.
  sql(`update crm_employees.invitations set status='delivering', auth_user_id=null,
    delivery_started_at=now()-interval '2 minutes' where work_email='${email}';`);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Delivery is uncertain.');
  expect(await mailCount(email)).toBe(1);
  expect(
    sql(
      `select auth_user_id is not null from crm_employees.invitations where work_email='${email}';`,
    ),
  ).toBe('t');
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const recipient = await context.newPage();
    await openProof(recipient, token);
    await expect(recipient.getByLabel('New password', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

async function replaceLink(page: Page) {
  await delivery(page)
    .getByRole('button', { name: 'Request replacement link', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Replace local invitation link', exact: true });
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirm replacement', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(delivery(page).getByRole('status')).toContainText('Replacement link delivered');
}
function ageAttempt(email: string) {
  sql(
    `update crm_employees.invitations set delivery_started_at=now()-interval '2 minutes' where work_email='${email}';`,
  );
}

test('reviewed replacement preserves identity, invalidates the old token and audits the actor', async ({
  page,
  browser,
  baseURL,
  localAuth,
  email,
}) => {
  const actor = await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered');
  const original = await proof(email, baseURL!);
  const userId = sql(`select id from auth.users where email='${email}';`);
  ageAttempt(email);
  await replaceLink(page);
  expect(await mailCount(email)).toBe(2);
  expect(sql(`select id from auth.users where email='${email}';`)).toBe(userId);
  const replacement = await proof(email, baseURL!);
  expect(replacement === original).toBe(false);
  expect(
    sql(
      `select count(*) from crm_employees.invitation_events e join crm_employees.invitations i on i.id=e.invitation_id where i.work_email='${email}' and e.event='replacement_authorized_after_review' and e.actor_id='${actor.id}';`,
    ),
  ).toBe('1');
  expect(sql(`select count(*) from crm_access.user_roles where user_id='${userId}';`)).toBe('0');
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const recipient = await context.newPage();
    await openProof(recipient, original);
    await expect(
      recipient.getByRole('form', { name: 'Accept employee invitation' }).getByRole('alert'),
    ).toContainText('invalid, expired, or already used');
    await recipient.reload();
    await openProof(recipient, replacement);
    await expect(recipient.getByLabel('New password', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
  await page.reload();
  await page.getByText('Invitation recovery and history', { exact: true }).click();
  const lookup = page.getByRole('form', { name: 'Find invitation', exact: true });
  await lookup.getByLabel('Invitation email').fill(email);
  await lookup.getByRole('button', { name: 'Find invitation', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Invitation history' })).toContainText(
    'replacement authorized after review',
  );
});

test('verified but unaccepted employee uses a recovery link and can complete acceptance', async ({
  page,
  browser,
  baseURL,
  localAuth,
  email,
}) => {
  await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered');
  const original = await proof(email, baseURL!);
  const first = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const recipient = await first.newPage();
    await openProof(recipient, original);
    await expect(recipient.getByLabel('New password', { exact: true })).toBeVisible();
  } finally {
    await first.close();
  }
  const userId = sql(`select id from auth.users where email='${email}';`);
  ageAttempt(email);
  await replaceLink(page);
  expect(await mailCount(email)).toBe(2);
  const replacement = await proof(email, baseURL!);
  const second = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  try {
    const recipient = await second.newPage();
    await openProof(recipient, replacement, 'recovery');
    const form = recipient.getByRole('form', { name: 'Accept employee invitation' });
    await expect(form.getByLabel('New password', { exact: true })).toBeVisible();
    const password = createTestPassword();
    await fillPrivateInput(
      form.getByLabel('New password', { exact: true }),
      password,
      'new password',
    );
    await fillPrivateInput(
      form.getByLabel('Confirm password', { exact: true }),
      password,
      'password confirmation',
    );
    await form.getByRole('button', { name: 'Set initial password' }).click();
    await expect(recipient.getByRole('status')).toContainText(
      'Invitation accepted. No roles were assigned.',
    );
  } finally {
    await second.close();
  }
  expect(sql(`select id from auth.users where email='${email}';`)).toBe(userId);
  expect(sql(`select count(*) from crm_access.user_roles where user_id='${userId}';`)).toBe('0');
});

test('lost replacement response retries the same request without another email', async ({
  page,
  localAuth,
  email,
}) => {
  await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered');
  ageAttempt(email);
  await delivery(page).getByRole('button', { name: 'Request replacement link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace local invitation link' });
  await dialog.getByRole('checkbox').check();
  const bodies: string[] = [];
  let dropped = false;
  await page.route('**/employees/invitations', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    bodies.push(route.request().postData() ?? '');
    if (!dropped) {
      dropped = true;
      await route.fetch();
      return route.abort();
    }
    return route.continue();
  });
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog.getByRole('alert')).toContainText('uncertain');
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog).not.toBeVisible();
  expect(bodies.length).toBe(2);
  expect(bodies[0]).toBe(bodies[1]);
  expect(await mailCount(email)).toBe(2);
  expect(
    sql(
      `select count(*) from crm_employees.invitation_recovery_requests r join crm_employees.invitations i on i.id=r.invitation_id where i.work_email='${email}';`,
    ),
  ).toBe('1');
});

test('replacement requires review, enforces cooldown, and rejects revoked authority', async ({
  page,
  localAuth,
  email,
}) => {
  const actor = await queue(page, localAuth, email);
  await send(page);
  await expect(delivery(page).getByRole('status')).toContainText('Local invitation delivered');
  await delivery(page).getByRole('button', { name: 'Request replacement link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace local invitation link' });
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog.getByRole('alert')).toContainText('checkbox');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog.getByRole('alert')).toContainText('one minute');
  const anchor = await localAuth.createAccount({ role: 'super_admin' });
  expect(Boolean(anchor.id)).toBe(true);
  sql(`delete from crm_access.user_roles where user_id='${actor.id}';`);
  ageAttempt(email);
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog.getByRole('alert')).toContainText('not permitted');
  expect(await mailCount(email)).toBe(1);
});
