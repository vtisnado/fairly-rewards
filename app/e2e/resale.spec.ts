import { expect, test } from '@playwright/test';
import { DEMO_SLUG, cardCode, cardNumberOn, desktop, joinAsCustomer, phone } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

const formatted = (tokenId: string) => `${cardCode(tokenId).slice(0, 3)}-${cardCode(tokenId).slice(3)}`;

test('a customer sells a card on the market, the buyer gets the balance and the shop earns its royalty', async ({ browser }) => {
  const seller = await phone(browser);
  const tokenId = await joinAsCustomer(seller);
  await seller.getByRole('button', { name: 'Show code' }).click();
  await seller.getByRole('button', { name: /Simulate a purchase/ }).click();
  await expect(seller.getByRole('button', { name: /Use balance/ })).toBeEnabled({ timeout: 90_000 });

  await seller.getByText('Sell card', { exact: true }).click();
  await expect(seller.getByText('Sell your card')).toBeVisible();
  const royaltyLine = seller.getByText(/Corner Café gets/).locator('..');
  const royalty = (await royaltyLine.locator('b').innerText()).trim();
  await seller.getByRole('button', { name: 'List for sale' }).click();
  await expect(seller.getByRole('heading', { name: /^Listed for/ })).toBeVisible({ timeout: 90_000 });

  const buyer = await phone(browser);
  await buyer.goto('/market');
  const offer = buyer.getByRole('button', { name: `Buy Corner Café card ${formatted(tokenId)}` });
  await expect(offer).toBeVisible({ timeout: 60_000 });
  await offer.click();
  await expect(buyer.getByText(`(5%)`)).toBeVisible();
  await buyer.getByRole('button', { name: /^Buy for/ }).click();
  await expect(buyer.getByText('It is yours')).toBeVisible({ timeout: 180_000 });
  await buyer.getByRole('link', { name: 'Open my card' }).click();
  await expect(buyer.getByText('Use balance')).toBeVisible({ timeout: 90_000 });
  expect(await cardNumberOn(buyer)).toBe(formatted(tokenId));

  await expect(seller.getByText('Your card was sold')).toBeVisible({ timeout: 60_000 });

  const owner = await desktop(browser);
  await owner.goto(`/business/${DEMO_SLUG}`);
  await expect(owner.getByText(`Royalty +${royalty}`).first()).toBeVisible({ timeout: 60_000 });
});
