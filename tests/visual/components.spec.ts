import { test, expect } from '@playwright/test';
declare global {
  interface Window {
    expressive: {
      capabilities: Record<string, boolean>;
      readonly progress: number;
      readonly backend: string;
      readonly shape: number[];
      pause(): void;
      destroy(): void;
    };
  }
}
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForFunction(() => !!window.expressive);
});
test('native component light and dark baselines', async ({ page }) => {
  for (const mode of ['light', 'dark']) {
    await page.locator('#dark-mode').setChecked(mode === 'dark');
    await expect(page.locator('.component-grid')).toHaveScreenshot(`components-${mode}.png`, {
      animations: 'disabled',
    });
  }
});
for (const backend of ['svg', 'clip-path', 'css-shape', 'svg-clip', 'svg-mask'])
  test(`shape backend ${backend}`, async ({ page }) => {
    await page.locator('#backend').selectOption(backend);
    await page.locator('#scrub').fill('.5');
    await page.locator('#scrub').dispatchEvent('input');
    const geometry = await page.evaluate(() => window.expressive.shape);
    expect(geometry).toHaveLength(512);
    expect(geometry.every(Number.isFinite)).toBeTruthy();
    const bounds = { min: Math.min(...geometry), max: Math.max(...geometry) };
    expect(bounds.min).toBeGreaterThan(-0.1);
    expect(bounds.max).toBeLessThan(1.1);
    await expect(page.locator('.morph-preview')).toHaveScreenshot(`morph-${backend}.png`, {
      animations: 'disabled',
    });
  });
test('DPR and dynamic non-square layout', async ({ page }) => {
  await page.locator('#aspect').fill('2');
  await page.locator('#aspect').dispatchEvent('input');
  await page.locator('#shape-to').selectOption('rounded:small');
  await page.locator('#scrub').fill('1');
  await page.locator('#scrub').dispatchEvent('input');
  expect((await page.locator('#morph-shape').boundingBox())!.width).toBeGreaterThan(
    (await page.locator('#morph-shape').boundingBox())!.height,
  );
  await expect(page.locator('.morph-preview')).toHaveScreenshot('non-square.png', {
    animations: 'disabled',
  });
});
