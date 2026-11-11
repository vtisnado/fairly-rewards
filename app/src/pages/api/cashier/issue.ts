import type { APIRoute } from 'astro';
import { issuePass } from '../../../lib/server/cashier';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';

export const POST: APIRoute = async ({ request }) => {
  const { slug, owner } = (await request.json().catch(() => ({}))) as { slug?: string; owner?: string };
  const rejected = rejectUnlessDemo(request, slug, 'cashier-issue', 30);
  if (rejected) return rejected;
  if (!owner) return failure('INVALID_REQUEST');

  try {
    return json({ tokenId: await issuePass(slug as string, owner) });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
