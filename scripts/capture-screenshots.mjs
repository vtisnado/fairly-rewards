import { chromium, devices } from '/workspace/app/node_modules/@playwright/test/index.mjs';

const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const slug = process.env.PUBLIC_DEMO_PROGRAM_SLUG ?? 'cafe-esquina';
const out = '/workspace/docs/screenshots';

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const tablet = await browser.newContext({ viewport: { width: 1180, height: 820 } });
const phone = await browser.newContext({ ...devices['Pixel 7'] });

async function shoot(page, name, fullPage = false) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
}

const landing = await desktop.newPage();
await landing.goto(base);
await landing.getByRole('heading').first().waitFor();
await shoot(landing, 'landing');

const customer = await phone.newPage();
await customer.goto(`${base}/join/${slug}`);
await customer.getByRole('button', { name: /Get my card/ }).click();
const skip = customer.getByRole('button', { name: 'Skip' });
await skip.or(customer.getByRole('button', { name: 'Later' })).waitFor({ timeout: 90_000 });
if (await skip.isVisible()) await skip.click();
await customer.waitForURL(/\/wallet/, { timeout: 90_000 });
await customer.getByRole('button', { name: 'Later' }).click();
await customer.getByRole('button', { name: /^Open .* card$/ }).first().waitFor({ timeout: 90_000 });

await customer.getByRole('button', { name: /^Open .* card$/ }).first().click();
const simulate = customer.getByRole('button', { name: /Simulate a purchase/ });
const levelUp = customer.getByRole('dialog', { name: 'Level up' });
let levelUpShot = false;
async function dismissLevelUp() {
  if (!(await levelUp.isVisible())) return;
  if (!levelUpShot) {
    await shoot(customer, 'level-up');
    levelUpShot = true;
  }
  await levelUp.getByRole('button').first().click();
  await levelUp.waitFor({ state: 'hidden' });
  await customer.waitForTimeout(800);
  const sheet = customer.locator('div.fixed.inset-0.z-40');
  if (await sheet.isVisible()) await customer.mouse.click(200, 30);
}
for (let purchase = 0; purchase < 3; purchase++) {
  await dismissLevelUp();
  await simulate.click();
  await customer.getByRole('button', { name: /Recording purchase/ }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  await simulate.waitFor({ state: 'visible', timeout: 90_000 });
  await customer.getByRole('button', { name: /Recording purchase/ }).waitFor({ state: 'hidden', timeout: 90_000 });
  await customer.waitForTimeout(3500);
}
await dismissLevelUp();
await customer.getByRole('button', { name: 'Back to wallet' }).click();
await customer.getByRole('button', { name: /^Open .* card$/ }).first().waitFor();
await shoot(customer, 'wallet');

await customer.goto(`${base}/wallet`);
await customer.getByRole('button', { name: /^Open .* card$/ }).first().waitFor({ timeout: 90_000 });
await customer.getByRole('button', { name: 'Show my code' }).click();
await customer.getByLabel('Typed code').waitFor({ timeout: 60_000 });
await shoot(customer, 'code');

const counter = await tablet.newPage();
await counter.goto(`${base}/cashier/${slug}`);
const guideSkip = counter.getByRole('button', { name: 'Skip' });
await counter.getByText("Scan the customer's code").or(guideSkip).first().waitFor({ timeout: 60_000 });
if (await guideSkip.isVisible()) await guideSkip.click();
await shoot(counter, 'counter');

const dashboard = await desktop.newPage();
await dashboard.goto(`${base}/business/${slug}`);
await dashboard.waitForLoadState('networkidle');
await shoot(dashboard, 'dashboard');

const market = await desktop.newPage();
await market.goto(`${base}/market`);
await market.waitForLoadState('networkidle');
await shoot(market, 'market');

await browser.close();
