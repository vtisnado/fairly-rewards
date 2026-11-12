import type { APIRoute } from 'astro';
import { deserialize } from 'borsh';
import { SCHEMA, base64Decode } from 'near-api-js';
import type { SignedDelegate } from 'near-api-js';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../lib/server/responses';
import { assertSucceeded, contractResult, recordEvents, type ExecutionOutcome } from '../../lib/server/events';
import { isAllowedDelegate } from '../../lib/server/relay-policy';
import { sponsorAccount } from '../../lib/server/signers';

export const POST: APIRoute = async ({ request }) => {
  if (isRateLimited(clientKey(request, 'relay'), 60, 60 * 60 * 1000)) {
    return failure('RATE_LIMITED', 429);
  }

  const { signedDelegate } = (await request.json().catch(() => ({}))) as { signedDelegate?: string };
  if (!signedDelegate) {
    return failure('INVALID_REQUEST');
  }

  let delegate: SignedDelegate;
  try {
    delegate = deserialize(SCHEMA.SignedDelegate, base64Decode(signedDelegate)) as SignedDelegate;
  } catch {
    return failure('INVALID_DELEGATE');
  }
  if (!isAllowedDelegate(delegate)) {
    return failure('DELEGATE_NOT_ALLOWED', 403);
  }

  try {
    const outcome = (await sponsorAccount().relayMetaTransaction(delegate)) as unknown as ExecutionOutcome;
    await recordEvents(outcome, delegate.delegateAction.senderId);
    assertSucceeded(outcome);
    return json({ result: contractResult(outcome) });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
