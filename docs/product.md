# Product brief: Fairly

> Long form: **Fairly Rewards** (see `decisions.md`, D-001).

## One line
A loyalty card for small merchants where every card is an NFT with its own NEAR account: it holds real cashback in stablecoins, levels up, and pays the merchant a royalty when it is resold.

## Problem
- Paper stamp cards and closed loyalty apps: points are rarely redeemed, expire, and are worthless outside the store.
- Small merchants (coffee shops, barbers, gyms) cannot afford loyalty platforms or their own app.
- Customers own nothing. If they move away, their loyalty is lost.

## Users
| Role | Goal |
|---|---|
| Merchant (owner) | Launch a loyalty program in minutes, fund it, see repeat customers |
| Cashier | Record a purchase in one scan, without access to the merchant's funds |
| Customer | Get a pass with no wallet setup, see cashback grow, redeem or resell it |
| Buyer | Buy a used pass with its balance and tier |

## Core loop
1. Merchant creates a program (name, cashback %, tiers, perks, royalty %) and funds a cashback pool.
2. Customer scans a QR code at the counter and gets a pass (NFT).
3. Cashier scans the pass and records the purchase amount; cashback moves from the pool into the pass.
4. Pass levels up (Bronze → Silver → Gold); its artwork changes.
5. Customer redeems balance or unlocks perks.
6. Customer resells the pass; balance and tier move with it; merchant earns a royalty.
7. Balance unused for N days returns to the merchant pool.

## Why NEAR
- Named sub-accounts: a pass can be a readable account that holds its own balance ("NFTs as accounts").
- Function-call access keys: the cashier device can only record purchases.
- Meta transactions / sponsored accounts: customers never pay gas or see a wallet.
- Later: merchants top up the pool from any chain via NEAR Intents.

## Tracks
`nfts` (primary), `realworld` (secondary).

## Differentiation (checked against submissions on 2026-11-10)
Torch, Logen, Deed, Outlive, Incorpr build "NFT that owns an account" as a primitive with no real customer. Seats is DAO membership. No submission targets merchant loyalty.

## Business model (post-hackathon)
- 1% fee on cashback issued.
- Share of resale royalties.
- Pro plan with retention analytics.
- Later: neighborhood coalitions sharing one pass.

## Out of scope for the hackathon
Mainnet, NEAR Intents funding, external marketplaces, coalitions, fiat on/off-ramps.
