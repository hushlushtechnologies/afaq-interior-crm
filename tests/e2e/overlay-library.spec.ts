import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('dialog traps focus and restores it after Escape', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Edit sample label',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Edit sample label',
    exact: true,
  });

  const input = dialog.getByLabel('Sample label', {
    exact: true,
  });

  await expect(input).toBeFocused();

  await page.keyboard.press('Shift+Tab');

  await expect(
    dialog.getByRole('button', {
      name: 'Close dialog',
      exact: true,
    }),
  ).toBeFocused();

  await page.keyboard.press('Shift+Tab');

  await expect(
    dialog.getByRole('button', {
      name: 'Apply locally',
      exact: true,
    }),
  ).toBeFocused();

  await page.keyboard.press('Tab');

  await expect(
    dialog.getByRole('button', {
      name: 'Close dialog',
      exact: true,
    }),
  ).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('dialog validates and applies a local change', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Edit sample label',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Edit sample label',
    exact: true,
  });

  const input = dialog.getByLabel('Sample label', {
    exact: true,
  });

  await input.fill(' ');

  await dialog
    .getByRole('button', {
      name: 'Apply locally',
      exact: true,
    })
    .click();

  await expect(dialog).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');

  await input.fill('Soft neutral concept');

  await dialog
    .getByRole('button', {
      name: 'Apply locally',
      exact: true,
    })
    .click();

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await expect(
    page.getByText('Soft neutral concept', {
      exact: true,
    }),
  ).toBeVisible();

  await expect(page.getByRole('status')).toContainText('Nothing was saved to a server.');
});

test('cancelling a dialog discards its draft', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Edit sample label',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Edit sample label',
    exact: true,
  });

  await dialog.getByLabel('Sample label', { exact: true }).fill('Discard this sample');

  await dialog
    .getByRole('button', {
      name: 'Cancel',
      exact: true,
    })
    .click();

  await expect(dialog).toHaveCount(0);

  await trigger.click();

  await expect(dialog.getByLabel('Sample label', { exact: true })).toHaveValue(
    'Warm beige concept',
  );
});

test('confirmation focuses Cancel and ignores outside clicks', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Preview removal',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Preview removal?',
    exact: true,
  });

  const cancel = dialog.getByRole('button', {
    name: 'Cancel',
    exact: true,
  });

  await expect(cancel).toBeFocused();

  await page.mouse.click(5, 5);

  await expect(dialog).toBeVisible();

  await cancel.click();

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('confirmation produces a local preview message', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Preview removal',
      exact: true,
    })
    .click();

  const dialog = page.getByRole('dialog', {
    name: 'Preview removal?',
    exact: true,
  });

  await dialog
    .getByRole('button', {
      name: 'Confirm preview removal',
      exact: true,
    })
    .click();

  await expect(dialog).toHaveCount(0);

  await expect(page.getByRole('status')).toContainText('No record was deleted.');
});

test('drawer restores focus and preserves its local draft', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Open sample drawer',
    exact: true,
  });

  await trigger.click();

  const drawer = page.getByRole('dialog', {
    name: 'Sample lead context',
    exact: true,
  });

  const note = drawer.getByLabel('Drawer sample note', {
    exact: true,
  });

  await expect(note).toBeFocused();

  await note.fill('Fictional drawer note.');

  await page.keyboard.press('Escape');

  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();

  await trigger.click();

  await expect(
    drawer.getByLabel('Drawer sample note', {
      exact: true,
    }),
  ).toHaveValue('Fictional drawer note.');

  await drawer
    .getByRole('button', {
      name: 'Done',
      exact: true,
    })
    .click();

  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('tabs support arrows, Home, End, and skip disabled tabs', async ({ page }) => {
  await page.goto('/dev/component-library');

  const tablist = page.getByRole('tablist', {
    name: 'Record preview sections',
    exact: true,
  });

  const overview = tablist.getByRole('tab', {
    name: 'Overview',
    exact: true,
  });

  const activity = tablist.getByRole('tab', {
    name: 'Activity',
    exact: true,
  });

  const notes = tablist.getByRole('tab', {
    name: 'Notes',
    exact: true,
  });

  await expect(
    tablist.getByRole('tab', {
      name: 'Files',
      exact: true,
    }),
  ).toBeDisabled();

  await overview.focus();
  await page.keyboard.press('ArrowRight');

  await expect(activity).toBeFocused();
  await expect(activity).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('ArrowRight');

  await expect(notes).toBeFocused();
  await expect(notes).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Home');
  await expect(overview).toBeFocused();

  await page.keyboard.press('End');
  await expect(notes).toBeFocused();

  await expect(page.getByRole('tabpanel')).toHaveCount(1);
});

test('switching tabs preserves field values', async ({ page }) => {
  await page.goto('/dev/component-library');

  const tablist = page.getByRole('tablist', {
    name: 'Record preview sections',
    exact: true,
  });

  await tablist.getByRole('tab', { name: 'Notes', exact: true }).click();

  await page.getByLabel('Tabbed sample note', { exact: true }).fill('Keep this fictional draft.');

  await tablist
    .getByRole('tab', {
      name: 'Overview',
      exact: true,
    })
    .click();

  await expect(
    page.getByLabel('Tabbed sample note', {
      exact: true,
    }),
  ).not.toBeVisible();

  await tablist.getByRole('tab', { name: 'Notes', exact: true }).click();

  await expect(
    page.getByLabel('Tabbed sample note', {
      exact: true,
    }),
  ).toHaveValue('Keep this fictional draft.');
});

test('open dialog has no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Edit sample label',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('dialog', {
      name: 'Edit sample label',
      exact: true,
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('open drawer has no detected WCAG A or AA violations', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Open sample drawer',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('dialog', {
      name: 'Sample lead context',
      exact: true,
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});

test('dialog respects reduced motion', async ({ page }) => {
  await page.emulateMedia({
    reducedMotion: 'reduce',
  });

  await page.goto('/dev/component-library');

  await page
    .getByRole('button', {
      name: 'Edit sample label',
      exact: true,
    })
    .click();

  const dialog = page.getByRole('dialog', {
    name: 'Edit sample label',
    exact: true,
  });

  await expect(dialog).toBeVisible();

  const animationName = await dialog.evaluate((element) => getComputedStyle(element).animationName);

  expect(animationName).toBe('none');
});

for (const width of [375, 768, 1440]) {
  test(`overlays stay within the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: 900,
    });

    await page.goto('/dev/component-library');

    for (const example of [
      {
        trigger: 'Edit sample label',
        title: 'Edit sample label',
      },
      {
        trigger: 'Open sample drawer',
        title: 'Sample lead context',
      },
    ]) {
      await page
        .getByRole('button', {
          name: example.trigger,
          exact: true,
        })
        .click();

      const dialog = page.getByRole('dialog', {
        name: example.title,
        exact: true,
      });

      await expect(dialog).toBeVisible();

      await expect(async () => {
        const dimensions = await dialog.evaluate((element) => {
          const bounds = element.getBoundingClientRect();

          return {
            left: bounds.left,
            right: bounds.right,
            viewport: window.innerWidth,
          };
        });

        expect(dimensions.left).toBeGreaterThanOrEqual(-1);
        expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport + 1);
      }).toPass();

      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });
}
