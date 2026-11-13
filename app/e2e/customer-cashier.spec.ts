import { expect, test } from '@playwright/test';
import { DEMO_SLUG, cardCode, closeCashierGuide, joinAsCustomer, openCardDetail, phone, showWalletCode, tablet, typeOnKeypad } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

test('wal_010_wal_011_customer joins, earns cashback with the wallet code and spends it with a balance code', async ({ browser }) => {
  const customer = await phone(browser);
  const tokenId = await joinAsCustomer(customer);
  const shown = await showWalletCode(customer);
  const typed = `${shown.code.slice(0, 3)}-${shown.code.slice(3)}`;

  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByLabel('Customer code').fill(shown.code.toLowerCase());
  await cashier.getByLabel('Customer code').press('Enter');
  await expect(cashier.getByText(`Code ${typed} found`)).toBeVisible({ timeout: 60_000 });
  await expect(cashier.getByText(`Card ${cardCode(tokenId).slice(0, 3)}-${cardCode(tokenId).slice(3)}`)).toBeVisible();
  await typeOnKeypad(cashier, '1250');
  await expect(cashier.getByText('$12.50').first()).toBeVisible();
  await cashier.getByRole('button', { name: /Coffee/ }).click();
  await cashier.getByRole('button', { name: /Add to card/ }).click();
  await expect(cashier.getByText('+$0.63').or(cashier.getByText('+$0.62'))).toBeVisible({ timeout: 90_000 });

  await customer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(customer.getByText(/\$0\.6[23]/).first()).toBeVisible({ timeout: 60_000 });

  await openCardDetail(customer);
  await customer.getByText('Use balance').click();
  await customer.getByRole('button', { name: 'All', exact: true }).click();
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

test('wal_011_the_card_code_still_identifies_a_card_at_the_counter', async ({ browser }) => {
  const customer = await phone(browser);
  const tokenId = await joinAsCustomer(customer);

  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByLabel('Card code').fill(cardCode(tokenId).toLowerCase());
  await cashier.getByLabel('Card code').press('Enter');
  await expect(cashier.getByText(`Card ${cardCode(tokenId).slice(0, 3)}-${cardCode(tokenId).slice(3)}`)).toBeVisible();
});

test('wal_009_the_counter_refuses_an_unknown_customer_code', async ({ browser }) => {
  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByLabel('Customer code').fill('ZZZ999');
  await cashier.getByLabel('Customer code').press('Enter');
  await expect(cashier.getByRole('alert')).toHaveText(/Code not found or expired/);
});

test('wal_010_the_cashier_issues_a_card_on_the_spot_when_the_customer_has_none', async ({ browser }) => {
  const customer = await phone(browser);
  await customer.goto('/wallet');
  await expect(customer.getByText('No cards yet')).toBeVisible({ timeout: 60_000 });
  const shown = await showWalletCode(customer);
  const typed = `${shown.code.slice(0, 3)}-${shown.code.slice(3)}`;

  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByLabel('Customer code').fill(typed);
  await cashier.getByLabel('Customer code').press('Enter');
  await expect(cashier.getByText('No card yet')).toBeVisible({ timeout: 60_000 });
  await cashier.getByRole('button', { name: 'Issue card' }).click();
  await expect(cashier.getByText(/^Card [0-9A-Z]{3}-[0-9A-Z]{3}$/)).toBeVisible({ timeout: 120_000 });
  await typeOnKeypad(cashier, '800');
  await cashier.getByRole('button', { name: /Add to card/ }).click();
  await expect(cashier.getByText(/^\+\$0\.\d\d$/)).toBeVisible({ timeout: 90_000 });

  await customer.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(customer.getByRole('button', { name: /^Open .* card$/ })).toBeVisible({ timeout: 90_000 });
});

test('the counter explains how to continue when the camera cannot be used', async ({ browser }) => {
  const cashier = await tablet(browser);
  await cashier.goto(`/cashier/${DEMO_SLUG}`);
  await closeCashierGuide(cashier);
  await cashier.getByRole('button', { name: 'Scan with camera' }).click();
  await expect(cashier.getByText(/Type the customer code instead/)).toBeVisible();
});
