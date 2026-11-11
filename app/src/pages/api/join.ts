import type { APIRoute } from 'astro';
import { nearToYocto } from 'near-api-js';
import { getPassesByOwner, provider } from '../../lib/near';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../lib/server/responses';
import { issuePass } from '../../lib/server/cashier';
import { demoProgramSlug, sponsorAccount, sponsorAmountNear } from '../../lib/server/signers';

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

    const tokenId = await issuePass(slug, accountId);
    return json({ accountId, funded, tokenId });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
