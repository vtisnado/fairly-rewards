import type { APIRoute } from 'astro';
import { base64Decode } from 'near-api-js';
import { clientKey, isRateLimited } from '../../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';
import { sponsorAccount } from '../../../lib/server/signers';

const env = import.meta.env;
const DOMAIN = env.PUBLIC_NEAR_AUTH_DOMAIN ?? 'login.testnet.fast-auth.com';
const FAST_AUTH_CONTRACT = env.PUBLIC_NEAR_AUTH_CONTRACT ?? 'fast-auth.testnet';
const SIGN_GAS = 300_000_000_000_000n;
const SIGN_DEPOSIT = 1n;
const MAX_PAYLOAD = 4096;

interface SignOutcome {
  status: { SuccessValue?: string; Failure?: unknown };
}

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'near-auth-sign'), 10, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
  const { guardId, verifyPayload, signPayload } = (await request.json().catch(() => ({}))) as {
    guardId?: string;
    verifyPayload?: string;
    signPayload?: number[];
  };
  const validPayload =
    Array.isArray(signPayload) && signPayload.length > 0 && signPayload.length <= MAX_PAYLOAD && signPayload.every((byte) => Number.isInteger(byte) && byte >= 0 && byte < 256);
  if (guardId !== `jwt#https://${DOMAIN}/` || typeof verifyPayload !== 'string' || verifyPayload.split('.').length !== 3 || !validPayload) {
    return failure('INVALID_REQUEST');
  }
  try {
    const outcome = (await sponsorAccount().callFunctionRaw({
      contractId: FAST_AUTH_CONTRACT,
      methodName: 'sign',
      args: { guard_id: guardId, verify_payload: verifyPayload, sign_payload: signPayload, algorithm: 'eddsa' },
      gas: SIGN_GAS,
      deposit: SIGN_DEPOSIT,
    })) as unknown as SignOutcome;
    const value = outcome.status.SuccessValue;
    const result = value ? (JSON.parse(new TextDecoder().decode(base64Decode(value))) as { signature?: number[] } | null) : null;
    if (!result?.signature || result.signature.length !== 64) return failure('NEAR_AUTH_SIGNATURE_FAILED', 502);
    return json({ signature: result.signature });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
