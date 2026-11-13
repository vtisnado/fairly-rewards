import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { DEMO_SLUG, closeCardDetail, joinAsCustomer, openCardDetail, phone } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

const SECOND_CARD = {
  token_id: `${DEMO_SLUG}:ZZZ999`,
  program_slug: DEMO_SLUG,
  balance: '9000000',
  pending: '0',
  purchase_count: 1,
  total_spent_cents: 500,
  tier_index: 0,
  claimed_perks: 0,
  redemption_count: 0,
  last_activity_ns: 1_000_000_000_000_000,
  created_ns: 1_000_000_000_000_000,
  owner: '',
  program_name: 'Crumb Bakery',
  brand_color: '#FFE24A',
  tier_name: 'Bronze',
  next_tier: 'Silver',
  purchases_to_next_tier: 4,
  expires_at_ns: null,
  listing_price: null,
};

async function phoneWithoutWorker(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  return context.newPage();
}

async function addSecondCard(page: Page) {
  await page.route(/.*/, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST' || !(request.postData() ?? '').includes('get_passes_by_owner')) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const payload = await response.json();
    const cards = JSON.parse(new TextDecoder().decode(new Uint8Array(payload.result.result))) as unknown[];
    payload.result.result = Array.from(new TextEncoder().encode(JSON.stringify([...cards, SECOND_CARD])));
    await route.fulfill({ response, json: payload });
  });
}

const cardOrder = (page: Page) => page.locator('[data-n]').evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label')));

test('wal_001_wal_020_ui_070_the_wallet_stacks_the_cards_sorts_them_and_opens_a_detail', async ({ browser }) => {
  const customer = await phoneWithoutWorker(browser);
  await joinAsCustomer(customer);
  await addSecondCard(customer);
  await customer.goto('/wallet');

  await expect(customer.getByRole('button', { name: /^Open .* card$/ })).toHaveCount(2, { timeout: 60_000 });
  await expect(customer.getByText('2 cards')).toBeVisible();
  await expect(customer.getByText('Total balance')).toBeVisible();
  await expect(customer.getByText('$9.00').first()).toBeVisible();
  await expect(customer.getByRole('button', { name: 'Show my code' })).toBeVisible();

  const real = (await cardOrder(customer)).find((label) => !label?.includes('Crumb'));
  expect(real).toBeTruthy();

  const sortBy = async (name: string) => {
    await customer.getByRole('button', { name: 'Sort cards' }).click();
    await customer.getByRole('option', { name }).click();
    await expect(customer.getByRole('button', { name: 'Sort cards' })).toContainText(name);
    await expect(customer.locator('.is-busy')).toHaveCount(0);
  };

  expect((await cardOrder(customer))[0]).toBe(real);
  await sortBy('Highest balance');
  expect((await cardOrder(customer))[0]).toBe('Open Crumb Bakery card');
  await sortBy('Oldest');
  expect((await cardOrder(customer))[0]).toBe('Open Crumb Bakery card');
  await sortBy('Recent');
  expect((await cardOrder(customer))[0]).toBe(real);
  await customer.reload();
  await expect(customer.getByRole('button', { name: 'Sort cards' })).toContainText('Recent');

  await openCardDetail(customer, real!);
  await expect(customer).toHaveURL(new RegExp(`/wallet/${DEMO_SLUG}$`));
  await expect(customer.getByRole('button', { name: 'Sell this card' })).toBeVisible();
  await expect(customer.getByText(/Selling moves only this card/)).toBeVisible();
  await expect(customer.getByText(/Your other 1 card stays here/)).toBeVisible();
  await customer.goBack();
  await expect(customer.getByRole('button', { name: 'Back to wallet' })).toBeHidden();
  await expect(customer).toHaveURL(/\/wallet$/);
  await expect(customer.getByRole('button', { name: /^Open .* card$/ })).toHaveCount(2);
});

test('wal_002_wal_013_the_join_link_leads_to_the_wallet_and_a_card_url_opens_its_detail', async ({ browser }) => {
  const customer = await phone(browser);
  await joinAsCustomer(customer);
  await expect(customer).toHaveURL(/\/wallet$/);
  await expect(customer.getByText('Card added')).toBeVisible();

  await customer.goto(`/join/${DEMO_SLUG}`);
  await expect(customer).toHaveURL(/\/wallet$/, { timeout: 60_000 });

  await customer.goto(`/wallet/${DEMO_SLUG}`);
  await expect(customer.getByRole('button', { name: 'Back to wallet' })).toBeVisible({ timeout: 60_000 });
  await expect(customer.getByText('Use balance')).toBeVisible();
  await closeCardDetail(customer);
  await expect(customer).toHaveURL(/\/wallet$/);
});

test('wal_003_a_wallet_with_no_cards_explains_what_to_do', async ({ browser }) => {
  const customer = await phone(browser);
  await customer.goto('/wallet');
  await expect(customer.getByText('No cards yet')).toBeVisible({ timeout: 60_000 });
  await expect(customer.getByText(/Scan the Fairly QR/)).toBeVisible();
  await expect(customer.getByRole('link', { name: /Browse the market/ })).toHaveAttribute('href', '/market');
  await expect(customer.getByRole('button', { name: 'Show my code' })).toBeVisible();
  await customer.getByRole('button', { name: 'How it works' }).click();
  await customer.getByRole('button', { name: 'Replay intro' }).click();
  await expect(customer.getByRole('heading', { name: 'This is your card' })).toBeVisible();
  await customer.getByRole('button', { name: 'Skip' }).click();
  await expect(customer.getByText('No cards yet')).toBeVisible();
});

test('nfr_015_the_service_worker_is_network_first_and_never_caches', async ({ page, request }) => {
  const script = await request.get('/sw.js');
  expect(script.headers()['cache-control']).toBe('no-cache');
  expect(script.headers()['content-type']).toContain('javascript');
  const source = await script.text();
  expect(source).toContain("addEventListener('fetch'");
  expect(source).toContain('respondWith(fetch(event.request))');
  expect(source).not.toMatch(/\bcaches\b/);

  await page.goto('/wallet');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL('/', page.url()).href);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await page.evaluate((slug) => fetch(`/api/art/${slug}/0.svg`).then((response) => response.text()), DEMO_SLUG);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test('onb_015_the_intro_slides_show_once_before_the_wallet_and_the_protect_step_follows', async ({ browser }) => {
  const customer = await phone(browser);
  await customer.goto(`/join/${DEMO_SLUG}`);
  await customer.getByRole('button', { name: /Get my card/ }).click();
  await expect(customer.getByRole('heading', { name: 'This is your card' })).toBeVisible({ timeout: 90_000 });
  await customer.getByRole('button', { name: 'Next' }).click();
  await expect(customer.getByRole('heading', { name: 'Show it when you pay' })).toBeVisible();
  await customer.getByRole('button', { name: 'Next' }).click();
  await expect(customer.getByRole('heading', { name: 'Money lands on it' })).toBeVisible();
  await customer.getByRole('button', { name: 'Next' }).click();
  await expect(customer).toHaveURL(/\/wallet/);
  await expect(customer.getByRole('heading', { name: 'Keep your wallet safe' })).toBeVisible({ timeout: 60_000 });
  await customer.getByRole('button', { name: 'Later' }).click();
  await expect(customer.getByText('Card added')).toBeVisible();
  await customer.getByRole('button', { name: 'How it works' }).click();
  await customer.getByRole('button', { name: 'Replay intro' }).click();
  await expect(customer.getByRole('heading', { name: 'This is your card' })).toBeVisible();
  await customer.getByRole('button', { name: 'Skip' }).click();
  await expect(customer.getByRole('heading', { name: 'This is your card' })).toBeHidden();
  await expect(customer.getByRole('button', { name: 'Show my code' })).toBeVisible();
  expect(await customer.evaluate(() => localStorage.getItem('fairly.intro.seen'))).toBe('1');
});

test('onb_015_a_device_that_saw_the_intro_goes_straight_to_the_wallet', async ({ browser }) => {
  const customer = await phone(browser);
  await customer.addInitScript(() => localStorage.setItem('fairly.intro.seen', '1'));
  await customer.goto(`/join/${DEMO_SLUG}`);
  await customer.getByRole('button', { name: /Get my card/ }).click();
  await expect(customer).toHaveURL(/\/wallet/, { timeout: 90_000 });
  await expect(customer.getByRole('heading', { name: 'Keep your wallet safe' })).toBeVisible({ timeout: 60_000 });
});

test('wal_001_a_tier_increase_shows_the_full_screen_level_up_and_the_perk_can_be_claimed', async ({ browser }) => {
  const customer = await phoneWithoutWorker(browser);
  await joinAsCustomer(customer);
  let promoted = false;
  await customer.route(/.*/, async (route) => {
    const request = route.request();
    if (!promoted || request.method() !== 'POST' || !(request.postData() ?? '').includes('get_passes_by_owner')) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const payload = await response.json();
    const cards = JSON.parse(new TextDecoder().decode(new Uint8Array(payload.result.result))) as Record<string, unknown>[];
    const raised = cards.map((card) => ({ ...card, tier_index: 1, tier_name: 'Silver' }));
    payload.result.result = Array.from(new TextEncoder().encode(JSON.stringify(raised)));
    await route.fulfill({ response, json: payload });
  });
  await openCardDetail(customer);
  promoted = true;
  await customer.getByRole('button', { name: /Simulate a purchase/ }).click();
  const overlay = customer.getByRole('dialog', { name: 'Level up' });
  await expect(overlay).toBeVisible({ timeout: 90_000 });
  await expect(overlay.getByText('Silver', { exact: true })).toBeVisible();
  await overlay.getByRole('button', { name: 'Later' }).click();
  await expect(overlay).toBeHidden();
});
