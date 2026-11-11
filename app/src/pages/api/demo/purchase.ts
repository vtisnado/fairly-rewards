import type { APIRoute } from 'astro';
import { recordPurchase } from '../../../lib/server/cashier';
import { rejectUnlessDemo } from '../../../lib/server/demo-guard';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';
import { demoProgramSlug } from '../../../lib/server/signers';

const DEMO_CATEGORIES = ['Coffee', 'Bakery', 'Food'];

export const POST: APIRoute = async ({ request }) => {
  const { tokenId, amountCents } = (await request.json().catch(() => ({}))) as {
    tokenId?: string;
    amountCents?: number;
  };
  const slug = tokenId?.split(':')[0];
  const rejected = rejectUnlessDemo(request, slug, 'demo-purchase', 30);
  if (rejected) return rejected;
  if (!tokenId || !Number.isInteger(amountCents) || !amountCents || amountCents < 100 || amountCents > 5_000) {
    return failure('INVALID_REQUEST');
  }

  try {
    const category = DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)];
    return json(await recordPurchase(demoProgramSlug, tokenId, amountCents, category));
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
