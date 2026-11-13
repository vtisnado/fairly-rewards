import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { DEMO_SLUG, joinAsCustomer, pairingCodeOn } from './helpers';
import { buildManifest, shortName } from '../src/lib/manifest';
import { detectPlatform, installMode } from '../src/lib/install';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

async function iphone(browser: Browser, standalone = false): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], userAgent: IPHONE_SAFARI });
  if (standalone) {
    await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  }
  return context.newPage();
}

test('ui_060_platform_detection_and_install_mode', () => {
  expect(detectPlatform({ userAgent: IPHONE_SAFARI })).toBe('ios-safari');
  expect(detectPlatform({ userAgent: IPHONE_CHROME })).toBe('ios-other');
  expect(detectPlatform({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios-safari');
  expect(detectPlatform({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('desktop');
  expect(detectPlatform({ userAgent: ANDROID_CHROME })).toBe('android');

  expect(installMode('android', true, false)).toBe('native');
  expect(installMode('android', false, false)).toBe('none');
  expect(installMode('ios-safari', false, false)).toBe('ios-sheet');
  expect(installMode('ios-other', false, false)).toBe('ios-open-safari');
  expect(installMode('desktop', false, false)).toBe('none');
  expect(installMode('ios-safari', false, true)).toBe('none');
  expect(installMode('android', true, true)).toBe('none');
});

test('ui_060_manifest_builder_names_and_start_urls', () => {
  const wallet = buildManifest('wallet');
  expect(wallet).toMatchObject({ name: 'Fairly', short_name: 'Fairly', start_url: '/wallet', display: 'standalone' });
  expect(shortName('The Very Long Bakery Name')).toHaveLength(12);
  expect(buildManifest('counter', 'x-long', 'The Very Long Bakery Name').short_name).toBe(shortName('The Very Long Bakery Name Counter'));
  expect(buildManifest('counter', 'cafe-esquina', 'Cafe Esquina')).toMatchObject({ name: 'Cafe Esquina Counter', start_url: '/cashier/cafe-esquina' });
  expect(buildManifest('dashboard', 'cafe-esquina', 'Cafe Esquina')).toMatchObject({ name: 'Cafe Esquina Dashboard', start_url: '/business/cafe-esquina' });
  expect(buildManifest('market')).toMatchObject({ name: 'Fairly Market', start_url: '/market' });
  expect(wallet.start_url.startsWith(wallet.scope)).toBe(true);
});

test('ui_060_ui_067_manifest_endpoints_serve_each_context', async ({ request }) => {
  const walletResponse = await request.get('/manifest/wallet.webmanifest');
  expect(walletResponse.status()).toBe(200);
  expect(walletResponse.headers()['content-type']).toContain('application/manifest+json');
  expect(await walletResponse.json()).toMatchObject({ name: 'Fairly', short_name: 'Fairly', start_url: '/wallet', display: 'standalone' });
  for (const [kind, suffix, start] of [
    ['counter', ' Counter', `/cashier/${DEMO_SLUG}`],
    ['dashboard', ' Dashboard', `/business/${DEMO_SLUG}`],
  ] as const) {
    const response = await request.get(`/manifest/${kind}/${DEMO_SLUG}.webmanifest`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/manifest+json');
    expect(response.headers()['x-robots-tag']).toContain('noindex');
    const manifest = await response.json();
    expect(manifest.name.endsWith(suffix)).toBe(true);
    expect(manifest.start_url).toBe(start);
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon: { purpose: string; sizes: string }) => `${icon.sizes}:${icon.purpose}`)).toEqual([
      '192x192:any',
      '512x512:any',
      '512x512:maskable',
    ]);
  }
  const market = await (await request.get('/manifest/market.webmanifest')).json();
  expect(market.name).toBe('Fairly Market');
  expect((await request.get(`/manifest/card/${DEMO_SLUG}.webmanifest`)).status()).toBe(404);
  expect((await request.get('/manifest/counter/does-not-exist-zz.webmanifest')).status()).toBe(404);
  expect((await request.get('/manifest/counter/..%2Fetc.webmanifest')).status()).toBe(404);
  expect((await request.get(`/manifest/other/${DEMO_SLUG}.webmanifest`)).status()).toBe(404);
});

test('ui_061_pages_link_their_own_manifest', async ({ page }) => {
  await page.goto('/wallet');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest/wallet.webmanifest');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', /.+/);
  await page.goto(`/cashier/${DEMO_SLUG}`);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', `/manifest/counter/${DEMO_SLUG}.webmanifest`);
  await page.goto(`/business/${DEMO_SLUG}`);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', `/manifest/dashboard/${DEMO_SLUG}.webmanifest`);
  await page.goto('/market');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest/market.webmanifest');
});

test('ui_062_ui_063_iphone_safari_sees_the_steps_once_and_later_is_remembered', async ({ browser }) => {
  const customer = await iphone(browser);
  await joinAsCustomer(customer);
  const banner = customer.getByRole('region', { name: 'Add to home screen' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(customer.getByText('1. Tap Share')).toBeVisible();
  await expect(customer.getByText('3. Tap Add')).toBeVisible();
  await expect(customer.getByText(/connect it once with a code/)).toBeVisible();
  await customer.getByRole('button', { name: 'Later' }).click();
  await expect(banner).toBeHidden();
  await customer.reload();
  await expect(customer.getByRole('button', { name: /^Open .* card$/ })).toBeVisible({ timeout: 90_000 });
  await expect(customer.getByRole('region', { name: 'Add to home screen' })).toBeHidden();
  await customer.getByRole('button', { name: 'How it works' }).click();
  await expect(customer.getByRole('button', { name: 'Add Fairly to home screen' })).toBeVisible();
  await expect(customer.getByRole('button', { name: 'Connect home screen app' })).toBeVisible();
});

test('ui_062_android_without_the_install_event_shows_no_offer', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const customer = await context.newPage();
  await joinAsCustomer(customer);
  await expect(customer.getByRole('region', { name: 'Add to home screen' })).toBeHidden();
  await customer.getByRole('button', { name: 'How it works' }).click();
  await expect(customer.getByRole('button', { name: 'Add Fairly to home screen' })).toBeHidden();
  await expect(customer.getByRole('button', { name: 'Connect home screen app' })).toBeVisible();
});

test('ui_062_standalone_apps_never_offer_the_install', async ({ browser }) => {
  const standalone = await iphone(browser, true);
  await standalone.goto(`/cashier/${DEMO_SLUG}`);
  await expect(standalone.getByText('Scan the customer')).toBeVisible({ timeout: 60_000 });
  await expect(standalone.getByRole('region', { name: 'Add to home screen' })).toBeHidden();
  await expect(standalone.getByRole('button', { name: 'Add to home screen' })).toBeHidden();
});

test('ui_064_ui_065_onb_017_a_home_screen_app_connects_to_the_wallet_once_with_a_code', async ({ browser }) => {
  const safari = await iphone(browser);
  await joinAsCustomer(safari);

  const shortcut = await iphone(browser, true);
  await shortcut.goto('/wallet');
  await expect(shortcut.getByRole('heading', { name: 'Connect this shortcut' })).toBeVisible({ timeout: 60_000 });
  await expect(shortcut.getByText('Restore from a backup file')).toBeVisible();
  const code = (await pairingCodeOn(shortcut)).replace('-', '');

  await safari.getByRole('button', { name: 'How it works' }).click();
  await safari.getByRole('button', { name: 'Connect home screen app' }).click();
  await safari.getByLabel('Code shown on the home screen app').fill(code);
  await safari.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(safari.getByText('Home screen app connected')).toBeVisible({ timeout: 90_000 });

  await expect(shortcut.getByRole('button', { name: /^Open .* card$/ })).toBeVisible({ timeout: 90_000 });
  await expect(shortcut.getByRole('heading', { name: 'Connect this shortcut' })).toBeHidden();
});
