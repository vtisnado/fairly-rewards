import { JsonRpcProvider } from 'near-api-js';
import type { PassView, ProgramView, ListingView } from './types';

export const network = import.meta.env.PUBLIC_NEAR_NETWORK ?? 'testnet';
export const fairlyContract = import.meta.env.PUBLIC_FAIRLY_CONTRACT ?? '';
export const tusdcContract = import.meta.env.PUBLIC_TUSDC_CONTRACT ?? '';
export const rpcUrl = import.meta.env.PUBLIC_NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com';
export const explorerUrl = 'https://testnet.nearblocks.io';

export const provider = new JsonRpcProvider({ url: rpcUrl });

export async function viewFairly<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return provider.callFunction({ contractId: fairlyContract, method, args }) as Promise<T>;
}

export const getProgram = (slug: string) => viewFairly<ProgramView | null>('get_program', { slug });

export const getPass = (tokenId: string) => viewFairly<PassView | null>('get_pass', { token_id: tokenId });

export const getPassesByOwner = (accountId: string) =>
  viewFairly<PassView[]>('get_passes_by_owner', { account_id: accountId });

export const getListings = (slug?: string) => viewFairly<ListingView[]>('get_listings', { slug: slug ?? null });

export const accountUrl = (accountId: string) => `${explorerUrl}/address/${accountId}`;

export const transactionUrl = (hash: string) => `${explorerUrl}/txns/${hash}`;
