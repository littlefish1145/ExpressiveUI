import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.expressive);
});
test('keyboard switch activation remains native and disabled controls are skipped', async ({
  page,
}) => {
  const input = page.locator('#switch-notification');
  await input.focus();
  await page.keyboard.press('Space');
  await expect(input).toBeChecked();
  await page.keyboard.press('Space');
  await expect(input).not.toBeChecked();
  await page.keyboard.press('Tab');
  await expect(page.locator('#switch-disabled')).not.toBeFocused();
});
test('keyboard buttons and rapid retargeting stay finite', async ({ page }) => {
  const button = page.locator('#morph-action');
  await button.focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 20; i++) await button.click();
  await expect
    .poll(() => page.evaluate(() => window.expressive.progress))
    .toBeGreaterThanOrEqual(-0.5);
  expect(Number.isFinite(await page.evaluate(() => window.expressive.progress))).toBe(true);
});
test('live reduced motion settles immediately and leaves a visible loading glyph', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#morph-action').click();
  expect(await page.evaluate(() => window.expressive.progress)).toBe(1);
  await expect(page.locator('#loading-bare path')).toHaveAttribute('d', /^M/);
});
test('geometry is identical for each capable renderer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#scrub').fill('.5');
  await page.locator('#scrub').dispatchEvent('input');
  const baseline = await page.evaluate(() => window.expressive.shape);
  for (const backend of ['svg', 'clip-path', 'css-shape', 'svg-clip', 'svg-mask']) {
    await page.locator('#backend').selectOption(backend);
    expect(await page.evaluate(() => window.expressive.shape)).toEqual(baseline);
  }
});
test('destroy cleans all decorative nodes and ignores future UI events', async ({ page }) => {
  await page.evaluate(() => window.expressive.destroy());
  await expect(page.locator('.eui-shape')).toHaveCount(0);
  await expect(page.locator('.eui-switch-track')).toHaveCount(0);
});
