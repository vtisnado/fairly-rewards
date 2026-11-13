import { expect, test } from '@playwright/test';
import { desktop, pairingCodeOn, tablet } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

test('a business registers, connects a counter device, pauses it and adds a manager', async ({ browser }) => {
  const slug = `e2e-${Date.now().toString(36)}`;
  const owner = await desktop(browser);

  await owner.goto('/business/new');
  await owner.getByPlaceholder('Corner Café').fill('E2E Bakery');
  await owner.getByLabel('Web address').fill(slug);
  await expect(owner.getByText('Available.')).toBeVisible();
  await owner.getByRole('button', { name: 'Bakery' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: '+ Slow Mondays' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByLabel('Location name').fill('Main');
  const map = owner.locator('.leaflet-container').last();
  await map.click({ position: { x: 150, y: 120 } });
  await expect(owner.getByText('Drag the pin or tap the map to adjust it.')).toBeVisible();
  await owner.getByRole('button', { name: 'Add location', exact: true }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: /\$50/ }).click();
  await owner.getByRole('button', { name: /and launch/ }).click();
  await expect(owner.getByText('Your program is live')).toBeVisible({ timeout: 180_000 });
  await expect(owner).toHaveURL(new RegExp(`/business/${slug}$`));
  await owner.getByRole('button', { name: 'Connect a device' }).click();

  const device = await tablet(browser);
  await device.goto(`/cashier/${slug}`);
  await expect(device.getByText('Connect this device')).toBeVisible();
  const code = await pairingCodeOn(device);

  await owner.getByRole('button', { name: 'Connect a device' }).click();
  await owner.getByPlaceholder('ABC-123').fill(code);
  await owner.getByRole('button', { name: 'Connect device' }).click();
  await expect(owner.getByText('Device connected at Main')).toBeVisible({ timeout: 120_000 });
  await expect(device.getByText("Scan the customer's code")).toBeVisible({ timeout: 60_000 });

  await owner.getByRole('button', { name: 'Pause' }).click();
  await expect(owner.getByText('Paused', { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(device.getByText('Connect this device')).toBeVisible({ timeout: 60_000 });

  const manager = await desktop(browser);
  await manager.goto(`/business/${slug}/team`);
  const managerCode = await pairingCodeOn(manager);
  await owner.getByRole('button', { name: 'Settings' }).click();
  await owner.getByRole('button', { name: 'Invite a manager' }).click();
  await owner.getByRole('textbox', { name: /Code shown on the manager/ }).fill(managerCode);
  await owner.getByRole('button', { name: 'Add manager' }).click();
  await expect(owner.getByText('Manager added')).toBeVisible({ timeout: 120_000 });
  await expect(manager).toHaveURL(new RegExp(`/business/${slug}$`), { timeout: 60_000 });
  await expect(manager.getByText(/Manager ·/)).toBeVisible();
});
