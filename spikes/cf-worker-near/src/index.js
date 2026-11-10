import { Account, JsonRpcProvider, KeyPair, KeyPairSigner, actions, keyToImplicitAddress, nearToYocto } from 'near-api-js';

const RPC = 'https://test.rpc.fastnear.com';
const json = (data, status = 200) => new Response(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2), { status, headers: { 'content-type': 'application/json' } });

async function run(name, fn) {
  const t = Date.now();
  try { return { test: name, ok: true, ms: Date.now() - t, result: await fn() }; }
  catch (e) { return { test: name, ok: false, ms: Date.now() - t, error: String(e && e.message || e).slice(0, 400) }; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const provider = new JsonRpcProvider({ url: RPC });
    const me = () => new Account(env.SPIKE_ACCOUNT_ID, provider, env.SPIKE_PRIVATE_KEY);

    const tests = {
      view: () => run('view', async () => {
        const acc = await provider.viewAccount({ accountId: env.SPIKE_ACCOUNT_ID });
        const meta = await provider.callFunction({ contractId: 'wrap.testnet', method: 'ft_metadata', args: {} });
        return { balance: acc.amount, wrapSymbol: meta.symbol };
      }),
      keys: () => run('keys', async () => {
        const kp = KeyPair.fromRandom('ed25519');
        const msg = new TextEncoder().encode('fairly');
        const sig = kp.sign(msg);
        return { implicit: keyToImplicitAddress(kp.getPublicKey()), verified: kp.verify(msg, sig.signature) };
      }),
      send: () => run('send', async () => {
        const r = await me().transfer({ receiverId: env.SPIKE_ACCOUNT_ID, amount: nearToYocto('0.001') });
        return { tx: r.transaction.hash, status: Object.keys(r.status)[0] };
      }),
      fckey: () => run('fckey', async () => {
        const kp = KeyPair.fromRandom('ed25519');
        const r = await me().addFunctionCallAccessKey({ publicKey: kp.getPublicKey(), contractId: 'wrap.testnet', methodNames: ['ft_balance_of'], allowance: nearToYocto('0.05') });
        const key = await provider.viewAccessKey({ accountId: env.SPIKE_ACCOUNT_ID, publicKey: kp.getPublicKey() });
        return { tx: r.transaction.hash, permission: key.permission };
      }),
      meta: () => run('meta', async () => {
        const userKey = KeyPair.fromRandom('ed25519');
        const prefix = 'u' + Date.now().toString(36);
        await me().createSubAccount({ accountOrPrefix: prefix, publicKey: userKey.getPublicKey(), nearToTransfer: nearToYocto('0.02') });
        const userId = `${prefix}.${env.SPIKE_ACCOUNT_ID}`;
        const user = new Account(userId, provider, new KeyPairSigner(userKey));
        const { signedDelegate } = await user.createSignedMetaTransaction({ receiverId: env.SPIKE_ACCOUNT_ID, actions: [actions.transfer(1n)] });
        const r = await me().relayMetaTransaction(signedDelegate);
        return { subAccount: userId, relayTx: r.transaction.hash, status: Object.keys(r.status)[0] };
      }),
    };

    const which = url.pathname.slice(1);
    if (which === 'all') { const out = []; for (const k of Object.keys(tests)) out.push(await tests[k]()); return json(out); }
    if (tests[which]) return json(await tests[which]());
    return json({ routes: ['/all', ...Object.keys(tests).map(k => '/' + k)] });
  },
};
