import type { APIRoute } from 'astro';
import { deserialize } from 'borsh';
import { SCHEMA, base64Decode } from 'near-api-js';
import type { SignedDelegate } from 'near-api-js';
import { fairlyContract } from '../../lib/near';
import { clientKey, isRateLimited } from '../../lib/server/rate-limit';
import { contractErrorCode, failure, json } from '../../lib/server/responses';
import { assertSucceeded, contractResult, recordEvents, type ExecutionOutcome } from '../../lib/server/events';
import { sponsorAccount } from '../../lib/server/signers';

const ALLOWED_METHODS = new Set(['redeem', 'claim_perk', 'list_pass', 'cancel_listing', 'nft_transfer']);
const MAX_GAS = 100_000_000_000_000n;
const MAX_DEPOSIT = 1n;

interface DecodedFunctionCall {
  methodName: string;
  gas: bigint;
  deposit: bigint;
}

function isAllowed(delegate: SignedDelegate): boolean {
  const { receiverId, actions } = delegate.delegateAction;
  if (receiverId !== fairlyContract || actions.length === 0) {
    return false;
  }
  return actions.every((action) => {
    const call = (action as unknown as { functionCall?: DecodedFunctionCall }).functionCall;
    return (
      !!call &&
      ALLOWED_METHODS.has(call.methodName) &&
      BigInt(call.gas) <= MAX_GAS &&
      BigInt(call.deposit) <= MAX_DEPOSIT
    );
  });
}

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
  if (!isAllowed(delegate)) {
    return failure('DELEGATE_NOT_ALLOWED', 403);
  }

  try {
    const outcome = (await sponsorAccount().relayMetaTransaction(delegate)) as unknown as ExecutionOutcome;
    await recordEvents(outcome);
    assertSucceeded(outcome);
    return json({ result: contractResult(outcome) });
  } catch (error) {
    return failure(contractErrorCode(error), 502);
  }
};
