import { actions } from 'near-api-js';
import { loadWallet, relay, signMessage, type BrowserWallet } from './browser-wallet';
import { fairlyContract } from './near';
import type { PassView, PurchaseResult } from './types';

const CALL_GAS = 50_000_000_000_000n;
const storageKey = (slug: string) => `fairly.device.${slug}`;

export interface HonorResult {
  kind: 'redeem' | 'perk';
  amount: string | null;
  perk: string | null;
}

export type CustomerLookup = { token: string } | { code: string };

export interface ResolvedCustomer {
  accountId: string;
  code: string;
  pass: PassView | null;
}

export interface CashierClient {
  resolveCustomer(lookup: CustomerLookup): Promise<ResolvedCustomer>;
  issue(owner: string): Promise<string>;
  purchase(tokenId: string, amountCents: number, locationId: string, category: string | null): Promise<PurchaseResult>;
  honor(code: string): Promise<HonorResult>;
}

export const pairedDevice = (slug: string): Promise<BrowserWallet | null> => loadWallet(storageKey(slug));

export const forgetDevice = (slug: string) => localStorage.removeItem(storageKey(slug));

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'REQUEST_FAILED');
  return result;
}

export function demoCashier(slug: string): CashierClient {
  return {
    resolveCustomer: (lookup) => post<ResolvedCustomer>('/api/cashier/customer-code', { slug, ...lookup }),
    issue: async (owner) => (await post<{ tokenId: string }>('/api/cashier/issue', { slug, owner })).tokenId,
    purchase: (tokenId, amountCents, _locationId, category) => post<PurchaseResult>('/api/cashier/purchase', { slug, tokenId, amountCents, category }),
    honor: (code) => post<HonorResult>('/api/cashier/honor', { slug, code }),
  };
}

export function deviceCashier(slug: string, device: BrowserWallet): CashierClient {
  const call = <T>(method: string, args: Record<string, unknown>) =>
    relay<T>(device, fairlyContract, [actions.functionCall(method, args, CALL_GAS, 0n)]);
  return {
    resolveCustomer: async (lookup) => {
      const value = 'token' in lookup ? lookup.token : lookup.code;
      const signedAt = Date.now();
      const proof = await signMessage(device, `fairly-resolve:${slug}:${value}:${signedAt}`);
      return post<ResolvedCustomer>('/api/cashier/customer-code', { slug, ...lookup, accountId: device.accountId, signedAt, ...proof });
    },
    issue: (owner) => call<string>('issue_pass', { slug, owner }),
    purchase: (tokenId, amountCents, locationId, category) =>
      call<PurchaseResult>('record_purchase', { token_id: tokenId, amount_cents: amountCents, location_id: locationId, category }),
    honor: async (code) => {
      const signedAt = Date.now();
      const proof = await signMessage(device, `fairly-honor:${slug}:${code}:${signedAt}`);
      return post<HonorResult>('/api/cashier/honor', { slug, code, accountId: device.accountId, signedAt, ...proof });
    },
  };
}
