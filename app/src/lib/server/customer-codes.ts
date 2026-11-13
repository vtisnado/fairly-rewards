import { CODE_ALPHABET, CODE_LENGTH, CODE_TTL_SECONDS, isCustomerToken, normalizeCustomerCode } from '../customer-code';
import { deleteRows, selectRows, tryInsertRow, updateRowsReturning } from './supabase';

const TABLE = 'customer_codes';
const INSERT_ATTEMPTS = 8;
const UNBIASED_LIMIT = 256 - (256 % CODE_ALPHABET.length);

export interface CustomerCodeRow {
  token_hash: string;
  code: string;
  account_id: string;
  expires_at: string;
  used_at: string | null;
}

export interface IssuedCustomerCode {
  token: string;
  code: string;
  expiresInSeconds: number;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const newToken = () => base64Url(crypto.getRandomValues(new Uint8Array(16)));

export function newTypedCode(): string {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH * 2))) {
      if (byte < UNBIASED_LIMIT && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

const nowIso = () => encodeURIComponent(new Date().toISOString());

export async function issueCustomerCode(accountId: string): Promise<IssuedCustomerCode> {
  await deleteRows(TABLE, `expires_at=lt.${nowIso()}`);
  await deleteRows(TABLE, `account_id=eq.${encodeURIComponent(accountId)}&used_at=is.null`);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  for (let attempt = 0; attempt < INSERT_ATTEMPTS; attempt++) {
    const token = newToken();
    const code = newTypedCode();
    const inserted = await tryInsertRow(TABLE, {
      token_hash: await hashToken(token),
      code,
      account_id: accountId,
      expires_at: expiresAt,
    });
    if (inserted) return { token, code, expiresInSeconds: CODE_TTL_SECONDS };
  }
  throw new Error('CODE_UNAVAILABLE');
}

export async function findActiveCode(input: { token?: string; code?: string }): Promise<CustomerCodeRow | null> {
  const active = `used_at=is.null&expires_at=gt.${nowIso()}&select=*&limit=1`;
  if (input.token) {
    if (!isCustomerToken(input.token)) return null;
    const [row] = await selectRows<CustomerCodeRow>(TABLE, `token_hash=eq.${await hashToken(input.token)}&${active}`);
    return row ?? null;
  }
  const code = input.code ? normalizeCustomerCode(input.code) : null;
  if (!code) return null;
  const [row] = await selectRows<CustomerCodeRow>(TABLE, `code=eq.${code}&${active}`);
  return row ?? null;
}

export async function consumeCustomerCode(row: CustomerCodeRow): Promise<boolean> {
  const consumed = await updateRowsReturning<CustomerCodeRow>(
    TABLE,
    `token_hash=eq.${row.token_hash}&used_at=is.null&expires_at=gt.${nowIso()}`,
    { used_at: new Date().toISOString() },
  );
  return consumed.length > 0;
}
