import { base64Decode } from 'near-api-js';
import { fairlyContract } from '../near';
import { insertRows } from './supabase';

const EVENT_PREFIX = 'EVENT_JSON:';

interface ReceiptOutcome {
  outcome: { executor_id: string; logs: string[]; status: { SuccessValue?: string; Failure?: unknown } };
}

export interface ExecutionOutcome {
  transaction: { hash: string; signer_id: string };
  receipts_outcome?: ReceiptOutcome[];
}

interface ContractEvent {
  standard: string;
  event: string;
  data: Record<string, unknown>[];
}

interface EventRow {
  tx_hash: string;
  log_index: number;
  event: string;
  program_slug: string | null;
  token_id: string | null;
  account_id: string | null;
  signer_id: string;
  data: Record<string, unknown>;
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);

function toRow(txHash: string, signerId: string, logIndex: number, event: ContractEvent): EventRow {
  const data = event.data[0] ?? {};
  const tokenId = text(data.token_id);
  return {
    tx_hash: txHash,
    log_index: logIndex,
    event: event.event,
    program_slug: text(data.slug) ?? tokenId?.split(':')[0] ?? null,
    token_id: tokenId,
    account_id: text(data.owner) ?? text(data.buyer) ?? text(data.account_id) ?? null,
    signer_id: signerId,
    data,
  };
}

export function contractEvents(outcome: ExecutionOutcome, signerId = outcome.transaction.signer_id): EventRow[] {
  const logs = (outcome.receipts_outcome ?? [])
    .filter((receipt) => receipt.outcome.executor_id === fairlyContract)
    .flatMap((receipt) => receipt.outcome.logs);
  return logs.flatMap((log, index) => {
    if (!log.startsWith(EVENT_PREFIX)) return [];
    const event = JSON.parse(log.slice(EVENT_PREFIX.length)) as ContractEvent;
    return event.standard === 'fairly' ? [toRow(outcome.transaction.hash, signerId, index, event)] : [];
  });
}

export function contractResult<T>(outcome: ExecutionOutcome): T | null {
  const value = outcome.receipts_outcome?.find(
    (receipt) => receipt.outcome.executor_id === fairlyContract && receipt.outcome.status.SuccessValue,
  )?.outcome.status.SuccessValue;
  return value ? (JSON.parse(new TextDecoder().decode(base64Decode(value))) as T) : null;
}

export function assertSucceeded(outcome: ExecutionOutcome): void {
  const failure = outcome.receipts_outcome?.find((receipt) => receipt.outcome.status.Failure)?.outcome.status.Failure;
  if (failure) {
    throw new Error(JSON.stringify(failure));
  }
}

export async function recordEvents(outcome: ExecutionOutcome, signerId?: string): Promise<void> {
  const rows = contractEvents(outcome, signerId);
  if (rows.length > 0) {
    await insertRows('events', rows, 'tx_hash,log_index');
  }
}
