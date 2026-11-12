import { fairlyContract, getProgram } from '../near';
import type { PurchaseResult } from '../types';
import { assertSucceeded, contractResult, recordEvents, type ExecutionOutcome } from './events';
import { insertRows, selectRows } from './supabase';
import { demoCashierAccount } from './signers';

interface RedemptionEvent {
  token_id: string;
  event: 'redeem' | 'perk_claimed';
  data: { code: string; amount?: string; perk?: string };
}

export interface HonoredCode {
  code: string;
  kind: 'redeem' | 'perk';
  amount: string | null;
  perk: string | null;
  token_id: string;
}

async function callAsCashier<T>(methodName: string, args: Record<string, unknown>): Promise<T | null> {
  const outcome = (await demoCashierAccount().callFunctionRaw({
    contractId: fairlyContract,
    methodName,
    args,
  })) as unknown as ExecutionOutcome;
  await recordEvents(outcome);
  assertSucceeded(outcome);
  return contractResult<T>(outcome);
}

export async function cashierLocation(slug: string): Promise<string | null> {
  const program = await getProgram(slug);
  const accountId = demoCashierAccount().accountId;
  return program?.cashiers.find((cashier) => cashier.account_id === accountId)?.location_id ?? null;
}

export const issuePass = (slug: string, owner: string) => callAsCashier<string>('issue_pass', { slug, owner });

export async function recordPurchase(slug: string, tokenId: string, amountCents: number, category: string | null) {
  const location = await cashierLocation(slug);
  if (!location) {
    throw new Error('NOT_CASHIER');
  }
  return callAsCashier<PurchaseResult>('record_purchase', {
    token_id: tokenId,
    amount_cents: amountCents,
    location_id: location,
    category,
  });
}

export function toContractCode(slug: string, displayCode: string): string | null {
  const match = displayCode.toUpperCase().replace(/[^0-9A-Z-]/g, '').match(/^([0-9A-Z]{3})-?([0-9A-Z]{3})-(\d+)$/);
  return match ? `${slug}:${match[1]}${match[2]}#${match[3]}` : null;
}

export async function honorCode(slug: string, displayCode: string, honoredBy = demoCashierAccount().accountId): Promise<HonoredCode> {
  const code = toContractCode(slug, displayCode);
  if (!code) {
    throw new Error('INVALID_CODE');
  }
  const [redemption] = await selectRows<RedemptionEvent>(
    'events',
    `select=token_id,event,data&program_slug=eq.${encodeURIComponent(slug)}&event=in.(redeem,perk_claimed)&data->>code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  if (!redemption) {
    throw new Error('CODE_NOT_FOUND');
  }
  const honored: HonoredCode = {
    code,
    kind: redemption.event === 'redeem' ? 'redeem' : 'perk',
    amount: redemption.data.amount ?? null,
    perk: redemption.data.perk ?? null,
    token_id: redemption.token_id,
  };
  await insertRows('honored_codes', [
    { ...honored, program_slug: slug, honored_by: honoredBy },
  ]);
  return honored;
}
