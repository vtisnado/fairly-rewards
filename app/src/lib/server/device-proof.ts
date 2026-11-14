import { PublicKey, base64Decode, keyToImplicitAddress } from 'near-api-js';
import { getProgram, provider } from '../near';

const MAX_AGE_MS = 5 * 60 * 1000;

export interface DeviceProof {
  accountId?: string;
  publicKey?: string;
  signature?: string;
  signedAt?: number;
}

async function keyBelongsToAccount(key: PublicKey, accountId: string): Promise<boolean> {
  if (keyToImplicitAddress(key) === accountId) return true;
  try {
    await provider.viewAccessKey({ accountId, publicKey: key });
    return true;
  } catch {
    return false;
  }
}

async function signatureValid(proof: DeviceProof, message: string): Promise<boolean> {
  const { accountId, publicKey, signature, signedAt } = proof;
  if (!accountId || !publicKey || !signature || typeof signedAt !== 'number') return false;
  if (Math.abs(Date.now() - signedAt) > MAX_AGE_MS) return false;
  try {
    const key = PublicKey.fromString(publicKey);
    if (!key.verify(new TextEncoder().encode(message), base64Decode(signature))) return false;
    return await keyBelongsToAccount(key, accountId);
  } catch {
    return false;
  }
}

export async function verifiedCustomer(proof: DeviceProof): Promise<string | null> {
  return (await signatureValid(proof, `fairly-code:${proof.accountId}:${proof.signedAt}`)) ? proof.accountId! : null;
}

export async function verifiedDevice(slug: string, code: string, proof: DeviceProof, purpose = 'honor'): Promise<string | null> {
  if (!(await signatureValid(proof, `fairly-${purpose}:${slug}:${code}:${proof.signedAt}`))) return null;
  const program = await getProgram(slug);
  return program?.cashiers.some((cashier) => cashier.account_id === proof.accountId) ? proof.accountId! : null;
}
