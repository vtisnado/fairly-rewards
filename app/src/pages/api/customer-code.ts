import type { APIRoute } from 'astro';
import { verifiedCustomer, type DeviceProof } from '../../lib/server/device-proof';
import { issueCustomerCode } from '../../lib/server/customer-codes';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { failure, json } from '../../lib/server/responses';

const MINUTE_MS = 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'customer-code'), 60, MINUTE_MS)) return failure('RATE_LIMITED', 429);
  const proof = (await request.json().catch(() => ({}))) as DeviceProof;
  const accountId = verifiedCustomer(proof);
  if (!accountId) return failure('INVALID_PROOF', 403);
  if (isRateLimited(`customer-code-account:${accountId}`, 30, MINUTE_MS)) return failure('RATE_LIMITED', 429);
  try {
    return json(await issueCustomerCode(accountId));
  } catch {
    return failure('CODE_UNAVAILABLE', 502);
  }
};
