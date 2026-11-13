import { KeyPair, base64Encode, keyToImplicitAddress } from 'near-api-js';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { DEMO_SLUG, joinAsCustomer, phone, showWalletCode } from './helpers';

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()));
});

const TYPED_CODE = /^[2-9A-HJKMNP-TV-Z]{6}$/;

interface Issued {
  token: string;
  code: string;
  accountId: string;
  expiresInSeconds: number;
}

function sign(keyPair: KeyPair, message: string) {
  return {
    accountId: keyToImplicitAddress(keyPair.getPublicKey()),
    publicKey: keyPair.getPublicKey().toString(),
    signature: base64Encode(keyPair.sign(new TextEncoder().encode(message)).signature),
  };
}

async function issueFor(request: APIRequestContext, keyPair: KeyPair): Promise<Issued> {
  const signedAt = Date.now();
  const proof = sign(keyPair, `fairly-code:${keyToImplicitAddress(keyPair.getPublicKey())}:${signedAt}`);
  const response = await request.post('/api/customer-code', { data: { ...proof, signedAt } });
  expect(response.status()).toBe(200);
  return { ...(await response.json()), accountId: proof.accountId };
}

const resolve = (request: APIRequestContext, value: { token: string } | { code: string }) =>
  request.post('/api/cashier/customer-code', { data: { slug: DEMO_SLUG, ...value } });

async function expire(request: APIRequestContext, code: string) {
  const response = await request.patch(`${process.env.PUBLIC_SUPABASE_URL}/rest/v1/customer_codes?code=eq.${code}`, {
    headers: { apikey: process.env.SUPABASE_SECRET_KEY!, 'content-type': 'application/json', prefer: 'return=minimal' },
    data: { expires_at: new Date(Date.now() - 1000).toISOString() },
  });
  expect(response.ok()).toBe(true);
}

test('wal_007_wal_016_wal_017_issuing_needs_a_valid_signature_and_returns_random_unique_codes', async ({ request }) => {
  const key = KeyPair.fromRandom('ed25519');
  const accountId = keyToImplicitAddress(key.getPublicKey());
  const signedAt = Date.now();
  const good = sign(key, `fairly-code:${accountId}:${signedAt}`);

  const wrongMessage = sign(key, `fairly-code:${accountId}:${signedAt + 1}`);
  expect((await request.post('/api/customer-code', { data: { ...wrongMessage, signedAt } })).status()).toBe(403);
  const otherAccount = sign(KeyPair.fromRandom('ed25519'), `fairly-code:${accountId}:${signedAt}`);
  expect((await request.post('/api/customer-code', { data: { ...good, signature: otherAccount.signature, signedAt } })).status()).toBe(403);
  const stale = signedAt - 10 * 60 * 1000;
  expect((await request.post('/api/customer-code', { data: { ...sign(key, `fairly-code:${accountId}:${stale}`), signedAt: stale } })).status()).toBe(403);
  expect((await request.post('/api/customer-code', { data: {} })).status()).toBe(403);

  const issued = await issueFor(request, key);
  expect(issued.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  expect(issued.token).not.toContain(accountId);
  expect(issued.code).toMatch(TYPED_CODE);
  expect(issued.expiresInSeconds).toBe(180);

  const batch = await Promise.all(Array.from({ length: 6 }, () => issueFor(request, KeyPair.fromRandom('ed25519'))));
  expect(new Set(batch.map((entry) => entry.code)).size).toBe(batch.length);
  expect(new Set(batch.map((entry) => entry.token)).size).toBe(batch.length);
});

test('wal_006_wal_018_nfr_016_a_new_code_replaces_the_old_one_and_a_code_resolves_once', async ({ request }) => {
  const key = KeyPair.fromRandom('ed25519');
  const first = await issueFor(request, key);
  const second = await issueFor(request, key);
  expect(second.code).not.toBe(first.code);
  expect((await resolve(request, { token: first.token })).status()).toBe(404);
  expect((await resolve(request, { code: first.code })).status()).toBe(404);

  const typed = `${second.code.slice(0, 3)}-${second.code.slice(3)}`.toLowerCase();
  const resolved = await resolve(request, { code: typed });
  expect(resolved.status()).toBe(200);
  expect(await resolved.json()).toMatchObject({ accountId: second.accountId, pass: null });

  const again = await resolve(request, { token: second.token });
  expect(again.status()).toBe(404);
  expect(await again.json()).toEqual({ error: 'CODE_NOT_FOUND' });
  expect((await resolve(request, { code: second.code })).status()).toBe(404);

  const third = await issueFor(request, key);
  const byToken = await resolve(request, { token: third.token });
  expect(byToken.status()).toBe(200);
  expect((await resolve(request, { code: third.code })).status()).toBe(404);
});

test('wal_006_wal_009_an_expired_code_answers_code_not_found', async ({ request }) => {
  const issued = await issueFor(request, KeyPair.fromRandom('ed25519'));
  await expire(request, issued.code);
  expect(await (await resolve(request, { code: issued.code })).json()).toEqual({ error: 'CODE_NOT_FOUND' });
  expect((await resolve(request, { token: issued.token })).status()).toBe(404);

  expect((await resolve(request, { token: 'x'.repeat(30) })).status()).toBe(404);
  expect((await resolve(request, { code: 'not a code' })).status()).toBe(404);
  expect((await resolve(request, { code: 'OOO-111' })).status()).toBe(404);
});

test('wal_009_only_a_cashier_of_the_program_can_resolve_with_a_device_proof', async ({ request }) => {
  const customer = await issueFor(request, KeyPair.fromRandom('ed25519'));
  const stranger = KeyPair.fromRandom('ed25519');
  const signedAt = Date.now();
  const proof = sign(stranger, `fairly-resolve:${DEMO_SLUG}:${customer.token}:${signedAt}`);
  const refused = await request.post('/api/cashier/customer-code', { data: { slug: DEMO_SLUG, token: customer.token, signedAt, ...proof } });
  expect(refused.status()).toBe(403);
  expect(await refused.json()).toEqual({ error: 'NOT_CASHIER' });
  expect((await resolve(request, { token: customer.token })).status()).toBe(200);

  const unknownProgram = await request.post('/api/cashier/customer-code', { data: { slug: 'not-the-demo-program', token: customer.token } });
  expect(unknownProgram.status()).toBe(403);
});

test('wal_005_wal_006_the_code_screen_shows_the_qr_the_typed_code_and_a_countdown_and_rotates_on_each_visit', async ({ browser, request }) => {
  const customer = await phone(browser);
  await joinAsCustomer(customer);
  const first = await showWalletCode(customer);

  const screen = customer.getByRole('region', { name: 'Your code' });
  await expect(screen.getByRole('img', { name: 'QR code for the counter' })).toBeVisible();
  await expect(screen.getByText(/New code in [0-3]:[0-5]\d\./)).toBeVisible();
  await expect(screen.getByText('Screenshots stop working when the timer runs out.')).toBeVisible();
  await expect(screen.getByText(/\$/)).toHaveCount(0);
  await expect(screen.locator('rect.ring')).toHaveCSS('animation-duration', '180s');

  await customer.getByRole('button', { name: 'Back', exact: true }).click();
  const second = await showWalletCode(customer);
  expect(second.code).not.toBe(first.code);
  expect((await resolve(request, { code: first.code })).status()).toBe(404);
  const resolved = await resolve(request, { token: second.token });
  expect(resolved.status()).toBe(200);
  expect((await resolved.json()).pass.program_slug).toBe(DEMO_SLUG);
});
