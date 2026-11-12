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
  await page.getByRole('button', { name: 'Skip' }).click({ timeout: 90_000 });
  await expect(page.getByText('Use balance')).toBeVisible({ timeout: 90_000 });
  return page.evaluate(async (programSlug) => {
    const wallet = await import('/src/lib/customer-wallet.ts');
    const near = await import('/src/lib/near.ts');
    const account = wallet.loadWallet();
    const passes = await near.getPassesByOwner(account!.accountId);
    return passes.find((pass: { program_slug: string }) => pass.program_slug === programSlug)!.token_id as string;
  }, slug);
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
