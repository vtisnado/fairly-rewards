import { expect, test } from '@playwright/test';
import { closeCashierGuide, desktop, joinAsCustomer, openCardDetail, pairingCodeOn, phone, showWalletCode, tablet, typeOnKeypad } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

test('prog_018_prog_019_run_008_wal_021_sale_012_cashback_above_the_pool_is_pending_blocks_selling_and_settles_into_available', async ({ browser }) => {
  test.setTimeout(480_000);
  const slug = `e2e-pp-${Date.now().toString(36)}`;
  const owner = await desktop(browser);

  await owner.goto('/business/new');
  await owner.getByPlaceholder('Corner Café').fill('E2E Post Pay');
  await owner.getByLabel('Web address').fill(slug);
  await expect(owner.getByText('Available.')).toBeVisible();
  await owner.getByRole('button', { name: 'Bakery' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await owner.getByLabel('Location name').fill('Main');
  await owner.locator('.leaflet-container').last().click({ position: { x: 150, y: 120 } });
  await expect(owner.getByText('Drag the pin or tap the map to adjust it.')).toBeVisible();
  await owner.getByRole('button', { name: 'Add location', exact: true }).click();
  await owner.getByRole('button', { name: 'Continue' }).click();
  await expect(owner.getByTestId('start-small')).toContainText('Start small: cashback above your pool waits as Pending until your weekly settlement');
  await owner.getByRole('button', { name: /\$20/ }).first().click();
  await owner.getByRole('button', { name: /Add \$20\.00 and launch/ }).click();
  await expect(owner.getByText('Your program is live')).toBeVisible({ timeout: 180_000 });
  await owner.getByRole('button', { name: 'Connect a device' }).click();

  const counter = await tablet(browser);
  await counter.goto(`/cashier/${slug}`);
  await expect(counter.getByText('Connect this device')).toBeVisible();
  const code = await pairingCodeOn(counter);
  await owner.getByRole('button', { name: 'Connect a device' }).click();
  await owner.getByPlaceholder('ABC-123').fill(code);
  await owner.getByRole('button', { name: 'Connect device' }).click();
  await expect(owner.getByText('Device connected at Main')).toBeVisible({ timeout: 120_000 });
  await expect(counter.getByText("Scan the customer's code")).toBeVisible({ timeout: 60_000 });
  await closeCashierGuide(counter);

  const customer = await phone(browser);
  await joinAsCustomer(customer);
  const shown = await showWalletCode(customer);
  await counter.getByLabel('Customer code').fill(shown.code);
  await counter.getByLabel('Customer code').press('Enter');
  await expect(counter.getByText('No card yet')).toBeVisible({ timeout: 60_000 });
  await counter.getByRole('button', { name: 'Issue card' }).click();
  await expect(counter.getByTestId('counter-balances')).toContainText('Available $0.00 · Pending $0.00', { timeout: 90_000 });
  await typeOnKeypad(counter, '50000');
  await counter.getByRole('button', { name: /Add to card/ }).click();
  await expect(counter.getByText('+$25.00')).toBeVisible({ timeout: 120_000 });
  await expect(counter.getByText(/\$5\.00 pending until the shop settles/)).toBeVisible();

  await customer.getByRole('button', { name: 'Back', exact: true }).click();
  await openCardDetail(customer, /^Open E2E Post Pay card$/);
  await expect(customer.getByTestId('card-available')).toContainText('$20.00', { timeout: 90_000 });
  await expect(customer.getByTestId('card-pending')).toContainText('$5.00');
  await expect(customer.getByTestId('card-pending-note')).toContainText('Pending · confirms when the shop settles');
  await expect(customer.getByTestId('sell-card')).toBeDisabled();
  await expect(customer.getByTestId('sell-blocked')).toBeVisible();

  await owner.getByRole('button', { name: 'Overview' }).click();
  await expect(owner.getByTestId('pending-amount')).toHaveText('$5.00', { timeout: 90_000 });
  await expect(owner.getByTestId('settlement-status')).toContainText('Waiting on 1 card');
  await owner.getByTestId('settle-now').click();
  await expect(owner.getByTestId('pending-to-settle')).toBeHidden({ timeout: 180_000 });

  await expect(customer.getByTestId('card-available')).toContainText('$25.00', { timeout: 90_000 });
  await expect(customer.getByTestId('card-pending')).toContainText('$0.00');
  await expect(customer.getByTestId('sell-card')).toBeEnabled();
  await expect(customer.getByTestId('sell-blocked')).toBeHidden();
});
