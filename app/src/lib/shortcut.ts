import { KeyType, PublicKey, actions } from 'near-api-js';
import { adoptWallet, loadOrCreateWallet, relay, type BrowserWallet } from './browser-wallet';
import { provider } from './near';
import { lookupPairing, markPairingConnected, requestPairing } from './pairing';

export type ShortcutContext = 'customer' | 'merchant';

const pendingName = (context: ShortcutContext, slug: string) => `fairly.pending.${context}.${slug}`;

export const pendingShortcutKey = (context: ShortcutContext, slug: string) => loadOrCreateWallet(pendingName(context, slug));

export const adoptShortcutKey = (context: ShortcutContext, slug: string, accountId: string, storageName: string) =>
  adoptWallet(pendingName(context, slug), storageName, accountId);

export const requestShortcutCode = (slug: string, wallet: BrowserWallet) => requestPairing(slug, 'shortcut', wallet.accountId);

export function publicKeyOfImplicitAccount(accountId: string): PublicKey {
  const bytes = accountId.match(/../g)?.map((pair) => Number.parseInt(pair, 16));
  if (!/^[0-9a-f]{64}$/.test(accountId) || !bytes) throw new Error('INVALID_SHORTCUT_CODE');
  return new PublicKey({ keyType: KeyType.ED25519, data: new Uint8Array(bytes) });
}

export async function findConnectedAccount(slug: string, code: string, wallet: BrowserWallet): Promise<string | null> {
  const { connectedAccountId } = await lookupPairing(slug, code, true);
  if (!connectedAccountId) return null;
  try {
    await provider.viewAccessKey({ accountId: connectedAccountId, publicKey: wallet.publicKey });
    return connectedAccountId;
  } catch {
    return null;
  }
}

export async function connectShortcut(wallet: BrowserWallet, slug: string, code: string): Promise<void> {
  const request = await lookupPairing(slug, code);
  if (request.kind !== 'shortcut') throw new Error('PAIRING_NOT_FOUND');
  const shortcutKey = publicKeyOfImplicitAccount(request.accountId);
  await relay(wallet, wallet.accountId, [actions.addFullAccessKey(shortcutKey)]);
  await markPairingConnected(slug, code, wallet.accountId);
}
