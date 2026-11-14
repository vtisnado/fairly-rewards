import type { APIRoute } from 'astro';
import { nearToYocto } from 'near-api-js';
import { nearAmount } from '../../lib/near-amount';
import { getPassesByOwner } from '../../lib/near';
import { IMPLICIT_ACCOUNT, accountExists } from '../../lib/server/accounts';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../lib/server/responses';
import { issuePass } from '../../lib/server/cashier';
import { demoProgramSlug, sponsorAccount, sponsorAmountNear } from '../../lib/server/signers';

const JOIN_ATTEMPTS = 3;
const JOIN_RETRY_DELAY_MS = 1000;

async function joinOnce(slug: string, accountId: string): Promise<Response> {
  const funded = !(await accountExists(accountId));
  if (funded) {
    await sponsorAccount().transfer({ receiverId: accountId, amount: nearToYocto(nearAmount(sponsorAmountNear)) });
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
}

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'join'), 5, 60 * 60 * 1000)) {
    return failure('RATE_LIMITED', 429);
  }

  const { slug, accountId } = (await request.json().catch(() => ({}))) as { slug?: string; accountId?: string };
  if (!slug || !accountId || !IMPLICIT_ACCOUNT.test(accountId)) {
    return failure('INVALID_REQUEST');
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= JOIN_ATTEMPTS; attempt++) {
    try {
      return await joinOnce(slug, accountId);
    } catch (error) {
      lastError = error;
      if (contractErrorCode(error) !== 'CHAIN_ERROR') break;
      await new Promise((resolve) => setTimeout(resolve, JOIN_RETRY_DELAY_MS * attempt));
    }
  }
  return failure(contractErrorCode(lastError), 502);
};
