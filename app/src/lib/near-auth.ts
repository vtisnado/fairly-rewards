import { Auth0Client } from '@auth0/auth0-spa-js';
import {
  KeyType,
  PublicKey,
  Signature,
  SignedTransaction,
  actions,
  baseDecode,
  createTransaction,
  encodeTransaction,
} from 'near-api-js';
import { pendingWalletFor, relay, type BrowserWallet } from './browser-wallet';
import { provider } from './near';

const env = import.meta.env;
const DOMAIN = env.PUBLIC_NEAR_AUTH_DOMAIN ?? 'login.testnet.fast-auth.com';
const CLIENT_ID = env.PUBLIC_NEAR_AUTH_CLIENT_ID ?? 'np8paqIpMWmNbzT4xAvOOapZBjsOpptl';
const SIGNING_AUDIENCE = env.PUBLIC_NEAR_AUTH_AUDIENCE ?? 'auth0.jwt.fast-auth.testnet';
const FAST_AUTH_CONTRACT = env.PUBLIC_NEAR_AUTH_CONTRACT ?? 'fast-auth.testnet';
const MPC_CONTRACT = env.PUBLIC_NEAR_AUTH_MPC ?? 'v1.signer-prod.testnet';
const ALLOWED_ORIGINS = (env.PUBLIC_NEAR_AUTH_ORIGINS ?? 'http://localhost:3000').split(',').map((origin: string) => origin.trim());
const ED25519_DOMAIN = 1;

export type RecoveryKind = 'customer' | 'merchant';

export interface LinkedIdentity {
  email: string | null;
  publicKey: string;
}

export const nearAuthAvailable = () => typeof window !== 'undefined' && ALLOWED_ORIGINS.includes(window.location.origin);

let auth0: Auth0Client | null = null;

function client(): Auth0Client {
  auth0 ??= new Auth0Client({
    domain: DOMAIN,
    clientId: CLIENT_ID,
    cacheLocation: 'memory',
    authorizationParams: { redirect_uri: window.location.origin },
  });
  return auth0;
}

function nearAuthError(cause: unknown): Error {
  const detail = cause as { error?: string; error_description?: string; message?: string };
  const text = `${detail.error ?? ''} ${detail.error_description ?? detail.message ?? ''}`.toLowerCase();
  if (text.includes('verify') || text.includes('verified')) return new Error('NEAR_AUTH_VERIFY_EMAIL');
  if (text.includes('cancel') || text.includes('closed') || text.includes('timeout')) return new Error('NEAR_AUTH_CANCELLED');
  if (text.includes('popup')) return new Error('NEAR_AUTH_POPUP_BLOCKED');
  return new Error(`NEAR_AUTH_FAILED: ${detail.error_description ?? detail.message ?? detail.error ?? 'unknown'}`);
}

async function popup(options: Parameters<Auth0Client['loginWithPopup']>[0]) {
  try {
    await client().loginWithPopup(options);
  } catch (cause) {
    throw nearAuthError(cause);
  }
}

async function signIn(mode: 'signup' | 'login' = 'login'): Promise<{ sub: string; email: string | null }> {
  await popup(mode === 'signup' ? { authorizationParams: { screen_hint: 'signup' } } : undefined);
  const user = await client().getUser();
  if (!user?.sub) throw new Error('NEAR_AUTH_CANCELLED');
  return { sub: user.sub, email: user.email ?? null };
}

async function derivedPublicKey(sub: string): Promise<string> {
  const key = await provider.callFunction({
    contractId: MPC_CONTRACT,
    method: 'derived_public_key',
    args: { path: `jwt#https://${DOMAIN}/#${sub}`, predecessor: FAST_AUTH_CONTRACT, domain_id: ED25519_DOMAIN },
  });
  if (typeof key !== 'string' || !key.startsWith('ed25519:')) throw new Error('NEAR_AUTH_KEY_FAILED');
  return key;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'REQUEST_FAILED');
  return result;
}

export async function linkEmail(wallet: BrowserWallet, kind: RecoveryKind): Promise<LinkedIdentity> {
  const { sub, email } = await signIn('signup');
  const publicKey = await derivedPublicKey(sub);
  const keys = await provider.viewAccessKeyList({ accountId: wallet.accountId, finality: 'final' });
  if (!keys.keys.some((entry) => entry.public_key === publicKey)) {
    await relay(wallet, wallet.accountId, [actions.addFullAccessKey(PublicKey.from(publicKey))]);
  }
  await post('/api/recovery', { accountId: wallet.accountId, publicKey, kind });
  return { email, publicKey };
}

function tokenClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as Record<string, unknown>;
}

export interface PendingRecovery {
  accountId: string;
  email: string | null;
  approve(): Promise<BrowserWallet>;
}

export async function startRecovery(kind: RecoveryKind, storageName: string): Promise<PendingRecovery> {
  const { sub, email } = await signIn('login');
  const recoveryKey = await derivedPublicKey(sub);
  const response = await fetch(`/api/recovery?${new URLSearchParams({ publicKey: recoveryKey, kind })}`);
  const body = (await response.json()) as { accountId?: string; error?: string };
  if (!response.ok || !body.accountId) throw new Error(body.error ?? 'RECOVERY_NOT_FOUND');
  const accountId = body.accountId;

  const { wallet, keep } = await pendingWalletFor(accountId);
  const accessKey = await provider.viewAccessKey({ accountId, publicKey: recoveryKey, finality: 'final' });
  const block = await provider.viewBlock({ finality: 'final' });
  const transaction = createTransaction(
    accountId,
    PublicKey.from(recoveryKey),
    accountId,
    BigInt(accessKey.nonce) + 1n,
    [actions.addFullAccessKey(wallet.publicKey)],
    baseDecode(block.header.hash),
  );

  return {
    accountId,
    email,
    approve: async () => {
      await popup({
        authorizationParams: {
          audience: SIGNING_AUDIENCE,
          scope: 'transaction:sign',
          transaction: Array.from(encodeTransaction(transaction)) as unknown as string,
        },
      });
      const token = await client().getTokenSilently({ authorizationParams: { audience: SIGNING_AUDIENCE } });
      const signPayload = tokenClaims(token).fatxn;
      if (!Array.isArray(signPayload)) throw new Error('NEAR_AUTH_SIGNATURE_FAILED');
      const { signature } = await post<{ signature: number[] }>('/api/near-auth/sign', {
        guardId: `jwt#https://${DOMAIN}/`,
        verifyPayload: token,
        signPayload,
      });
      const signed = new SignedTransaction({
        transaction,
        signature: new Signature({ keyType: KeyType.ED25519, data: Uint8Array.from(signature) }),
      });
      await provider.sendTransaction(signed);
      await keep(storageName);
      return wallet;
    },
  };
}

export const NEAR_AUTH_MESSAGES: Record<string, string> = {
  NEAR_AUTH_VERIFY_EMAIL: 'Confirm your email first: open the message NEAR Auth sent you, then try again.',
  NEAR_AUTH_CANCELLED: 'The NEAR Auth window was closed before finishing.',
  NEAR_AUTH_POPUP_BLOCKED: 'Your browser blocked the NEAR Auth window. Allow pop-ups for this site and try again.',
  RECOVERY_NOT_FOUND: 'Nothing is linked to that email yet.',
  NEAR_AUTH_SIGNATURE_FAILED: 'NEAR Auth did not return a signature. Try again in a moment.',
};

export function nearAuthMessage(cause: unknown): string {
  const code = cause instanceof Error ? cause.message : '';
  if (NEAR_AUTH_MESSAGES[code]) return NEAR_AUTH_MESSAGES[code]!;
  if (code.startsWith('NEAR_AUTH_FAILED: ')) return `NEAR Auth: ${code.slice('NEAR_AUTH_FAILED: '.length)}`;
  return 'That did not finish. Try again.';
}
