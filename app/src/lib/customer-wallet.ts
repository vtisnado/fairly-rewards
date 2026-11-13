import { actions } from 'near-api-js';
import { createRecoveryKey, createWallet as createStored, importWallet, loadWallet as loadStored, relay, waitForAccount, type BrowserWallet } from './browser-wallet';
import { dollarsToBaseUnits } from './format';
import { fairlyContract, getPass, tusdcContract } from './near';

export const CUSTOMER_STORAGE_KEY = 'fairly.customer.key';
const ONE_YOCTO = 1n;
const CALL_GAS = 50_000_000_000_000n;

export type CustomerWallet = BrowserWallet;

export const loadWallet = () => loadStored(CUSTOMER_STORAGE_KEY);
export const createWallet = () => createStored(CUSTOMER_STORAGE_KEY);
export const restoreWallet = (secretKey: string) => importWallet(CUSTOMER_STORAGE_KEY, secretKey);
export const backupKey = (wallet: CustomerWallet) => createRecoveryKey(wallet);

const callFairly = <T>(wallet: CustomerWallet, methodName: string, args: Record<string, unknown>, deposit = 0n) =>
  relay<T>(wallet, fairlyContract, [actions.functionCall(methodName, args, CALL_GAS, deposit)]);

export const redeem = (wallet: CustomerWallet, tokenId: string, amount: string) =>
  callFairly<string>(wallet, 'redeem', { token_id: tokenId, amount }, ONE_YOCTO);

export const claimPerk = (wallet: CustomerWallet, tokenId: string, tierIndex: number) =>
  callFairly<string>(wallet, 'claim_perk', { token_id: tokenId, tier_index: tierIndex });

export const listPass = (wallet: CustomerWallet, tokenId: string, price: string) =>
  callFairly<void>(wallet, 'list_pass', { token_id: tokenId, price });

export const cancelListing = (wallet: CustomerWallet, tokenId: string) =>
  callFairly<void>(wallet, 'cancel_listing', { token_id: tokenId });

const TRANSFER_GAS = 100_000_000_000_000n;

export async function ensureCustomer(): Promise<CustomerWallet> {
  const wallet = (await loadWallet()) ?? (await createWallet());
  const response = await fetch('/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId: wallet.accountId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'ACCOUNT_FAILED');
  }
  await waitForAccount(wallet);
  return wallet;
}

export async function buyPass(wallet: CustomerWallet, tokenId: string, price: string): Promise<boolean> {
  const dollars = Number(price) / 1_000_000;
  await relay(wallet, tusdcContract, [actions.functionCall('faucet', { amount: dollarsToBaseUnits(dollars) }, CALL_GAS, 0n)]);
  await relay(wallet, tusdcContract, [
    actions.functionCall(
      'ft_transfer_call',
      { receiver_id: fairlyContract, amount: price, msg: JSON.stringify({ buy: tokenId }) },
      TRANSFER_GAS,
      ONE_YOCTO,
    ),
  ]);
  return (await getPass(tokenId))?.owner === wallet.accountId;
}
