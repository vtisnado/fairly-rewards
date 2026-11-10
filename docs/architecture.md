# Architecture

```
            ┌───────────────────────── Web (Astro on Cloudflare) + API (Workers) ─────────────────────┐
            │  /merchant  dashboard     /cashier  POS scanner     /pass/<id>  customer view   │
            │  /market    resale        /api/art  SVG artwork     /api/sponsor  account fund  │
            └───────┬───────────────────────────┬─────────────────────────────┬───────────────┘
                    │ Wallet Selector           │ function-call key           │ browser key pair
                    ▼                           ▼                             ▼
 NEAR testnet ┌───────────────────────── fairly (core contract) ─────────────────────────┐
              │ programs · passes (NEP-171/177/181/199) · ledger · listings · cashiers │
              └───────────────▲─────────────────────────────────────────────────────────┘
                              │ ft_transfer_call / ft_transfer
                      ┌───────┴──────┐
                      │ tusdc NEP-141│   (mock stablecoin with faucet)
                      └──────────────┘
```

## Components
| Component | Path (planned) | Responsibility |
|---|---|---|
| `fairly` contract | `contracts/fairly` | Programs, passes, cashback ledger, tiers, redeem, resale, royalties, expiry |
| `tusdc` contract | `contracts/tusdc` | NEP-141 test stablecoin with faucet |
| Pass vault (spike) | `contracts/pass-vault` | Optional per-pass sub-account (D-009 option B) |
| Web app | `app/` | Merchant, cashier, customer and market UIs; art and sponsor routes |
| Scripts | `scripts/` | Deploy, seed demo data, end-to-end smoke test |
| Docker | `docker/`, `docker-compose.yml` | Toolchain (D-003) |

## Accounts on testnet (planned)
| Account | Role |
|---|---|
| `fairly-<suffix>.testnet` | core contract |
| `tusdc-<suffix>.testnet` | test stablecoin |
| `sponsor-<suffix>.testnet` | funds new customer accounts (key only in env vars) |
| `demo-cafe-<suffix>.testnet` | demo merchant |
| `demo-cashier-<suffix>.testnet` | demo cashier |

## Key flows
1. **Create program:** merchant → `create_program` (+ storage deposit) → `tusdc.ft_transfer_call(fairly, amount, msg={"fund":"<slug>"})`.
2. **Issue pass:** customer browser creates key pair → `/api/sponsor` funds implicit account → cashier calls `issue_pass(slug, owner)`.
3. **Purchase:** cashier → `record_purchase(token_id, amount_usd_cents)` → cashback moved pool → pass; tier recomputed.
4. **Redeem:** owner → `redeem(token_id, amount)` → balance decreases; merchant sees a redemption event to honor at the counter.
5. **Resale:** owner → `list_pass(token_id, price)`; buyer → `tusdc.ft_transfer_call(fairly, price, msg={"buy":"<token_id>"})` → royalty to merchant, rest to seller, NFT + balance to buyer.
6. **Expiry:** anyone → `sweep_expired(token_id)` once inactive > `expiry_days`.

## Events
The contract emits NEP-297 events (`fairly` standard) for every state change so the UI and judges can follow activity in an explorer.
