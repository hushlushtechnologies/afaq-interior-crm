import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openDemo(page: Page, pathname: string) {
  await page.goto(pathname.startsWith('/leads') ? `${pathname}?preview=1` : pathname);
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo data reset.' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss preview message', exact: true }).click();
}

test('dashboard date range changes the sample inquiry count', async ({ page }) => {
  await page.goto('/dashboard');

  const count = page.getByTestId('dashboard-lead-count');
  const period = page.getByLabel('Dashboard date range', {
    exact: true,
  });

  await expect(count).toContainText('11');

  await period.selectOption('7');
  await expect(count).toContainText('4');

  await period.selectOption('all');
  await expect(count).toContainText('12');
});

test('dashboard supports simulated error and empty states', async ({ page }) => {
  await page.goto('/dashboard');

  const previewState = page.getByLabel('Preview state', {
    exact: true,
  });

  await previewState.selectOption('error');

  await page.getByRole('button', { name: 'Retry preview', exact: true }).click();

  await expect(page.getByTestId('dashboard-lead-count')).toBeVisible();

  await previewState.selectOption('empty');

  await page
    .getByRole('button', {
      name: 'Show sample data',
      exact: true,
    })
    .click();

  await expect(page.getByTestId('dashboard-lead-count')).toBeVisible();
});

test('lead filters stay applied when switching views', async ({ page }) => {
  await openDemo(page, '/leads');

  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('Website');

  await page.getByRole('combobox', { name: 'Owner', exact: true }).selectOption('owner-b');

  await page.getByLabel('Search demo leads', { exact: true }).fill('Compact');

  await expect(page.locator('#lead-results-status')).toContainText('1 of 12');

  await expect(page.getByTestId('lead-row-demo-011')).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Show Kanban view',
      exact: true,
    })
    .click();

  await expect(page.getByTestId('lead-card-demo-011')).toBeVisible();

  await expect(page.getByTestId('lead-card-demo-001')).toHaveCount(0);

  await page
    .getByRole('button', {
      name: 'Show table view',
      exact: true,
    })
    .click();

  await expect(page.getByTestId('lead-row-demo-011')).toBeVisible();

  await expect(page.getByLabel('Search demo leads', { exact: true })).toHaveValue('Compact');

  await page
    .getByRole('button', {
      name: 'Clear filters',
      exact: true,
    })
    .click();

  await expect(page.locator('#lead-results-status')).toContainText('12 of 12');
});

test('table supports pagination, sorting, and column visibility', async ({ page }) => {
  await openDemo(page, '/leads');

  const table = page.getByRole('table');

  await expect(table.locator('tbody tr')).toHaveCount(5);

  await page.getByLabel('Rows per page', { exact: true }).selectOption('10');

  await expect(table.locator('tbody tr')).toHaveCount(10);

  await page
    .getByRole('button', {
      name: 'Next page',
      exact: true,
    })
    .click();

  await expect(table.locator('tbody tr')).toHaveCount(2);

  await page
    .getByRole('button', {
      name: 'Previous page',
      exact: true,
    })
    .click();

  await expect(table.locator('tbody tr')).toHaveCount(10);

  const budgetSort = table.getByRole('columnheader', { name: /budget/i }).getByRole('button');

  await budgetSort.click();

  await expect(table.locator('tbody tr').first()).toContainText('Farah Ali');

  await budgetSort.click();

  await expect(table.locator('tbody tr').first()).toContainText('Adam Nabil');

  await page.locator('summary').filter({ hasText: 'Columns' }).click();

  const columnControls = page.getByRole('group', {
    name: 'Visible table columns',
    exact: true,
  });

  await columnControls.getByRole('checkbox', { name: 'Source', exact: true }).uncheck();

  await expect(table.getByRole('columnheader', { name: /source/i })).toHaveCount(0);

  await columnControls.getByRole('checkbox', { name: 'Source', exact: true }).check();

  await expect(table.getByRole('columnheader', { name: /source/i })).toBeVisible();
});

test('stage control moves a card and preserves control focus', async ({ page }) => {
  await openDemo(page, '/leads/pipeline');

  const stageControl = page.getByLabel('Move Noor Rahman to stage', { exact: true });

  await stageControl.focus();
  await stageControl.selectOption('assigned');

  const movedControl = page.getByLabel('Move Noor Rahman to stage', { exact: true });

  await expect(movedControl).toHaveValue('assigned');
  await expect(movedControl).toBeFocused();

  await expect(page.getByTestId('stage-assigned').getByTestId('lead-card-demo-001')).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Show table view',
      exact: true,
    })
    .click();

  await page.getByLabel('Search demo leads', { exact: true }).fill('Noor Rahman');

  await expect(
    page.getByLabel('Move Noor Rahman to stage', {
      exact: true,
    }),
  ).toHaveValue('assigned');
});

test('pointer dragging moves an open card between stages', async ({ page }) => {
  await openDemo(page, '/leads/pipeline');

  const handle = page.getByRole('button', {
    name: 'Move demo card for Noor Rahman',
    exact: true,
  });

  await page.evaluate(() => document.fonts.ready);

  await page
    .getByTestId('stage-assigned')
    .getByRole('heading', { name: 'Assigned', exact: true })
    .scrollIntoViewIfNeeded();

  await handle.scrollIntoViewIfNeeded();

  const target = page.getByTestId('stage-assigned');
  const sourceBox = await handle.boundingBox();

  if (!sourceBox) {
    throw new Error('The drag handle or target column is unavailable.');
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();

  await page.mouse.move(startX + 12, startY + 12, {
    steps: 4,
  });

  await expect(page.getByTestId('lead-card-demo-001')).toHaveCSS('opacity', '0.4');

  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('The destination column is unavailable.');

  const dropY = Math.max(20, targetBox.y + 28);
  await page.mouse.move(targetBox.x + targetBox.width / 2, dropY, { steps: 20 });
  await expect(target).toHaveClass(/border-ring/);

  await page.mouse.up();

  await expect(target.getByTestId('lead-card-demo-001')).toBeVisible();
});

test('protected outcome options and closed lead controls are disabled', async ({ page }) => {
  await openDemo(page, '/leads/pipeline');

  const openControl = page.getByLabel('Move Noor Rahman to stage', { exact: true });

  await expect(openControl.locator('option[value="won"]')).toBeDisabled();

  await expect(openControl.locator('option[value="lost"]')).toBeDisabled();

  await expect(
    page.getByLabel('Move Karim Adel to stage', {
      exact: true,
    }),
  ).toBeDisabled();

  await expect(
    page.getByLabel('Move Sara Ibrahim to stage', {
      exact: true,
    }),
  ).toBeDisabled();
});

test('details changes stay shared with the leads table', async ({ page }) => {
  await openDemo(page, '/leads/details/demo-001');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Noor Rahman',
      exact: true,
    }),
  ).toBeVisible();

  await page.getByLabel('Assigned sample owner', { exact: true }).selectOption('owner-b');

  await page
    .getByLabel('Move Noor Rahman to stage', {
      exact: true,
    })
    .selectOption('contacted');

  const requirements = page.getByRole('region', {
    name: 'Requirements checklist',
    exact: true,
  });

  const measurementCheckbox = requirements.getByRole('checkbox').nth(2);

  await expect(measurementCheckbox).not.toBeChecked();
  await measurementCheckbox.check();
  await expect(measurementCheckbox).toBeChecked();

  const notes = page.getByRole('region', {
    name: 'Internal notes',
    exact: true,
  });

  const noteText = 'Sample request: use warmer beige finishes.';

  await notes.getByLabel('New note', { exact: true }).fill(noteText);

  await notes
    .getByRole('button', {
      name: 'Add demo note',
      exact: true,
    })
    .click();

  await expect(notes.getByText(noteText, { exact: true })).toBeVisible();

  await expect(notes.getByLabel('New note', { exact: true })).toHaveValue('');

  await page
    .getByRole('navigation', {
      name: 'Lead navigation',
      exact: true,
    })
    .getByRole('link', { name: 'All leads', exact: true })
    .click();

  await page.getByLabel('Search demo leads', { exact: true }).fill('Noor Rahman');

  const row = page.getByTestId('lead-row-demo-001');

  await expect(row).toContainText('Daniel Reed');

  await expect(
    row.getByLabel('Move Noor Rahman to stage', {
      exact: true,
    }),
  ).toHaveValue('contacted');

  await row
    .getByRole('link', {
      name: 'Noor Rahman',
      exact: true,
    })
    .click();

  await expect(
    page
      .getByRole('region', {
        name: 'Internal notes',
        exact: true,
      })
      .getByText(noteText, { exact: true }),
  ).toBeVisible();

  await expect(
    page
      .getByRole('region', {
        name: 'Requirements checklist',
        exact: true,
      })
      .getByRole('checkbox')
      .nth(2),
  ).toBeChecked();
});

test('notes reject whitespace and contact actions announce their preview', async ({ page }) => {
  await openDemo(page, '/leads/details/demo-001');

  await page.getByLabel('New note', { exact: true }).fill('   ');

  await page
    .getByRole('button', {
      name: 'Add demo note',
      exact: true,
    })
    .click();

  await expect(page.getByRole('main').getByRole('alert')).toHaveText(
    'Enter a note before adding it.',
  );

  await page
    .getByRole('button', {
      name: 'Preview WhatsApp',
      exact: true,
    })
    .click();

  await expect(page.getByRole('status')).toContainText('No message was sent.');
});

test('reset restores sample lead values and removes local notes', async ({ page }) => {
  await openDemo(page, '/leads/details/demo-001');

  await page.getByLabel('Assigned sample owner', { exact: true }).selectOption('owner-b');

  await page.getByLabel('New note', { exact: true }).fill('Temporary reset verification note.');

  await page
    .getByRole('button', {
      name: 'Add demo note',
      exact: true,
    })
    .click();

  await expect(
    page.getByText('Temporary reset verification note.', {
      exact: true,
    }),
  ).toBeVisible();

  await page
    .getByRole('button', {
      name: 'Reset demo',
      exact: true,
    })
    .click();

  await expect(page.getByLabel('Assigned sample owner', { exact: true })).toHaveValue('owner-a');

  await expect(
    page.getByText('Temporary reset verification note.', {
      exact: true,
    }),
  ).toHaveCount(0);
});

test('lead detail routes reject unknown sample IDs', async ({ page }) => {
  const response = await page.goto('/leads/details/not-a-sample-lead');

  expect([200, 404]).toContain(response?.status());
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText('This page could not be found.', { exact: true })).toBeVisible();
});

for (const width of [375, 600, 768, 900, 1024, 1440]) {
  test(`lead screens fit the document at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: 1000,
    });

    for (const pathname of ['/leads', '/leads/pipeline', '/leads/details/demo-001']) {
      await openDemo(page, pathname);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));

      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });
}

test('lead details have no detected WCAG A or AA violations', async ({ page }) => {
  await openDemo(page, '/leads/details/demo-001');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('leads table has no detected WCAG A or AA violations', async ({ page }) => {
  await openDemo(page, '/leads');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('lead details work with reduced motion and keyboard focus', async ({ page }) => {
  await page.emulateMedia({
    reducedMotion: 'reduce',
  });

  await openDemo(page, '/leads/details/demo-001');

  const ownerControl = page.getByLabel('Assigned sample owner', { exact: true });

  await ownerControl.focus();
  await expect(ownerControl).toBeFocused();

  await page.keyboard.press('Tab');

  await expect(ownerControl).not.toBeFocused();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Noor Rahman',
      exact: true,
    }),
  ).toBeVisible();
});
