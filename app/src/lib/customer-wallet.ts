import { actions } from 'near-api-js';
import { loadWallet as loadStored, newWallet, relay, saveWallet, walletFromSecret, type BrowserWallet } from './browser-wallet';
import { fairlyContract } from './near';

const STORAGE_KEY = 'fairly.customer.key';
const ONE_YOCTO = 1n;
const CALL_GAS = 50_000_000_000_000n;

export type CustomerWallet = BrowserWallet;

export const loadWallet = () => loadStored(STORAGE_KEY);
export const createWallet = () => saveWallet(STORAGE_KEY, newWallet());
export const restoreWallet = (secretKey: string) => saveWallet(STORAGE_KEY, walletFromSecret(secretKey));

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
