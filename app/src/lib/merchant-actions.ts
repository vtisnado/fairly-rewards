import { actions, nearToYocto } from 'near-api-js';
import { createRecoveryKey, importWallet, loadOrCreateWallet, loadWallet, relay, waitForAccount, type BrowserWallet } from './browser-wallet';
import { pairingStorageKey } from './pairing';
import { dollarsToBaseUnits } from './format';
import { fairlyContract, provider, tusdcContract } from './near';
import type { BoostSchedule } from './types';

const STORAGE_KEY = 'fairly.merchant.key';
const CALL_GAS = 50_000_000_000_000n;
const TRANSFER_GAS = 100_000_000_000_000n;
const ONE_YOCTO = 1n;
export const PROGRAM_DEPOSIT_NEAR = '0.4';
const DEVICE_FUNDING_NEAR = '0.01';
const MANAGER_FUNDING_NEAR = '0.1';

export interface LocationInput {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface BoostInput {
  name: string;
  extra_bps: number;
  schedule: BoostSchedule;
}

export interface ProgramInput {
  slug: string;
  name: string;
  mcc: number;
  utc_offset_minutes: number;
  brand_color: string;
  logo_url: string | null;
  cashback_bps: number;
  royalty_bps: number;
  expiry_days: number | null;
  daily_cap: string;
  tiers: { name: string; min_purchases: number; perk: string | null }[];
  locations: LocationInput[];
}

export interface ProgramUpdate {
  name?: string;
  brand_color?: string;
  logo_url?: string;
  cashback_bps?: number;
  perks?: (string | null)[];
  utc_offset_minutes?: number;
}

export type MerchantRole = 'owner' | 'manager' | 'demo' | 'viewer';

export interface MerchantActions {
  role: MerchantRole;
  canManage: boolean;
  fund(dollars: number): Promise<void>;
  addLocation(location: LocationInput): Promise<void>;
  updateLocation(location: LocationInput): Promise<void>;
  addBoost(boost: BoostInput): Promise<void>;
  setBoostEnabled(boostId: number, enabled: boolean): Promise<void>;
  removeBoost(boostId: number): Promise<void>;
  withdraw(amount: string): Promise<void>;
  setPaused(paused: boolean): Promise<void>;
  updateProgram(update: ProgramUpdate): Promise<void>;
  addDevice(accountId: string, locationId: string): Promise<void>;
  reactivateDevice(accountId: string, locationId: string): Promise<void>;
  removeDevice(accountId: string): Promise<void>;
  addManager(accountId: string, locationId: string | null): Promise<void>;
  removeManager(accountId: string): Promise<void>;
}

export const loadMerchant = () => loadWallet(STORAGE_KEY);
export const restoreMerchant = (secretKey: string) => importWallet(STORAGE_KEY, secretKey);
export const merchantBackupKey = (wallet: BrowserWallet) => createRecoveryKey(wallet);

export const loadManager = (slug: string) => loadWallet(pairingStorageKey('manager', slug));

export async function ensureMerchant(): Promise<BrowserWallet> {
  const wallet = await loadOrCreateWallet(STORAGE_KEY);
  const response = await fetch('/api/merchant/account', {
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

async function accountExists(accountId: string) {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}

const callFairly = (wallet: BrowserWallet, method: string, args: Record<string, unknown>, deposit = 0n) =>
  relay<unknown>(wallet, fairlyContract, [actions.functionCall(method, args, CALL_GAS, deposit)]);

export const createProgram = (wallet: BrowserWallet, input: ProgramInput) =>
  callFairly(wallet, 'create_program', { input }, nearToYocto(PROGRAM_DEPOSIT_NEAR));

export async function fundPool(wallet: BrowserWallet, slug: string, dollars: number) {
  const amount = dollarsToBaseUnits(dollars);
  await relay(wallet, tusdcContract, [actions.functionCall('faucet', { amount }, CALL_GAS, 0n)]);
  await relay(wallet, tusdcContract, [
    actions.functionCall(
      'ft_transfer_call',
      { receiver_id: fairlyContract, amount, msg: JSON.stringify({ fund: slug }) },
      TRANSFER_GAS,
      ONE_YOCTO,
    ),
  ]);
}

async function fundIfNew(wallet: BrowserWallet, accountId: string, amountNear: string) {
  if (await accountExists(accountId)) return;
  await relay(wallet, accountId, [actions.transfer(nearToYocto(amountNear))]);
}

async function connectDevice(wallet: BrowserWallet, slug: string, accountId: string, locationId: string) {
  await fundIfNew(wallet, accountId, DEVICE_FUNDING_NEAR);
  await callFairly(wallet, 'add_cashier', { slug, account_id: accountId, location_id: locationId });
}

export function ownerActions(wallet: BrowserWallet, slug: string): MerchantActions {
  return {
    role: 'owner',
    canManage: true,
    fund: (dollars) => fundPool(wallet, slug, dollars),
    addLocation: async (location) => void (await callFairly(wallet, 'add_location', { slug, location })),
    updateLocation: async (location) => void (await callFairly(wallet, 'update_location', { slug, location })),
    addBoost: async (boost) => void (await callFairly(wallet, 'add_boost', { slug, boost })),
    setBoostEnabled: async (boostId, enabled) => void (await callFairly(wallet, 'set_boost_enabled', { slug, boost_id: boostId, enabled })),
    removeBoost: async (boostId) => void (await callFairly(wallet, 'remove_boost', { slug, boost_id: boostId })),
    withdraw: async (amount) => void (await callFairly(wallet, 'withdraw_pool', { slug, amount }, ONE_YOCTO)),
    setPaused: async (paused) => void (await callFairly(wallet, 'set_paused', { slug, paused })),
    updateProgram: async (update) => void (await callFairly(wallet, 'update_program', { slug, update })),
    addDevice: (accountId, locationId) => connectDevice(wallet, slug, accountId, locationId),
    reactivateDevice: async (accountId, locationId) =>
      void (await callFairly(wallet, 'add_cashier', { slug, account_id: accountId, location_id: locationId })),
    removeDevice: async (accountId) => void (await callFairly(wallet, 'remove_cashier', { slug, account_id: accountId })),
    addManager: async (accountId, locationId) => {
      await fundIfNew(wallet, accountId, MANAGER_FUNDING_NEAR);
      await callFairly(wallet, 'add_manager', { slug, account_id: accountId, location_id: locationId });
    },
    removeManager: async (accountId) => void (await callFairly(wallet, 'remove_manager', { slug, account_id: accountId })),
  };
}

export function managerActions(wallet: BrowserWallet, slug: string): MerchantActions {
  return {
    ...readOnlyActions(),
    role: 'manager',
    addDevice: (accountId, locationId) => connectDevice(wallet, slug, accountId, locationId),
    reactivateDevice: async (accountId, locationId) =>
      void (await callFairly(wallet, 'add_cashier', { slug, account_id: accountId, location_id: locationId })),
    removeDevice: async (accountId) => void (await callFairly(wallet, 'remove_cashier', { slug, account_id: accountId })),
  };
}

async function demoCall(slug: string, method: string, args: Record<string, unknown>) {
  const response = await fetch('/api/merchant/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug, method, args }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'CHAIN_ERROR');
}

const locked = () => Promise.reject(new Error('DEMO_LOCKED'));

export function demoActions(slug: string): MerchantActions {
  return {
    ...readOnlyActions(),
    role: 'demo',
    fund: (dollars) => demoCall(slug, 'fund', { dollars }),
    addLocation: (location) => demoCall(slug, 'add_location', { location }),
    updateLocation: (location) => demoCall(slug, 'update_location', { location }),
    addBoost: (boost) => demoCall(slug, 'add_boost', { boost }),
    setBoostEnabled: (boostId, enabled) => demoCall(slug, 'set_boost_enabled', { boost_id: boostId, enabled }),
    removeBoost: (boostId) => demoCall(slug, 'remove_boost', { boost_id: boostId }),
  };
}

export function readOnlyActions(): MerchantActions {
  return {
    role: 'viewer',
    canManage: false,
    fund: locked,
    addLocation: locked,
    updateLocation: locked,
    addBoost: locked,
    setBoostEnabled: locked,
    removeBoost: locked,
    withdraw: locked,
    setPaused: locked,
    updateProgram: locked,
    addDevice: locked,
    reactivateDevice: locked,
    removeDevice: locked,
    addManager: locked,
    removeManager: locked,
  };
}

export const ACTION_ERRORS: Record<string, string> = {
  DEMO_LOCKED: 'This is locked in the shared demo. Create your own program to try it.',
  RATE_LIMITED: 'Too many changes. Try again later.',
  INVALID_LOCATION: 'A location with that name already exists.',
  TOO_MANY_LOCATIONS: 'The program already has the maximum of 20 locations.',
  TOO_MANY_BOOSTS: 'The program already has the maximum of 10 boosts.',
  TOO_MANY_CASHIERS: 'The program already has the maximum of 20 devices.',
  INVALID_BOOST: 'Check the boost name, dates and extra cashback.',
  INSUFFICIENT_POOL: 'That is more than the pool holds.',
  NO_STORAGE: 'The program ran out of storage deposit.',
  SLUG_TAKEN: 'That web address is taken. Pick another one.',
  INSUFFICIENT_DEPOSIT: 'The account does not have enough test NEAR for storage.',
  NOT_OWNER: 'Only the program owner can do this.',
  PAIRING_NOT_FOUND: 'That code was not found or expired. Ask for a new one on the device.',
  NOT_MANAGER: 'You can only manage devices at your location.',
  ALREADY_HAS_PROGRAM: 'This business account already has a program.',
  INVALID_TIMEZONE: 'Pick a valid time zone.',
  TOO_MANY_MANAGERS: 'The program already has the maximum of 10 managers.',
};

export const actionError = (cause: unknown) =>
  ACTION_ERRORS[cause instanceof Error ? cause.message : ''] ?? 'That did not go through. Try again.';
