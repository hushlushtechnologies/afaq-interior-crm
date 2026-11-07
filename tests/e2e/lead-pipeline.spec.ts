import AxeBuilder from '@axe-core/playwright';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { expect, test as base } from '@playwright/test';
import { createLeadFixtures, type LeadFixtures } from '../helpers/lead-fixtures';
import { signInLocalAccount } from '../helpers/auth-browser';

const test = base.extend<{ leads: LeadFixtures }>({
  leads: async ({ baseURL }, provide) => {
    const fixtures = createLeadFixtures(baseURL!);
    try {
      await provide(fixtures);
    } finally {
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

test.setTimeout(120_000);

test('working moves, Lost validation and reopening preserve the same lead and history', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');
  await signInLocalAccount(page, actor);
  await page.goto('/leads');

  await page.getByRole('button', { name: 'Create lead', exact: true }).click();

  const create = page.getByRole('dialog', { name: 'Create lead', exact: true });
  const name = `Pipeline ${randomUUID()}`;

  await create.getByLabel('Customer name', { exact: true }).fill(name);
  await create.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(create).toHaveCount(0);

  const open = async () => {
    await page.getByRole('button', { name, exact: true }).click();
  };

  const dialog = page.getByRole('dialog', { name: 'Lead information', exact: true });

  await open();
  await dialog.getByLabel('Working stage', { exact: true }).selectOption('requirements');
  await dialog.getByRole('button', { name: 'Save stage', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await open();
  await expect(dialog).toContainText('Current stage: Requirements');
  await dialog.getByLabel('Working stage', { exact: true }).selectOption('contacted');
  await dialog.getByRole('button', { name: 'Save stage', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await open();
  await expect(dialog).toContainText('Current stage: Contacted');

  await dialog.getByRole('button', { name: 'Mark Lost', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();

  await dialog.getByLabel('Lost reason', { exact: true }).selectOption('other');
  await dialog.getByRole('button', { name: 'Mark Lost', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Explain');

  await dialog.getByLabel('Explain Other', { exact: true }).fill('Synthetic Lost evidence');
  await dialog
    .getByLabel('Lost internal note (optional)', { exact: true })
    .fill('Retain internal note');

  await dialog.getByRole('button', { name: 'Mark Lost', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await open();
  await expect(dialog).toContainText('Current stage: Lost');
  await expect(dialog.getByLabel('Customer name', { exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Save assignment', exact: true })).toHaveCount(0);
  await expect(dialog).toContainText('Synthetic Lost evidence');

  await dialog.getByRole('button', { name: 'Reopen lead', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();

  await dialog.getByLabel('Reopening reason', { exact: true }).fill('Client resumed the inquiry');
  await dialog.getByRole('button', { name: 'Reopen lead', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await open();
  await expect(dialog).toContainText('Current stage: Contacted');
  await expect(dialog).toContainText('Synthetic Lost evidence');
  await expect(dialog).toContainText('Client resumed the inquiry');
  await expect(dialog.getByLabel('Customer name', { exact: true })).toBeEnabled();

  expect(
    (
      await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('competing requests reject a stale version and a lost response reuses one request ID', async ({
  page,
  leads,
}) => {
  const actor = await leads.account('sales_executive');

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  expect(Boolean((await client.auth.signInWithPassword(actor)).error)).toBe(false);

  const name = `Concurrent ${randomUUID()}`;

  const created = await client.rpc('crm_save_lead', {
    p_request_id: randomUUID(),
    p_command: 'create',
    p_lead_id: null,
    p_version: null,
    p_data: {
      customer_name: name,
      assigned_user_id: actor.id,
      source_code: 'manual',
      priority: 'normal',
      inquiry_on: '2026-11-05',
    },
  });

  expect(Boolean(created.error)).toBe(false);

  const results = await Promise.all(
    ['contacted', 'requirements'].map((stage) =>
      client.rpc('crm_transition_lead', {
        p_request_id: randomUUID(),
        p_lead_id: created.data.lead.id,
        p_version: 1,
        p_command: 'move',
        p_data: { stage },
      }),
    ),
  );

  expect(results.filter((result) => !result.error)).toHaveLength(1);
  expect(results.filter((result) => result.error?.code === '40001')).toHaveLength(1);

  await signInLocalAccount(page, actor);
  await page.goto('/leads');
  await page.getByRole('button', { name, exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Lead information', exact: true });
  await dialog.getByLabel('Working stage', { exact: true }).selectOption('site-visit');

  const ids: string[] = [];

  await page.route('**/leads', async (route) => {
    const request = route.request();
    const id = (request.postData() ?? '').match(/"requestId":"([0-9a-f-]+)"/i)?.[1];

    if (request.method() !== 'POST' || !request.headers()['next-action'] || !id)
      return route.continue();

    ids.push(id);

    if (ids.length === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });

  await dialog.getByRole('button', { name: 'Save stage', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be confirmed');
  await expect(dialog.getByLabel('Customer name', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('button', { name: 'Save lead changes', exact: true }),
  ).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Retry same pipeline request', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  expect(ids).toHaveLength(2);
  expect(ids[0]).toBe(ids[1]);

  const detail = await client.rpc('crm_pipeline_detail', { p_lead_id: created.data.lead.id });

  expect(Boolean(detail.error)).toBe(false);
  expect(detail.data.events).toHaveLength(2);
});

test('Kanban dragging reviews the destination before persisting it', async ({ page, leads }) => {
  // A wide viewport lets the pointer reach both columns; mobile layout is
  // exercised by the other workflow scenarios in the mobile project.
  await page.setViewportSize({ width: 1280, height: 900 });

  const actor = await leads.account('sales_executive');
  await signInLocalAccount(page, actor);
  await page.goto('/leads');

  await page.getByRole('button', { name: 'Create lead', exact: true }).click();

  const create = page.getByRole('dialog', { name: 'Create lead', exact: true });
  const name = `Drag ${randomUUID()}`;

  await create.getByLabel('Customer name', { exact: true }).fill(name);
  await create.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(create).toHaveCount(0);

  await page.getByRole('button', { name: 'Kanban', exact: true }).click();

  const handle = page.getByRole('button', { name: `Move lead card for ${name}`, exact: true });
  const target = page.getByTestId('stage-assigned');

  await page.evaluate(() => document.fonts.ready);
  await handle.scrollIntoViewIfNeeded();

  const source = await handle.boundingBox();
  const destination = await target.boundingBox();

  if (!source || !destination) throw new Error('Kanban drag coordinates unavailable.');

  const x = source.x + source.width / 2;
  const y = source.y + source.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 4 });

  await expect(
    page
      .getByRole('button', { name, exact: true })
      .first()
      .locator('xpath=ancestor::div[starts-with(@data-testid,"lead-card-")]'),
  ).toHaveCSS('opacity', '0.4');

  await page.mouse.move(destination.x + destination.width / 2, Math.max(20, destination.y + 28), {
    steps: 20,
  });

  await expect(target).toHaveClass(/border-ring/);
  await page.mouse.up();

  const dialog = page.getByRole('dialog', { name: 'Lead information', exact: true });

  await expect(dialog.getByLabel('Working stage', { exact: true })).toHaveValue('assigned');
  await expect(dialog).toContainText('Current stage: New');

  await dialog.getByRole('button', { name: 'Save stage', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await expect(target.getByRole('button', { name, exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();

  await expect(target.getByRole('button', { name, exact: true })).toBeVisible();
});
