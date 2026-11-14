import type { APIRoute } from 'astro';
import { provider } from '../../lib/near';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { failure, json } from '../../lib/server/responses';
import { selectRows, upsertRows } from '../../lib/server/supabase';

const KINDS = new Set(['customer', 'merchant']);
const PUBLIC_KEY = /^ed25519:[1-9A-HJ-NP-Za-km-z]{32,44}$/;

async function hasFullAccessKey(accountId: string, publicKey: string): Promise<boolean> {
  try {
    const key = await provider.viewAccessKey({ accountId, publicKey });
    return key.permission === 'FullAccess';
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'recovery-link'), 20, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const { accountId, publicKey, kind } = (await request.json().catch(() => ({}))) as { accountId?: string; publicKey?: string; kind?: string };
  if (!accountId || !publicKey || !PUBLIC_KEY.test(publicKey) || !kind || !KINDS.has(kind)) return failure('INVALID_REQUEST');
  if (!(await hasFullAccessKey(accountId, publicKey))) return failure('KEY_NOT_ON_ACCOUNT', 409);
  await upsertRows('recovery_links', [{ public_key: publicKey, kind, account_id: accountId }], 'public_key,kind');
  return json({ ok: true });
};

export const GET: APIRoute = async ({ request, url }) => {
  if (isRateLimited(clientKey(request, 'recovery-lookup'), 30, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const publicKey = url.searchParams.get('publicKey') ?? '';
  const kind = url.searchParams.get('kind') ?? '';
  if (!PUBLIC_KEY.test(publicKey) || !KINDS.has(kind)) return failure('INVALID_REQUEST');
  const [row] = await selectRows<{ account_id: string }>(
    'recovery_links',
    `select=account_id&public_key=eq.${encodeURIComponent(publicKey)}&kind=eq.${kind}&limit=1`,
  );
  if (!row || !(await hasFullAccessKey(row.account_id, publicKey))) return failure('RECOVERY_NOT_FOUND', 404);
  return json({ accountId: row.account_id });
};
