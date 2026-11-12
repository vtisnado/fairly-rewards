import type { APIRoute } from 'astro';
import { nearToYocto } from 'near-api-js';
import { IMPLICIT_ACCOUNT, accountExists } from '../../../lib/server/accounts';
import { clientKey, isRateLimited } from '../../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../../lib/server/responses';
import { merchantStartNear, sponsorAccount } from '../../../lib/server/signers';

export const POST: APIRoute = async ({ request }) => {
  const { accountId } = (await request.json().catch(() => ({}))) as { accountId?: string };
  if (!accountId || !IMPLICIT_ACCOUNT.test(accountId)) {
    return failure('INVALID_REQUEST');
  }
  try {
    if (await accountExists(accountId)) {
      return json({ accountId, funded: false });
    }
    if (isRateLimited(clientKey(request, 'merchant-account'), 3, 60 * 60 * 1000)) {
      return failure('RATE_LIMITED', 429);
    }
    await sponsorAccount().transfer({ receiverId: accountId, amount: nearToYocto(merchantStartNear) });
    return json({ accountId, funded: true });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
