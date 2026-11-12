import { PublicKey, base64Decode, keyToImplicitAddress } from 'near-api-js';
import { getProgram } from '../near';

const MAX_AGE_MS = 5 * 60 * 1000;

export interface DeviceProof {
  accountId?: string;
  publicKey?: string;
  signature?: string;
  signedAt?: number;
}

export async function verifiedDevice(slug: string, code: string, proof: DeviceProof): Promise<string | null> {
  const { accountId, publicKey, signature, signedAt } = proof;
  if (!accountId || !publicKey || !signature || typeof signedAt !== 'number') return null;
  if (Math.abs(Date.now() - signedAt) > MAX_AGE_MS) return null;
  try {
    const key = PublicKey.fromString(publicKey);
    if (keyToImplicitAddress(key) !== accountId) return null;
    const message = new TextEncoder().encode(`fairly-honor:${slug}:${code}:${signedAt}`);
    if (!key.verify(message, base64Decode(signature))) return null;
  } catch {
    return null;
  }
  const program = await getProgram(slug);
  return program?.cashiers.some((cashier) => cashier.account_id === accountId) ? accountId : null;
}
