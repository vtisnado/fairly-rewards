import { Account, JsonRpcProvider, KeyPair, nearToYocto } from 'npm:near-api-js@7.4.0';
const vars = Object.fromEntries(Deno.readTextFileSync('/app/.dev.vars').trim().split('\n').map(l => l.split('=')));
const provider = new JsonRpcProvider({ url: 'https://test.rpc.fastnear.com' });
const acc = await provider.viewAccount({ accountId: vars.SPIKE_ACCOUNT_ID });
const kp = KeyPair.fromRandom('ed25519');
const me = new Account(vars.SPIKE_ACCOUNT_ID, provider, vars.SPIKE_PRIVATE_KEY);
const r = await me.transfer({ receiverId: vars.SPIKE_ACCOUNT_ID, amount: nearToYocto('0.001') });
console.log(JSON.stringify({ view: !!acc.amount, keygen: !!kp.getPublicKey(), send: Object.keys(r.status)[0], tx: r.transaction.hash }));
