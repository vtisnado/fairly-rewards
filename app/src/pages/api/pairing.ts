import type { APIRoute } from 'astro';
import { IMPLICIT_ACCOUNT } from '../../lib/server/accounts';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { failure, json } from '../../lib/server/responses';
import { insertRows, selectRows, updateRows } from '../../lib/server/supabase';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const TTL_MS = 15 * 60 * 1000;
const KINDS = new Set(['device', 'manager', 'shortcut']);
const ACCOUNT_ID = /^[a-z0-9._-]{2,64}$/;

interface PairingRow {
  code: string;
  program_slug: string;
  account_id: string;
  kind: 'device' | 'manager' | 'shortcut';
  connected_account_id: string | null;
  created_at: string;
}

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'pairing'), 20, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const { slug, accountId, kind } = (await request.json().catch(() => ({}))) as { slug?: string; accountId?: string; kind?: string };
  if (!slug || !accountId || !IMPLICIT_ACCOUNT.test(accountId) || !kind || !KINDS.has(kind)) return failure('INVALID_REQUEST');
  const code = newCode();
  await insertRows('pairing_requests', [{ code, program_slug: slug, account_id: accountId, kind }]);
  return json({ code, expiresInMinutes: TTL_MS / 60_000 });
};

export const GET: APIRoute = async ({ request, url }) => {
  const watching = url.searchParams.get('watch') === '1';
  const limit = watching ? 600 : 60;
  if (isRateLimited(clientKey(request, watching ? 'pairing-watch' : 'pairing-lookup'), limit, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const code = (url.searchParams.get('code') ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const slug = url.searchParams.get('slug') ?? '';
  if (code.length !== CODE_LENGTH || !slug) return failure('INVALID_REQUEST');
  const since = new Date(Date.now() - TTL_MS).toISOString();
  const [row] = await selectRows<PairingRow>(
    'pairing_requests',
    `select=*&code=eq.${code}&program_slug=eq.${encodeURIComponent(slug)}&created_at=gte.${since}&limit=1`,
  );
  if (!row) return failure('PAIRING_NOT_FOUND', 404);
  return json({ accountId: row.account_id, kind: row.kind, connectedAccountId: row.connected_account_id });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'pairing-connect'), 30, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const { slug, code, accountId } = (await request.json().catch(() => ({}))) as { slug?: string; code?: string; accountId?: string };
  const normalized = (code ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!slug || normalized.length !== CODE_LENGTH || !accountId || !ACCOUNT_ID.test(accountId)) return failure('INVALID_REQUEST');
  const since = new Date(Date.now() - TTL_MS).toISOString();
  await updateRows(
    'pairing_requests',
    `code=eq.${normalized}&program_slug=eq.${encodeURIComponent(slug)}&kind=eq.shortcut&connected_account_id=is.null&created_at=gte.${since}`,
    { connected_account_id: accountId },
  );
  return json({ ok: true });
};
