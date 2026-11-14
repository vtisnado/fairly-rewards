import {
  Account,
  KeyPair,
  KeyType,
  PublicKey,
  Signer,
  actions,
  base64Encode,
  baseDecode,
  encodeSignedDelegate,
  keyToImplicitAddress,
} from 'near-api-js';
import type { KeyPairString } from 'near-api-js';
import { provider } from './near';

const DB_NAME = 'fairly-keys';
const STORE = 'keys';
const ED25519 = { name: 'Ed25519' } as const;
const PKCS8_ED25519_PREFIX = new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

type Action = ReturnType<typeof actions.functionCall>;

interface StoredKey {
  accountId?: string;
  publicKey: Uint8Array;
  privateKey?: CryptoKey;
  secretKey?: KeyPairString;
}

class BrowserSigner extends Signer {
  constructor(
    private readonly publicKey: PublicKey,
    private readonly sign: (bytes: Uint8Array) => Promise<Uint8Array>,
  ) {
    super();
  }

  async getPublicKey(): Promise<PublicKey> {
    return this.publicKey;
  }

  signBytes(bytes: Uint8Array): Promise<Uint8Array> {
    return this.sign(bytes);
  }
}

export interface BrowserWallet {
  accountId: string;
  publicKey: PublicKey;
  signer: BrowserSigner;
  protectedKey: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = run(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const readKey = (name: string) => withStore<StoredKey | undefined>('readonly', (store) => store.get(name));
const writeKey = (name: string, key: StoredKey) => withStore('readwrite', (store) => store.put(key, name));

let webCryptoSupport: Promise<boolean> | null = null;

function supportsWebCryptoEd25519(): Promise<boolean> {
  webCryptoSupport ??= crypto.subtle
    .generateKey(ED25519, false, ['sign', 'verify'])
    .then(() => true)
    .catch(() => false);
  return webCryptoSupport;
}

function toWallet(stored: StoredKey): BrowserWallet {
  const publicKey = new PublicKey({ keyType: KeyType.ED25519, data: stored.publicKey });
  const sign = stored.privateKey
    ? async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.sign(ED25519, stored.privateKey!, new Uint8Array(bytes)))
    : async (bytes: Uint8Array) => KeyPair.fromString(stored.secretKey!).sign(bytes).signature;
  return { accountId: stored.accountId ?? keyToImplicitAddress(publicKey), publicKey, signer: new BrowserSigner(publicKey, sign), protectedKey: !!stored.privateKey };
}

async function protect(secretKey: KeyPairString): Promise<StoredKey> {
  const keyPair = KeyPair.fromString(secretKey);
  const publicKey = keyPair.getPublicKey().data;
  if (!(await supportsWebCryptoEd25519())) return { publicKey, secretKey };
  const seed = baseDecode(secretKey.split(':')[1]!).slice(0, 32);
  const pkcs8 = new Uint8Array([...PKCS8_ED25519_PREFIX, ...seed]);
  const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, ED25519, false, ['sign']);
  return { publicKey, privateKey };
}

async function generate(): Promise<StoredKey> {
  if (!(await supportsWebCryptoEd25519())) {
    const keyPair = KeyPair.fromRandom('ed25519');
    return { publicKey: keyPair.getPublicKey().data, secretKey: keyPair.toString() as KeyPairString };
  }
  const pair = (await crypto.subtle.generateKey(ED25519, false, ['sign', 'verify'])) as CryptoKeyPair;
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey, privateKey: pair.privateKey };
}

export async function loadWallet(name: string): Promise<BrowserWallet | null> {
  const stored = await readKey(name);
  if (stored) return toWallet(stored);
  const legacy = localStorage.getItem(name);
  if (!legacy) return null;
  const migrated = await protect(legacy as KeyPairString);
  await writeKey(name, migrated);
  localStorage.removeItem(name);
  return toWallet(migrated);
}

export async function createWallet(name: string): Promise<BrowserWallet> {
  const stored = await generate();
  await writeKey(name, stored);
  return toWallet(stored);
}

export async function pendingWalletFor(accountId: string): Promise<{ wallet: BrowserWallet; keep: (name: string) => Promise<void> }> {
  const stored = { ...(await generate()), accountId };
  return { wallet: toWallet(stored), keep: (name) => writeKey(name, stored).then(() => undefined) };
}

export async function adoptWallet(fromName: string, toName: string, accountId: string): Promise<BrowserWallet> {
  const stored = await readKey(fromName);
  if (!stored) throw new Error('KEY_NOT_FOUND');
  const adopted = { ...stored, accountId };
  await writeKey(toName, adopted);
  await withStore('readwrite', (store) => store.delete(fromName));
  return toWallet(adopted);
}

export const loadOrCreateWallet = async (name: string) => (await loadWallet(name)) ?? createWallet(name);

export function parseBackup(text: string): { accountId: string; secretKey: KeyPairString } {
  const key = text.match(/ed25519:[1-9A-HJ-NP-Za-km-z]+/)?.[0] as KeyPairString | undefined;
  if (!key) throw new Error('INVALID_KEY');
  const keyPair = KeyPair.fromString(key);
  const account = text.match(/Account:\s*([a-z0-9._-]+)/i)?.[1];
  return { accountId: account ?? keyToImplicitAddress(keyPair.getPublicKey()), secretKey: key };
}

export async function importWallet(name: string, backup: string): Promise<BrowserWallet> {
  const { accountId, secretKey } = parseBackup(backup);
  const stored = { ...(await protect(secretKey)), accountId };
  await writeKey(name, stored);
  return toWallet(stored);
}

export const backupText = (label: string, accountId: string, secretKey: string) =>
  `${label}\nAccount: ${accountId}\nKey: ${secretKey}\nKeep this file private. Anyone with it controls the account.\n`;

export async function waitForAccount(wallet: BrowserWallet, attempts = 20): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await provider.viewAccessKey({ accountId: wallet.accountId, publicKey: wallet.publicKey });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw new Error('ACCOUNT_NOT_READY');
}

export async function relay<T>(wallet: BrowserWallet, receiverId: string, calls: Action[]): Promise<T> {
  const { signedDelegate } = await new Account(wallet.accountId, provider, wallet.signer).createSignedMetaTransaction({
    receiverId,
    actions: calls,
  });
  const response = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedDelegate: base64Encode(encodeSignedDelegate(signedDelegate)) }),
  });
  const body = (await response.json()) as { result?: T; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? 'RELAY_FAILED');
  }
  return body.result as T;
}

export async function signMessage(wallet: BrowserWallet, message: string): Promise<{ publicKey: string; signature: string }> {
  const signature = await wallet.signer.signBytes(new TextEncoder().encode(message));
  return { publicKey: wallet.publicKey.toString(), signature: base64Encode(signature) };
}

export async function createRecoveryKey(wallet: BrowserWallet): Promise<KeyPairString> {
  const recovery = KeyPair.fromRandom('ed25519');
  await relay(wallet, wallet.accountId, [actions.addFullAccessKey(recovery.getPublicKey())]);
  return recovery.toString() as KeyPairString;
}
