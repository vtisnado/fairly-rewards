import type { APIRoute } from 'astro';
import { nearToYocto } from 'near-api-js';
import { fairlyContract, getPassesByOwner, provider } from '../../lib/near';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../lib/server/responses';
import { assertSucceeded, contractResult, recordEvents, type ExecutionOutcome } from '../../lib/server/events';
import { demoCashierAccount, demoProgramSlug, sponsorAccount, sponsorAmountNear } from '../../lib/server/signers';

const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;

async function accountExists(accountId: string): Promise<boolean> {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'join'), 5, 60 * 60 * 1000)) {
    return failure('RATE_LIMITED', 429);
  }

  const { slug, accountId } = (await request.json().catch(() => ({}))) as { slug?: string; accountId?: string };
  if (!slug || !accountId || !IMPLICIT_ACCOUNT.test(accountId)) {
    return failure('INVALID_REQUEST');
  }

  try {
    const funded = !(await accountExists(accountId));
    if (funded) {
      await sponsorAccount().transfer({ receiverId: accountId, amount: nearToYocto(sponsorAmountNear) });
    }

    const existing = (await getPassesByOwner(accountId)).find((pass) => pass.program_slug === slug);
    if (existing) {
      return json({ accountId, funded, tokenId: existing.token_id });
    }
    if (slug !== demoProgramSlug) {
      return json({ accountId, funded, tokenId: null });
    }

    const outcome = (await demoCashierAccount().callFunctionRaw({
      contractId: fairlyContract,
      methodName: 'issue_pass',
      args: { slug, owner: accountId },
    })) as unknown as ExecutionOutcome;
    await recordEvents(outcome);
    assertSucceeded(outcome);
    const tokenId = contractResult<string>(outcome);
    return json({ accountId, funded, tokenId });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
