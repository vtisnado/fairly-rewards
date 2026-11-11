import type { APIRoute } from 'astro';
import { honorCode } from '../../../lib/server/cashier';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';

export const POST: APIRoute = async ({ request }) => {
  const { slug, code } = (await request.json().catch(() => ({}))) as { slug?: string; code?: string };
  const rejected = rejectUnlessDemo(request, slug, 'cashier-honor', 120);
  if (rejected) return rejected;
  if (!code) return failure('INVALID_REQUEST');

  try {
    return json(await honorCode(slug as string, code));
  } catch (error) {
    const reason = contractErrorCode(error);
    return failure(reason, reason === 'CODE_NOT_FOUND' || reason === 'INVALID_CODE' ? 404 : reason === 'ALREADY_HONORED' ? 409 : 502);
  }
};
