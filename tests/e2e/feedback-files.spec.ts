import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type PreviewTestWindow = Window & {
  __revokedPreviewUrls?: string[];
};

function samplePdf(name = 'brief.pdf') {
  return {
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nFictional metadata preview only.'),
  };
}

async function samplePng(page: Page) {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas is unavailable.');
    }

    context.fillStyle = '#78583e';
    context.fillRect(0, 0, 2, 2);

    return canvas.toDataURL('image/png').split(',')[1];
  });

  return {
    name: 'room.png',
    mimeType: 'image/png',
    buffer: Buffer.from(encoded, 'base64'),
  };
}

test('notifications can be dismissed and restore trigger focus', async ({ page }) => {
  await page.goto('/dev/component-library');

  const trigger = page.getByRole('button', {
    name: 'Show information',
    exact: true,
  });

  await trigger.focus();
  await trigger.click();

  const notifications = page.getByRole('list', {
    name: 'Notifications',
    exact: true,
  });

  await expect(notifications).toContainText('Preview information');

  await notifications
    .getByRole('button', {
      name: 'Dismiss Preview information',
      exact: true,
    })
    .click();

  await expect(notifications).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('notification stack is limited to three and can be cleared', async ({ page }) => {
  await page.goto('/dev/component-library');

  for (const name of ['Show information', 'Show success', 'Show warning', 'Show information']) {
    await page.getByRole('button', { name, exact: true }).click();
  }

  const notifications = page.getByRole('list', {
    name: 'Notifications',
    exact: true,
  });

  await expect(notifications.getByRole('listitem')).toHaveCount(3);

  await page
    .getByRole('button', {
      name: 'Dismiss all notifications',
      exact: true,
    })
    .click();

  await expect(notifications).toHaveCount(0);

  await expect(
    page.getByRole('button', {
      name: 'Show information',
      exact: true,
    }),
  ).toBeFocused();
});

test('native file input supports keyboard selection', async ({ page }) => {
  await page.goto('/dev/component-library');

  const input = page.getByRole('button', { name: 'Reference files', exact: true });

  await input.focus();
  await expect(input).toBeFocused();

  const chooserPromise = page.waitForEvent('filechooser');
  await input.press('Enter');

  const chooser = await chooserPromise;
  await chooser.setFiles(samplePdf());

  const files = page.getByRole('list', {
    name: 'Selected files',
    exact: true,
  });

  await expect(files).toContainText('brief.pdf');

  await expect(page.getByTestId('selected-file-count')).toHaveText('1 of 3 files selected');
});

test('files can be added by drag and drop', async ({ page }) => {
  await page.goto('/dev/component-library');

  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();

    data.items.add(
      new File(['%PDF-1.7\nFictional dropped file.'], 'dropped.pdf', { type: 'application/pdf' }),
    );

    return data;
  });

  const dropzone = page.getByTestId('file-dropzone');

  await dropzone.dispatchEvent('dragenter', {
    dataTransfer: transfer,
  });

  await dropzone.dispatchEvent('dragover', {
    dataTransfer: transfer,
  });

  await dropzone.dispatchEvent('drop', {
    dataTransfer: transfer,
  });

  await transfer.dispose();

  await expect(
    page.getByRole('list', {
      name: 'Selected files',
      exact: true,
    }),
  ).toContainText('dropped.pdf');
});

test('duplicate selections are rejected without removing the original', async ({ page }) => {
  await page.goto('/dev/component-library');

  const input = page.getByRole('button', { name: 'Reference files', exact: true });

  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();

    data.items.add(
      new File(['Sample'], 'same.pdf', {
        type: 'application/pdf',
        lastModified: 1000,
      }),
    );

    return data;
  });

  const dropzone = page.getByTestId('file-dropzone');

  await dropzone.dispatchEvent('drop', {
    dataTransfer: transfer,
  });

  await dropzone.dispatchEvent('drop', {
    dataTransfer: transfer,
  });

  await transfer.dispose();

  await expect(
    page.getByRole('group', { name: 'Reference files', exact: true }).getByRole('alert'),
  ).toContainText('same.pdf is already selected.');

  await expect(
    page
      .getByRole('list', {
        name: 'Selected files',
        exact: true,
      })
      .getByRole('listitem'),
  ).toHaveCount(1);

  await expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('unsupported file types are rejected', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page.getByRole('button', { name: 'Reference files', exact: true }).setInputFiles({
    name: 'unsupported.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg></svg>'),
  });

  await expect(
    page.getByRole('group', { name: 'Reference files', exact: true }).getByRole('alert'),
  ).toContainText('not accepted');

  await expect(
    page.getByRole('list', {
      name: 'Selected files',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('heading', {
      name: 'No files selected',
      exact: true,
    }),
  ).toBeVisible();
});

test('oversized files are rejected', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page.getByRole('button', { name: 'Reference files', exact: true }).setInputFiles({
    name: 'oversized.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1),
  });

  await expect(
    page.getByRole('group', { name: 'Reference files', exact: true }).getByRole('alert'),
  ).toContainText('exceeds the 2 MiB limit');

  await expect(page.getByTestId('selected-file-count')).toHaveText('0 of 3 files selected');
});

test('file-count limit keeps valid files and reports overflow', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', { name: 'Reference files', exact: true })
    .setInputFiles([
      samplePdf('one.pdf'),
      samplePdf('two.pdf'),
      samplePdf('three.pdf'),
      samplePdf('four.pdf'),
    ]);

  await expect(
    page
      .getByRole('list', {
        name: 'Selected files',
        exact: true,
      })
      .getByRole('listitem'),
  ).toHaveCount(3);

  await expect(
    page.getByRole('group', { name: 'Reference files', exact: true }).getByRole('alert'),
  ).toContainText('Only 3 files can be selected.');
});

test('document preview shows metadata and restores focus', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', { name: 'Reference files', exact: true })
    .setInputFiles(samplePdf());

  const trigger = page.getByRole('button', {
    name: 'Preview brief.pdf',
    exact: true,
  });

  await trigger.click();

  const dialog = page.getByRole('dialog', {
    name: 'Selected file preview',
    exact: true,
  });

  await expect(dialog).toContainText('brief.pdf');
  await expect(dialog).toContainText('application/pdf');
  await expect(dialog).toContainText('document content is not rendered');

  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('image preview loads and its object URL is released after removal', async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as PreviewTestWindow;
    target.__revokedPreviewUrls = [];

    const original = URL.revokeObjectURL.bind(URL);

    URL.revokeObjectURL = (url: string) => {
      target.__revokedPreviewUrls?.push(url);
      original(url);
    };
  });

  await page.goto('/dev/component-library');

  const input = page.getByRole('button', { name: 'Reference files', exact: true });

  await input.setInputFiles(await samplePng(page));

  await page
    .getByRole('button', {
      name: 'Preview room.png',
      exact: true,
    })
    .click();

  const dialog = page.getByRole('dialog', {
    name: 'Selected file preview',
    exact: true,
  });

  const image = dialog.getByRole('img', {
    name: 'Local preview of room.png',
    exact: true,
  });

  await expect
    .poll(() =>
      image.evaluate((element) => {
        const imageElement = element as HTMLImageElement;

        return imageElement.complete && imageElement.naturalWidth > 0;
      }),
    )
    .toBe(true);

  const previewUrl = await image.getAttribute('src');
  expect(previewUrl).toMatch(/^blob:/);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page
    .getByRole('button', {
      name: 'Remove room.png',
      exact: true,
    })
    .click();

  await expect(input).toBeFocused();

  await expect
    .poll(() =>
      page.evaluate((url) => {
        const target = window as PreviewTestWindow;

        return target.__revokedPreviewUrls?.includes(url ?? '') ?? false;
      }, previewUrl),
    )
    .toBe(true);

  await expect(page.getByTestId('selected-file-count')).toHaveText('0 of 3 files selected');
});

test('clearing selection restores the empty state', async ({ page }) => {
  await page.goto('/dev/component-library');

  const input = page.getByRole('button', { name: 'Reference files', exact: true });

  await input.setInputFiles([samplePdf('one.pdf'), samplePdf('two.pdf')]);

  await page
    .getByRole('button', {
      name: 'Clear selected files',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('list', {
      name: 'Selected files',
      exact: true,
    }),
  ).toHaveCount(0);

  await expect(
    page.getByRole('heading', {
      name: 'No files selected',
      exact: true,
    }),
  ).toBeVisible();

  await expect(input).toBeFocused();
});

test('selected files can produce an accurate notification', async ({ page }) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', { name: 'Reference files', exact: true })
    .setInputFiles(samplePdf());

  await page
    .getByRole('button', {
      name: 'Show selection notice',
      exact: true,
    })
    .click();

  const notifications = page.getByRole('list', {
    name: 'Notifications',
    exact: true,
  });

  await expect(notifications).toContainText('Files selected locally');

  await expect(notifications).toContainText('Nothing has been uploaded.');
});

for (const width of [375, 768, 1440]) {
  test(`file selection fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({
      width,
      height: 1000,
    });

    await page.goto('/dev/component-library');

    await page
      .getByRole('button', { name: 'Reference files', exact: true })
      .setInputFiles(samplePdf(`${'long-filename-'.repeat(8)}.pdf`));

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));

    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}

test('selected files and notifications have no detected WCAG A or AA violations', async ({
  page,
}) => {
  await page.goto('/dev/component-library');

  await page
    .getByRole('button', { name: 'Reference files', exact: true })
    .setInputFiles(samplePdf());

  await page
    .getByRole('button', {
      name: 'Show information',
      exact: true,
    })
    .click();

  await expect(
    page.getByRole('list', {
      name: 'Notifications',
      exact: true,
    }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
