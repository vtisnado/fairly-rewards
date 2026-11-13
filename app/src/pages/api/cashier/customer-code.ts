import type { APIRoute } from 'astro';
import { getPassesByOwner } from '../../../lib/near';
import { consumeCustomerCode, findActiveCode } from '../../../lib/server/customer-codes';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { verifiedDevice, type DeviceProof } from '../../../lib/server/device-proof';
import { clientKey, isLimitReached, isRateLimited } from '../../../lib/server/rate-limit';
import { failure, json } from '../../../lib/server/responses';

const MINUTE_MS = 60 * 1000;
const FAILURE_WINDOW_MS = 10 * MINUTE_MS;
const FAILURE_LIMIT = 10;

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { slug?: string; token?: string; code?: string } & DeviceProof;
  const { slug, token, code } = body;
  const value = token ?? code;
  if (!slug || !value || typeof value !== 'string') return failure('INVALID_REQUEST');

  let actor: string;
  if (body.accountId) {
    if (isRateLimited(clientKey(request, 'customer-code-resolve-ip'), 600, MINUTE_MS)) return failure('RATE_LIMITED', 429);
    const device = await verifiedDevice(slug, value, body, 'resolve');
    if (!device) return failure('NOT_CASHIER', 403);
    actor = `device:${device}`;
    if (isRateLimited(`customer-code-resolve:${actor}`, 120, MINUTE_MS)) return failure('RATE_LIMITED', 429);
  } else {
    const rejected = rejectUnlessDemo(request, slug, 'cashier-customer-code', 600);
    if (rejected) return rejected;
    actor = clientKey(request, 'demo');
  }

  const failureKey = `customer-code-failures:${actor}`;
  if (isLimitReached(failureKey, FAILURE_LIMIT)) return failure('RATE_LIMITED', 429);

  const notFound = () => {
    isRateLimited(failureKey, FAILURE_LIMIT, FAILURE_WINDOW_MS);
    return failure('CODE_NOT_FOUND', 404);
  };

  try {
    const row = await findActiveCode(token ? { token } : { code });
    if (!row) return notFound();
    const pass = (await getPassesByOwner(row.account_id)).find((entry) => entry.program_slug === slug) ?? null;
    if (!(await consumeCustomerCode(row))) return notFound();
    return json({ accountId: row.account_id, code: row.code, pass });
  } catch {
    return failure('RESOLVE_FAILED', 502);
  }
};
