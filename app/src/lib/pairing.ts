import { loadWallet, newWallet, saveWallet, type BrowserWallet } from './browser-wallet';

export type PairingKind = 'device' | 'manager';

export const pairingStorageKey = (kind: PairingKind, slug: string) => `fairly.${kind}.${slug}`;

export const localKey = (kind: PairingKind, slug: string): BrowserWallet =>
  loadWallet(pairingStorageKey(kind, slug)) ?? saveWallet(pairingStorageKey(kind, slug), newWallet());

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

export async function lookupPairing(slug: string, code: string): Promise<{ accountId: string; kind: PairingKind }> {
  const response = await fetch(`/api/pairing?${new URLSearchParams({ slug, code })}`);
  const body = (await response.json()) as { accountId?: string; kind?: PairingKind; error?: string };
  if (!response.ok || !body.accountId || !body.kind) throw new Error(body.error ?? 'PAIRING_NOT_FOUND');
  return { accountId: body.accountId, kind: body.kind };
}

export const formatPairingCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;
