import { Account } from 'near-api-js';
import type { KeyPairString } from 'near-api-js';
import {
  DEMO_CASHIER_ACCOUNT_ID,
  DEMO_CASHIER_PRIVATE_KEY,
  SPONSOR_ACCOUNT_ID,
  SPONSOR_AMOUNT_NEAR,
  SPONSOR_PRIVATE_KEY,
} from 'astro:env/server';
import { PUBLIC_DEMO_PROGRAM_SLUG } from 'astro:env/client';
import { provider } from '../near';

export const sponsorAmountNear = SPONSOR_AMOUNT_NEAR;
export const demoProgramSlug = PUBLIC_DEMO_PROGRAM_SLUG;

export const sponsorAccount = () =>
  new Account(SPONSOR_ACCOUNT_ID, provider, SPONSOR_PRIVATE_KEY as KeyPairString);

export const demoCashierAccount = () =>
  new Account(DEMO_CASHIER_ACCOUNT_ID, provider, DEMO_CASHIER_PRIVATE_KEY as KeyPairString);
