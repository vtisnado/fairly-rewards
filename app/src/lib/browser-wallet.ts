import { Account, KeyPair, actions, base64Encode, encodeSignedDelegate, keyToImplicitAddress } from 'near-api-js';
import type { KeyPairString } from 'near-api-js';
import { provider } from './near';

export interface BrowserWallet {
  accountId: string;
  secretKey: KeyPairString;
}

type Action = ReturnType<typeof actions.functionCall>;

export const walletFromSecret = (secretKey: string): BrowserWallet => {
  const keyPair = KeyPair.fromString(secretKey.trim() as KeyPairString);
  return { accountId: keyToImplicitAddress(keyPair.getPublicKey()), secretKey: keyPair.toString() as KeyPairString };
};

export function loadWallet(storageKey: string): BrowserWallet | null {
  const secretKey = localStorage.getItem(storageKey);
  return secretKey ? walletFromSecret(secretKey) : null;
}

export function saveWallet(storageKey: string, wallet: BrowserWallet): BrowserWallet {
  localStorage.setItem(storageKey, wallet.secretKey);
  return wallet;
}

export const newWallet = (): BrowserWallet => walletFromSecret(KeyPair.fromRandom('ed25519').toString());

export async function relay<T>(wallet: BrowserWallet, receiverId: string, calls: Action[]): Promise<T> {
  const { signedDelegate } = await new Account(wallet.accountId, provider, wallet.secretKey).createSignedMetaTransaction({
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

export function signMessage(wallet: BrowserWallet, message: string): { publicKey: string; signature: string } {
  const keyPair = KeyPair.fromString(wallet.secretKey);
  const { signature } = keyPair.sign(new TextEncoder().encode(message));
  return { publicKey: keyPair.getPublicKey().toString(), signature: base64Encode(signature) };
}
