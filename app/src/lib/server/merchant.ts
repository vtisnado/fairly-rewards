import { fairlyContract, tusdcContract } from '../near';
import { assertSucceeded, recordEvents, type ExecutionOutcome } from './events';
import { demoMerchantAccount } from './signers';

const TRANSFER_GAS = 100_000_000_000_000n;
const ONE_YOCTO = 1n;

async function callAsMerchant(contractId: string, methodName: string, args: Record<string, unknown>, deposit = 0n, gas?: bigint) {
  const outcome = (await demoMerchantAccount().callFunctionRaw({
    contractId,
    methodName,
    args,
    deposit,
    gas,
  })) as unknown as ExecutionOutcome;
  await recordEvents(outcome);
  assertSucceeded(outcome);
}

export async function fundDemoPool(slug: string, amount: string): Promise<void> {
  await callAsMerchant(tusdcContract, 'faucet', { amount });
  await callAsMerchant(
    tusdcContract,
    'ft_transfer_call',
    { receiver_id: fairlyContract, amount, msg: JSON.stringify({ fund: slug }) },
    ONE_YOCTO,
    TRANSFER_GAS,
  );
}

export const DEMO_METHODS = ['add_location', 'update_location', 'add_boost', 'set_boost_enabled', 'remove_boost'] as const;
export type DemoMethod = (typeof DEMO_METHODS)[number];

export const callDemoProgram = (method: DemoMethod, args: Record<string, unknown>) => callAsMerchant(fairlyContract, method, args);
