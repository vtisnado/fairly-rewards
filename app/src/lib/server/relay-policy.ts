import type { SignedDelegate } from 'near-api-js';
import { fairlyContract, tusdcContract } from '../near';

const YOCTO_PER_NEAR = 10n ** 24n;
const ONE_YOCTO = 1n;
const MAX_GAS = 100_000_000_000_000n;
const MAX_PROGRAM_DEPOSIT = (YOCTO_PER_NEAR * 4n) / 10n;
const MAX_ACCOUNT_FUNDING = YOCTO_PER_NEAR / 10n;
const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;

const FAIRLY_METHODS: Record<string, bigint> = {
  redeem: ONE_YOCTO,
  claim_perk: 0n,
  list_pass: 0n,
  cancel_listing: 0n,
  nft_transfer: ONE_YOCTO,
  create_program: MAX_PROGRAM_DEPOSIT,
  update_program: 0n,
  set_paused: 0n,
  add_location: 0n,
  update_location: 0n,
  remove_location: 0n,
  add_manager: 0n,
  remove_manager: 0n,
  add_cashier: 0n,
  remove_cashier: 0n,
  add_boost: 0n,
  set_boost_enabled: 0n,
  remove_boost: 0n,
  withdraw_pool: ONE_YOCTO,
  issue_pass: 0n,
  record_purchase: 0n,
};

const TUSDC_METHODS: Record<string, bigint> = {
  faucet: 0n,
  ft_transfer_call: ONE_YOCTO,
};

interface DecodedAction {
  addKey?: { accessKey: { permission: { fullAccess?: unknown } } };
  functionCall?: { methodName: string; gas: bigint; deposit: bigint };
  transfer?: { deposit: bigint };
}

function allowedCall(methods: Record<string, bigint>, action: DecodedAction): boolean {
  const call = action.functionCall;
  if (!call) return false;
  const maxDeposit = methods[call.methodName];
  return maxDeposit !== undefined && BigInt(call.gas) <= MAX_GAS && BigInt(call.deposit) <= maxDeposit;
}

export function isAllowedDelegate(delegate: SignedDelegate): boolean {
  const { receiverId, senderId, actions } = delegate.delegateAction;
  const decoded = actions as unknown as DecodedAction[];
  if (decoded.length === 0) return false;
  if (receiverId === senderId) return decoded.length === 1 && !!decoded[0]!.addKey?.accessKey.permission.fullAccess;
  if (receiverId === fairlyContract) return decoded.every((action) => allowedCall(FAIRLY_METHODS, action));
  if (receiverId === tusdcContract) return decoded.every((action) => allowedCall(TUSDC_METHODS, action));
  if (IMPLICIT_ACCOUNT.test(receiverId)) {
    return decoded.length === 1 && !!decoded[0]!.transfer && BigInt(decoded[0]!.transfer.deposit) <= MAX_ACCOUNT_FUNDING;
  }
  return false;
}
