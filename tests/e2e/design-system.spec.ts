import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const previewUrl = '/dev/design-system';

for (const width of [375, 600, 768, 900, 1024, 1440]) {
  test('preview fits ' + width + 'px', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    const response = await page.goto(previewUrl);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Beige by design.');
    await expect(page.getByRole('button', { name: 'Primary', exact: true })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
    const font = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain('Manrope');
    expect(errors).toEqual([]);
  });
}

test('native controls and preview actions work', async ({ page }) => {
  await page.goto(previewUrl);
  await page.getByRole('button', { name: 'Primary', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Primary preview selected.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Disabled example', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Saving preview/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Saving preview/ })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await page.getByLabel('Sample project name', { exact: false }).fill('Sample interior');
  await page.getByLabel('Sample notes').fill('Demonstration only');
  await page.getByRole('button', { name: 'Submit preview' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Preview submitted successfully.' }),
  ).toBeVisible();
  await expect(page.getByLabel('Invalid-state example')).toHaveAttribute(
    'aria-describedby',
    'specimen-error-help',
  );
});

test('keyboard focus is visible and controls activate', async ({ page }) => {
  await page.goto(previewUrl);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to preview content' })).toBeFocused();
  const primary = page.getByRole('button', { name: 'Primary', exact: true });
  let reached = false;
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    if (await primary.evaluate((el) => document.activeElement === el)) {
      reached = true;
      break;
    }
  }
  expect(reached).toBe(true);
  await expect(primary).toHaveCSS('outline-style', 'solid');
  await expect(primary).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('status').filter({ hasText: 'Primary preview selected.' }),
  ).toBeVisible();
});

test('reduced motion disables spatial animation and skeleton pulsing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(previewUrl);
  await expect(page.getByTestId('motion-sample')).toHaveAttribute('data-motion', 'reduced');
  await page.getByRole('button', { name: 'Toggle motion sample' }).click();
  await expect(page.getByRole('button', { name: 'Toggle motion sample' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Reduced motion respected.', { exact: true })).toBeVisible();
  const skeletons = page.locator('.animate-pulse');
  await expect(skeletons.first()).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByTestId('motion-sample')).toHaveAttribute('data-motion', 'enabled');
  expect(errors).toEqual([]);
});

test('design preview has no detected WCAG A/AA violations', async ({ page }) => {
  await page.goto(previewUrl);
  await page.evaluate(() => document.fonts.ready);
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations).toEqual([]);
});

test('core text and status token pairs meet 4.5 to 1 contrast', async ({ page }) => {
  await page.goto(previewUrl);
  const ratios = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = (input: string) => {
      let hex = input.trim().replace('#', '');
      if (hex.length === 3)
        hex = hex
          .split('')
          .map((part) => part + part)
          .join('');
      const values = hex
        .trim()
        .replace('#', '')
        .match(/.{2}/g)!
        .map((part) => {
          const channel = parseInt(part, 16) / 255;
          return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
    };
    return [
      ['--foreground', '--background'],
      ['--muted-foreground', '--card'],
      ['--muted-foreground', '--background'],
      ['--muted-foreground', '--muted'],
      ['--muted-foreground', '--secondary'],
      ['--primary-foreground', '--primary'],
      ['--secondary-foreground', '--secondary'],
      ['--accent-foreground', '--accent-soft'],
      ['--success', '--success-soft'],
      ['--warning', '--warning-soft'],
      ['--destructive', '--destructive-soft'],
      ['--destructive-foreground', '--destructive'],
      ['--info', '--info-soft'],
      ['--inverse-muted', '--inverse'],
    ].map(([fg, bg]) => {
      const a = luminance(style.getPropertyValue(fg));
      const b = luminance(style.getPropertyValue(bg));
      return {
        pair: fg + '/' + bg,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  });
  for (const result of ratios) expect(result.ratio, result.pair).toBeGreaterThanOrEqual(4.5);
});

test('glass has an opaque readable fallback', async ({ page }) => {
  await page.goto(previewUrl);
  // Neutralize support-dependent declarations to exercise the same fallback token.
  await page.addStyleTag({
    content:
      '.glass-panel { background: var(--glass-fallback) !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
  });
  await expect(page.locator('.glass-panel').first()).toHaveCSS(
    'background-color',
    'rgb(255, 252, 247)',
  );
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
