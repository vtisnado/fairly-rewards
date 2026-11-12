import type { APIRoute } from 'astro';
import { honorCode } from '../../../lib/server/cashier';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { verifiedDevice, type DeviceProof } from '../../../lib/server/device-proof';
import { clientKey, isRateLimited } from '../../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { slug?: string; code?: string } & DeviceProof;
  const { slug, code } = body;
  if (!slug || !code) return failure('INVALID_REQUEST');
  let honoredBy: string | null = null;
  if (body.accountId) {
    if (isRateLimited(clientKey(request, 'device-honor'), 240, 60 * 60 * 1000)) return failure('RATE_LIMITED', 429);
    honoredBy = await verifiedDevice(slug, code, body);
    if (!honoredBy) return failure('NOT_CASHIER', 403);
  } else {
    const rejected = rejectUnlessDemo(request, slug, 'cashier-honor', 120);
    if (rejected) return rejected;
  }

  try {
    return json(await honorCode(slug, code, honoredBy ?? undefined));
  } catch (error) {
    const reason = contractErrorCode(error);
    return failure(reason, reason === 'CODE_NOT_FOUND' || reason === 'INVALID_CODE' ? 404 : reason === 'ALREADY_HONORED' ? 409 : 502);
  }
};
