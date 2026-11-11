import type { APIRoute } from 'astro';
import { fairlyContract, getPass, getProgram } from '../../../lib/near';
import { clientKey, isRateLimited } from '../../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';
import { assertSucceeded, contractResult, recordEvents, type ExecutionOutcome } from '../../../lib/server/events';
import { demoCashierAccount, demoProgramSlug } from '../../../lib/server/signers';
import type { PurchaseResult } from '../../../lib/types';

const DEMO_CATEGORIES = ['Coffee', 'Pastry', 'Breakfast', 'Lunch'];

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'demo-purchase'), 30, 60 * 60 * 1000)) {
    return failure('RATE_LIMITED', 429);
  }

  const { tokenId, amountCents } = (await request.json().catch(() => ({}))) as {
    tokenId?: string;
    amountCents?: number;
  };
  if (!tokenId || !Number.isInteger(amountCents) || !amountCents || amountCents < 100 || amountCents > 5_000) {
    return failure('INVALID_REQUEST');
  }

  const pass = await getPass(tokenId);
  if (!pass || pass.program_slug !== demoProgramSlug) {
    return failure('NOT_DEMO_PROGRAM', 403);
  }

  const cashier = demoCashierAccount();
  const program = await getProgram(demoProgramSlug);
  const location = program?.cashiers.find((entry) => entry.account_id === cashier.accountId)?.location_id;
  if (!location) {
    return failure('NOT_CASHIER', 500);
  }

  try {
    const outcome = (await cashier.callFunctionRaw({
      contractId: fairlyContract,
      methodName: 'record_purchase',
      args: {
        token_id: tokenId,
        amount_cents: amountCents,
        location_id: location,
        category: DEMO_CATEGORIES[Math.floor(Math.random() * DEMO_CATEGORIES.length)],
      },
    })) as unknown as ExecutionOutcome;
    await recordEvents(outcome);
    assertSucceeded(outcome);
    return json(contractResult<PurchaseResult>(outcome));
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
