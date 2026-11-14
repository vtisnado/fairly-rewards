import { expect, test } from '@playwright/test';
import { DEMO_SLUG, desktop } from './helpers';

test('demo screens show the violet demo banner and the sample data label', async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto(`/business/${DEMO_SLUG}`);
  await expect(page.locator('[data-banner="demo"]')).toHaveText(/Demo account · sample data · test money/);
  await expect(page.getByTestId('sample-data-label')).toBeVisible();
  await page.goto(`/cashier/${DEMO_SLUG}`);
  await expect(page.locator('[data-banner="demo"]')).toBeVisible();
});

test('regular pages show the neutral testnet notice', async ({ browser }) => {
  const page = await desktop(browser);
  await page.goto('/');
  await expect(page.locator('[data-banner="testnet"]')).toHaveText(/NEAR testnet · test money only/);
});
