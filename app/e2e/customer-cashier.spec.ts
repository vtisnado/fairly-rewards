import { expect, test } from '@playwright/test';
import { DEMO_SLUG, cardCode, closeCashierGuide, joinAsCustomer, phone, tablet, typeOnKeypad } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

test('customer joins, earns cashback at the counter and spends it with a balance code', async ({ browser }) => {
  const customer = await phone(browser);
  const tokenId = await joinAsCustomer(customer);

  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByLabel('Card code').fill(cardCode(tokenId).toLowerCase());
  await cashier.getByLabel('Card code').press('Enter');
  await expect(cashier.getByText(`Card ${cardCode(tokenId).slice(0, 3)}-${cardCode(tokenId).slice(3)}`)).toBeVisible();
  await typeOnKeypad(cashier, '1250');
  await expect(cashier.getByText('$12.50').first()).toBeVisible();
  await cashier.getByRole('button', { name: /Coffee/ }).click();
  await cashier.getByRole('button', { name: /Add to card/ }).click();
  await expect(cashier.getByText('+$0.63').or(cashier.getByText('+$0.62'))).toBeVisible({ timeout: 90_000 });

  await expect(customer.getByText(/\$0\.6[23]/).first()).toBeVisible({ timeout: 60_000 });

  await customer.getByText('Use balance').click();
  await customer.getByRole('button', { name: 'All' }).click();
  await customer.getByRole('button', { name: /off my bill/ }).click();
  await expect(customer.getByText('Tell the cashier this code')).toBeVisible({ timeout: 90_000 });
  const balanceCode = (await customer.locator('p.text-5xl').last().innerText()).trim();
  expect(balanceCode).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}-\d+$/);

  await cashier.getByRole('button', { name: 'Next customer' }).click();
  await cashier.getByRole('button', { name: 'Balance code' }).click();
  await cashier.getByRole('button', { name: new RegExp(balanceCode) }).click({ timeout: 60_000 });
  await cashier.getByRole('button', { name: /^Confirm/ }).click();
  await expect(cashier.getByText(/off$/)).toBeVisible({ timeout: 60_000 });

  await cashier.getByRole('button', { name: 'Next customer' }).click();
  await cashier.getByRole('button', { name: 'Balance code' }).click();
  await cashier.getByLabel('Balance code').fill(balanceCode);
  await cashier.getByRole('button', { name: /^Confirm/ }).click();
  await expect(cashier.getByText('This code was already used.')).toBeVisible();
});

test('the counter explains how to continue when the camera cannot be used', async ({ browser }) => {
  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByRole('button', { name: 'Scan with camera' }).click();
  await expect(cashier.getByText(/Type the card code instead/)).toBeVisible();
});
