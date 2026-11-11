import type { APIRoute } from 'astro';
import { recordPurchase } from '../../../lib/server/cashier';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';

const CATEGORIES = new Set(['Coffee', 'Food', 'Bakery', 'Retail', 'Other']);

export const POST: APIRoute = async ({ request }) => {
  const { slug, tokenId, amountCents, category } = (await request.json().catch(() => ({}))) as {
    slug?: string;
    tokenId?: string;
    amountCents?: number;
    category?: string | null;
  };
  const rejected = rejectUnlessDemo(request, slug, 'cashier-purchase', 120);
  if (rejected) return rejected;
  if (!tokenId?.startsWith(`${slug}:`) || !Number.isInteger(amountCents) || !amountCents || amountCents < 1 || amountCents > 100_000) {
    return failure('INVALID_REQUEST');
  }

  try {
    const result = await recordPurchase(slug as string, tokenId, amountCents, category && CATEGORIES.has(category) ? category : null);
    return json(result);
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
