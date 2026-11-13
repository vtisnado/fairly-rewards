import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { DEMO_SLUG, cardNumberOn, joinAsCustomer, phone } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

test('pages send a content security policy', async ({ request }) => {
  const response = await request.get(`/join/${DEMO_SLUG}`);
  const policy = response.headers()['content-security-policy'] ?? '';
  test.skip(!policy && (process.env.E2E_BASE_URL ?? '').includes(':3000'), 'Astro applies the policy only to production builds');
  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
  expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
});

test('onb_016_the_wallet_key_cannot_be_read_by_scripts, and a backup file restores the wallet in a new browser', async ({ browser }) => {
  const customer = await phone(browser);
  const tokenId = await joinAsCustomer(customer);

  const stored = await customer.evaluate(
    () =>
      new Promise<{ extractable: boolean | null; inLocalStorage: boolean }>((resolve, reject) => {
        const open = indexedDB.open('fairly-keys');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const read = open.result.transaction('keys').objectStore('keys').get('fairly.customer.key');
          read.onsuccess = () =>
            resolve({
              extractable: (read.result?.privateKey as CryptoKey | undefined)?.extractable ?? null,
              inLocalStorage: localStorage.getItem('fairly.customer.key') !== null,
            });
        };
      }),
  );
  expect(stored).toEqual({ extractable: false, inLocalStorage: false });

  await customer.getByRole('button', { name: 'How it works' }).click();
  const download = customer.waitForEvent('download', { timeout: 90_000 });
  await customer.getByRole('button', { name: /Back up my wallet/ }).click();
  const file = await (await download).path();
  const backup = await readFile(file, 'utf8');
  expect(backup).toMatch(/Account: [0-9a-f]{64}/);
  expect(backup).toMatch(/Key: ed25519:/);

  const newPhone = await phone(browser);
  await newPhone.goto(`/join/${DEMO_SLUG}`);
  await newPhone.locator('input[type=file]').setInputFiles({ name: 'backup.txt', mimeType: 'text/plain', buffer: Buffer.from(backup) });
  await expect(newPhone.getByRole('button', { name: /^Open .* card$/ })).toBeVisible({ timeout: 60_000 });
  expect(await cardNumberOn(newPhone)).toBe(`${tokenId.split(':')[1]!.slice(0, 3)}-${tokenId.split(':')[1]!.slice(3)}`);
});
