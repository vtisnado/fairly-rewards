import { PublicKey, base64Decode, keyToImplicitAddress } from 'near-api-js';
import { getProgram } from '../near';

const MAX_AGE_MS = 5 * 60 * 1000;

export interface DeviceProof {
  accountId?: string;
  publicKey?: string;
  signature?: string;
  signedAt?: number;
}

function signatureValid(proof: DeviceProof, message: string): boolean {
  const { accountId, publicKey, signature, signedAt } = proof;
  if (!accountId || !publicKey || !signature || typeof signedAt !== 'number') return false;
  if (Math.abs(Date.now() - signedAt) > MAX_AGE_MS) return false;
  try {
    const key = PublicKey.fromString(publicKey);
    if (keyToImplicitAddress(key) !== accountId) return false;
    return key.verify(new TextEncoder().encode(message), base64Decode(signature));
  } catch {
    return false;
  }
}

export function verifiedCustomer(proof: DeviceProof): string | null {
  return signatureValid(proof, `fairly-code:${proof.accountId}:${proof.signedAt}`) ? proof.accountId! : null;
}

export async function verifiedDevice(slug: string, code: string, proof: DeviceProof, purpose = 'honor'): Promise<string | null> {
  if (!signatureValid(proof, `fairly-${purpose}:${slug}:${code}:${proof.signedAt}`)) return null;
  const program = await getProgram(slug);
  return program?.cashiers.some((cashier) => cashier.account_id === proof.accountId) ? proof.accountId! : null;
}
