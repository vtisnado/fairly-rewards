# Spike: near-api-js on Cloudflare Workers (and Deno)

Date: 2026-11-10 · Code: `spikes/cf-worker-near/` · Result: **pass**

## Question
Can the API run on Cloudflare Workers with the official NEAR JavaScript library, or do we need Supabase Edge Functions (Deno)?

## Research
- No official NEAR or Cloudflare document states support either way.
- `near-api-js` 7.4.0 (2026-10-23) is one tree-shakeable package. Runtime dependencies are pure JavaScript: `@noble/curves`, `@noble/hashes`, `@scure/base`, `borsh`. No native Node modules.
- Workers can enable Node APIs with `nodejs_compat`; we tested without it first.

## Setup
- Docker only: `node:22-bookworm` + pnpm 12 (corepack), `wrangler dev` 4.159.0 running the real `workerd` runtime.
- pnpm policy: `minimumReleaseAge: 1440` (rejected wrangler 4.160.0, published < 24 h), build scripts allowed only for `esbuild` and `workerd`.
- Funded testnet account created through the faucet helper used by near-cli-rs. Key in `.dev.vars` (git-ignored).
- `compatibility_flags = []` (no `nodejs_compat`).

## Results (testnet, inside workerd)
| Test | What it proves | Result |
|---|---|---|
| view | RPC reads, contract view call (`wrap.testnet` `ft_metadata`) | pass |
| keys | ed25519 key generation, sign/verify, implicit account id (ONB-001) | pass |
| send | Sign and send a real transaction (sponsor, ONB-003) | pass, FINAL |
| fckey | Add a function-call key limited to one contract and methods (cashier device, D-010) | pass |
| meta | Create a sub-account, sign a delegate action as the user, relay it as sponsor (NEP-366) | pass, FINAL |

- Both transactions re-checked on a second RPC (`rpc.testnet.near.org`): `SuccessValue`, `FINAL`.
- Bundle: 418.6 KiB, **93 KiB gzip** (free plan limit is 3 MB).
- Same checks in Deno (`npm:near-api-js@7.4.0`, Supabase Edge Function runtime): pass.

## Findings
- The library also exposes `deployGlobalContract` / `useGlobalContract`, relevant to D-009 (per-card sub-accounts). Still to test on testnet in T1.2.
- Containers need CA certificates (`-slim` images fail TLS in workerd); use the full `node:22-bookworm` image.

## Decision
API on Cloudflare Workers without `nodejs_compat` (D-030). Supabase Edge Functions remain a working fallback.
