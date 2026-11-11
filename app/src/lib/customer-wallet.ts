import { Account, KeyPair, actions, base64Encode, encodeSignedDelegate, keyToImplicitAddress } from 'near-api-js';
import type { KeyPairString } from 'near-api-js';
import { fairlyContract, provider } from './near';

const STORAGE_KEY = 'fairly.customer.key';
const ONE_YOCTO = 1n;
const CALL_GAS = 50_000_000_000_000n;

export interface CustomerWallet {
  accountId: string;
  secretKey: KeyPairString;
}

export function loadWallet(): CustomerWallet | null {
  const secretKey = localStorage.getItem(STORAGE_KEY) as KeyPairString | null;
  if (!secretKey) {
    return null;
  }
  return { accountId: keyToImplicitAddress(KeyPair.fromString(secretKey).getPublicKey()), secretKey };
}

export function createWallet(): CustomerWallet {
  const keyPair = KeyPair.fromRandom('ed25519');
  const secretKey = keyPair.toString() as KeyPairString;
  localStorage.setItem(STORAGE_KEY, secretKey);
  return { accountId: keyToImplicitAddress(keyPair.getPublicKey()), secretKey };
}

export function restoreWallet(secretKey: string): CustomerWallet {
  const keyPair = KeyPair.fromString(secretKey.trim() as KeyPairString);
  localStorage.setItem(STORAGE_KEY, keyPair.toString());
  return { accountId: keyToImplicitAddress(keyPair.getPublicKey()), secretKey: keyPair.toString() as KeyPairString };
}

function account(wallet: CustomerWallet): Account {
  return new Account(wallet.accountId, provider, wallet.secretKey);
}

async function callFairly<T>(
  wallet: CustomerWallet,
  methodName: string,
  args: Record<string, unknown>,
  deposit = 0n,
): Promise<T> {
  const { signedDelegate } = await account(wallet).createSignedMetaTransaction({
    receiverId: fairlyContract,
    actions: [actions.functionCall(methodName, args, CALL_GAS, deposit)],
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

export const redeem = (wallet: CustomerWallet, tokenId: string, amount: string) =>
  callFairly<string>(wallet, 'redeem', { token_id: tokenId, amount }, ONE_YOCTO);

export const claimPerk = (wallet: CustomerWallet, tokenId: string, tierIndex: number) =>
  callFairly<string>(wallet, 'claim_perk', { token_id: tokenId, tier_index: tierIndex });

export const listPass = (wallet: CustomerWallet, tokenId: string, price: string) =>
  callFairly<void>(wallet, 'list_pass', { token_id: tokenId, price });

export const cancelListing = (wallet: CustomerWallet, tokenId: string) =>
  callFairly<void>(wallet, 'cancel_listing', { token_id: tokenId });
