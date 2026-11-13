import { loadOrCreateWallet, type BrowserWallet } from './browser-wallet';

export type PairingKind = 'device' | 'manager' | 'shortcut';

export const pairingStorageKey = (kind: PairingKind, slug: string) => `fairly.${kind}.${slug}`;

export const localKey = (kind: PairingKind, slug: string): Promise<BrowserWallet> => loadOrCreateWallet(pairingStorageKey(kind, slug));

export async function requestPairing(slug: string, kind: PairingKind, accountId: string): Promise<string> {
  const response = await fetch('/api/pairing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, kind, accountId }),
  });
  const body = (await response.json()) as { code?: string; error?: string };
  if (!response.ok || !body.code) throw new Error(body.error ?? 'PAIRING_FAILED');
  return body.code;
}

export interface PairingLookup {
  accountId: string;
  kind: PairingKind;
  connectedAccountId: string | null;
}

export async function lookupPairing(slug: string, code: string, watch = false): Promise<PairingLookup> {
  const query = new URLSearchParams({ slug, code, ...(watch ? { watch: '1' } : {}) });
  const response = await fetch(`/api/pairing?${query}`);
  const body = (await response.json()) as { accountId?: string; kind?: PairingKind; connectedAccountId?: string | null; error?: string };
  if (!response.ok || !body.accountId || !body.kind) throw new Error(body.error ?? 'PAIRING_NOT_FOUND');
  return { accountId: body.accountId, kind: body.kind, connectedAccountId: body.connectedAccountId ?? null };
}

export async function markPairingConnected(slug: string, code: string, accountId: string): Promise<void> {
  const response = await fetch('/api/pairing', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, code, accountId }),
  });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'PAIRING_FAILED');
}

export const formatPairingCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
