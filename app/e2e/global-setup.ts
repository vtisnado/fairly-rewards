const MIN_SPONSOR_NEAR = BigInt(process.env.E2E_MIN_SPONSOR_NEAR ?? '6');
const MIN_PROGRAM_STORAGE_YOCTO = 10n ** 23n;
const YOCTO_PER_NEAR = 10n ** 24n;
const rpc = process.env.PUBLIC_NEAR_RPC_URL ?? 'https://test.rpc.fastnear.com';

async function query(params: Record<string, unknown>): Promise<{ amount?: string; result?: number[] }> {
  const response = await fetch(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'preflight', method: 'query', params: { finality: 'final', ...params } }),
  });
  const body = (await response.json()) as { result?: { amount?: string; result?: number[] } };
  if (!body.result) throw new Error(`RPC query ${String(params.request_type)} failed`);
  return body.result;
}

export default async function globalSetup() {
  const sponsor = process.env.SPONSOR_ACCOUNT_ID;
  const contract = process.env.PUBLIC_FAIRLY_CONTRACT;
  const slug = process.env.PUBLIC_DEMO_PROGRAM_SLUG ?? 'cafe-esquina';
  if (!sponsor || !contract) throw new Error('SPONSOR_ACCOUNT_ID and PUBLIC_FAIRLY_CONTRACT are required');

  const account = await query({ request_type: 'view_account', account_id: sponsor });
  if (BigInt(account.amount ?? '0') < MIN_SPONSOR_NEAR * YOCTO_PER_NEAR) {
    throw new Error(`Sponsor ${sponsor} holds less than ${MIN_SPONSOR_NEAR} NEAR; fund it before running the E2E suite`);
  }

  const view = await query({
    request_type: 'call_function',
    account_id: contract,
    method_name: 'get_program',
    args_base64: Buffer.from(JSON.stringify({ slug })).toString('base64'),
  });
  const program = JSON.parse(Buffer.from(view.result ?? []).toString()) as { storage_balance: string } | null;
  if (!program || BigInt(program.storage_balance) < MIN_PROGRAM_STORAGE_YOCTO) {
    throw new Error(`The demo program ${slug} is out of storage balance; run deposit_storage as its owner before the E2E suite`);
  }
}
