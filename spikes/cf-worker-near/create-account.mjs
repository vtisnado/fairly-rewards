import { KeyPair } from 'near-api-js';
import { writeFileSync } from 'node:fs';
const id = `fairly-spike-${Date.now().toString(36)}.testnet`;
const kp = KeyPair.fromRandom('ed25519');
const res = await fetch('https://helper.nearprotocol.com/account', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.getPublicKey().toString() }),
});
console.log('faucet status', res.status, (await res.text()).slice(0, 200));
if (res.ok) {
  writeFileSync('.dev.vars', `SPIKE_ACCOUNT_ID=${id}\nSPIKE_PRIVATE_KEY=${kp.toString()}\n`);
  console.log('account', id);
}
