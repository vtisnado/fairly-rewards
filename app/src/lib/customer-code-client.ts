import { signMessage, type BrowserWallet } from './browser-wallet';

export interface IssuedCode {
  token: string;
  code: string;
  expiresInSeconds: number;
}

export async function requestCustomerCode(wallet: BrowserWallet): Promise<IssuedCode> {
  const signedAt = Date.now();
  const proof = await signMessage(wallet, `fairly-code:${wallet.accountId}:${signedAt}`);
  const response = await fetch('/api/customer-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ accountId: wallet.accountId, signedAt, ...proof }),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<IssuedCode> & { error?: string };
  if (!response.ok || !body.token || !body.code) throw new Error(body.error ?? 'CODE_UNAVAILABLE');
  return { token: body.token, code: body.code, expiresInSeconds: body.expiresInSeconds ?? 180 };
}
