import { devices, expect, type Browser, type Page } from '@playwright/test';

export const DEMO_SLUG = process.env.PUBLIC_DEMO_PROGRAM_SLUG ?? 'cafe-esquina';

export async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  return context.newPage();
}

export async function tablet(browser: Browser, permissions: string[] = []): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, permissions });
  return context.newPage();
}

export async function desktop(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return context.newPage();
}

export async function joinAsCustomer(page: Page, slug = DEMO_SLUG): Promise<string> {
  await page.goto(`/join/${slug}`);
  await page.getByRole('button', { name: /Get my card/ }).click();
  const skip = page.getByRole('button', { name: 'Skip' });
  await expect(skip.or(page.getByRole('button', { name: 'Later' }))).toBeVisible({ timeout: 90_000 });
  if (await skip.isVisible()) await skip.click();
  await expect(page).toHaveURL(/\/wallet/, { timeout: 90_000 });
  await page.getByRole('button', { name: 'Later' }).click();
  await expect(page.getByRole('button', { name: /^Open .* card$/ }).first()).toBeVisible({ timeout: 90_000 });
  return `${slug}:${(await cardNumberOn(page)).replace('-', '')}`;
}

export async function openCardDetail(page: Page, name: string | RegExp = /^Open .* card$/) {
  await page.getByRole('button', { name }).first().click();
  await expect(page.getByText(/· No\. [0-9A-Z]{3}-[0-9A-Z]{3}$/)).toBeVisible();
}

export async function closeCardDetail(page: Page) {
  await page.getByRole('button', { name: 'Back to wallet' }).click();
  await expect(page.getByRole('button', { name: 'Back to wallet' })).toBeHidden();
}

export async function cardNumberOn(page: Page, name: string | RegExp = /^Open .* card$/): Promise<string> {
  await openCardDetail(page, name);
  const label = await page.getByText(/· No\. [0-9A-Z]{3}-[0-9A-Z]{3}$/).innerText();
  await closeCardDetail(page);
  return label.split('No. ')[1]!.trim();
}

export interface ShownCode {
  token: string;
  code: string;
}

export async function showWalletCode(page: Page): Promise<ShownCode> {
  const issued = page.waitForResponse((response) => response.url().endsWith('/api/customer-code') && response.ok());
  await page.getByRole('button', { name: 'Show my code' }).click();
  const body = (await (await issued).json()) as { token: string; code: string };
  const typed = page.getByLabel('Typed code');
  await expect(typed).toHaveText(`${body.code.slice(0, 3)}-${body.code.slice(3)}`);
  return { token: body.token, code: body.code };
}

export const cardCode = (tokenId: string) => tokenId.split(':')[1]!;

export async function closeCashierGuide(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

export async function typeOnKeypad(page: Page, digits: string) {
  for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click();
}

export const pairingCodeOn = async (page: Page) =>
  (await page.locator('p.font-mono', { hasText: /^[0-9A-Z]{3}-[0-9A-Z]{3}$/ }).first().innerText()).trim();
