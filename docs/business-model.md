# Business model

Status legend: **Implemented** runs today on testnet. **Proposed** is a design that is not in the contracts or the app yet. No fee described here is charged on chain today.

## Who pays what today (implemented)
| Item | Paid by | Where |
|---|---|---|
| Gas of every customer action (redeem, claim perk, list, buy, backup key) | Fairly, through the sponsor account that relays meta transactions (D-035) | `/api/relay` |
| Gas of merchant actions done in the browser (create program, add cashier, fund pool) | Fairly (sponsor) | `/api/relay` |
| Gas of `issue_pass` and `record_purchase` | Fairly (server-held cashier key) | cashier account |
| New customer account: the NEAR sent to it, and the protocol creation charge. Once per user, not per card | Fairly (sponsor). Today 0.01 NEAR sent plus 0.007 NEAR burned (D-045) | `/api/join`, `/api/account` |
| Program storage (about 0.0082 NEAR per issued card, 0.00646 NEAR per program, small amounts per cashier or boost) | Merchant, from the storage deposit it attaches to `create_program` | `fairly` contract |
| Cashback and rewards | Merchant, from the tUSDC pool and the weekly settlement of what the pool did not cover (post-pay, D-046) | `fairly` contract |

Customers never hold NEAR for gas and pay nothing to join.

## Real per-operation costs
Measured on NEAR testnet on 2026-11-13 at a gas price of 1e8 yocto (1 Tgas = 0.0001 NEAR). Full method and 24 operation rows in [costs.md](costs.md).

| Operation | NEAR burnt | Who pays the gas |
|---|---|---|
| Create customer account (transfer to a new implicit account) | 0.0071150 | Sponsor |
| `issue_pass` (customer join) | 0.00069 to 0.00091 (use 0.0008) | Cashier key |
| `record_purchase` (cashback) | 0.00027 to 0.00029 (use 0.00028) | Cashier key |
| `redeem` (includes tUSDC payout) | 0.00076 | Sponsor |
| Market buy (includes royalty and seller payout) | 0.00176 | Sponsor |
| `create_program` (relayed) | 0.00035 | Sponsor |
| Storage per card | 0.0082 NEAR locked (820 bytes x 1e19 yocto) | Merchant deposit |

The account creation burn is not gas: NEAR charges a fixed 0.007 NEAR to create an account, burned by shrinking the gas refund ([NEAR gas docs](https://docs.near.org/protocol/transactions/gas)). Details in [costs.md](costs.md). The customer account also receives 0.01 NEAR, which stays on that account (it locks about 0.0018 to 0.0043 NEAR for the account and its keys, [D-045](decisions.md)). Both happen once per user, because one account holds every card.

## Per-user and per-card cost
One customer account holds all of that customer's cards (D-043). The account is paid once per user, not once per card.

| Item | When | Cost |
|---|---|---|
| Account creation burn (0.007 NEAR protocol charge plus transfer gas) | Once per user, on the first card in the network | 0.007115 NEAR |
| Funding sent to the account (stays on it, D-045) | Once per user | 0.01 NEAR |
| `issue_pass` gas | Every new card | 0.0008 NEAR |
| Card storage (820 bytes) | Every new card, locked from the merchant deposit | 0.0082 NEAR |

A new user costs 0.017115 NEAR once. Every further card of an existing user costs only 0.0008 NEAR of gas plus 0.0082 NEAR of storage locked from that merchant's deposit. New accounts per merchant are therefore fewer than new cards. The tables below show two cases: 0% of new card holders already have a Fairly account (a merchant alone on the network) and 50% already have one (a network scenario, an assumption and not a measurement).

## Monthly network cost per merchant size
Assumptions: about 20% of sales are redemptions; every sale writes one `record_purchase`; every new card writes one `issue_pass`; new accounts = new cards x (1 - share of existing users). Gas figures are the measured values above.

Math for the small merchant at 0%: purchases 500 x 0.00028 = 0.140; redemptions 100 x 0.00076 = 0.076; cards 150 x 0.0008 = 0.120; account creation 150 x 0.007115 = 1.067; funding 150 x 0.01 = 1.500. Network total = 2.903 NEAR. At 50% only 75 accounts are created: 0.534 and 0.750, total 1.620 NEAR. Card storage 150 x 0.0082 = 1.23 NEAR is a merchant deposit locked while the cards exist, not a network cost.

| Size | Sales | New cards | Redemptions | Existing users | New accounts | Network total (NEAR) | USD at $3.55 | USD at $10 | Card storage locked (NEAR) |
|---|---|---|---|---|---|---|---|---|---|
| Small | 500 | 150 | 100 | 0% | 150 | 2.90 | 10.31 | 29.03 | 1.23 |
| Small | 500 | 150 | 100 | 50% | 75 | 1.62 | 5.75 | 16.20 | 1.23 |
| Medium | 5,000 | 1,000 | 1,000 | 0% | 1,000 | 20.08 | 71.27 | 200.75 | 8.20 |
| Medium | 5,000 | 1,000 | 1,000 | 50% | 500 | 11.52 | 40.89 | 115.17 | 8.20 |
| Large | 50,000 | 8,000 | 10,000 | 0% | 8,000 | 164.92 | 585.47 | 1,649.20 | 65.60 |
| Large | 50,000 | 8,000 | 10,000 | 50% | 4,000 | 96.46 | 342.43 | 964.60 | 65.60 |

Account creation and funding are 83% to 88% of the network cost at 0% and 74% to 83% at 50%, so cost scales with new users far more than with sales. Funding at 0.05 NEAR (the previous value) would have been 7.5 / 50 / 400 NEAR a month at 0%, which is why it was lowered.

## Pricing model (post-pay)
Gas is priced in NEAR and the protocol has no USD oracle ([costs.md](costs.md), gas price note), so any USD price needs an external rate. Decision: [D-046](decisions.md).

1. **Start small.** A merchant opens with a small deposit (the UI suggests $20 as a minimum, configurable) instead of a large prefund. The pool is escrow for redemptions: a redeem sends tUSDC from the pool to the merchant, so it is not an expense.
2. **Cashback above the pool is Pending.** The customer's card shows it as Pending ("confirms when the shop settles"). Pending cannot be redeemed or resold until it is settled.
3. **Weekly settlement.** The merchant deposits what was generated and the pending queue becomes Available automatically, oldest first. Implemented, without fees.
4. **Fairly fee on cashback generated.** 3% up to $500 a month, 2% from $500 to $5,000, 1.5% above. Proposed.
5. **Flat fee per card issued, about $0.03.** It covers account creation and storage and is attributed to the merchant whose QR the customer joined. Proposed.
6. **Network cost is folded into fees 4 and 5** and reviewed monthly against the NEAR price (no oracle). There is no separate pass-through line. Proposed.
7. **Marketplace fee: 2.5% on resales**, charged alongside the merchant royalty. Proposed.
8. **Everything is charged in the weekly settlement and never to the customer.**
9. **No subscription now.** Paid Pro tiers (analytics, multiple locations, branding) come later. Proposed.

Customer protection, proposed and not implemented: if a program has pending older than N days (default 14), it stops crediting new cashback and the market shows a notice on its listings.

Breakage (keeping unused or expired balances as revenue) is **rejected**: it would make Fairly profit when customers lose value, which contradicts the product promise that a card holds real value the customer owns and can resell, and it creates a conflict of interest between Fairly and customers.

## Weekly settlement flow
1. Customers buy. Cashback up to the pool balance is credited as Available; the rest is credited as Pending on the card.
2. The dashboard shows "Pending to settle" with the amount and the number of cards waiting. After 7 days of pending it turns red as an overdue reminder.
3. The merchant taps "Settle now", which deposits exactly the pending total into the pool.
4. The contract settles the queue oldest first and each card's Pending becomes Available (up to 20 cards per deposit).
5. Proposed: the Fairly fee and the card fees of the week are added to the same settlement.

## Merchant monthly budget example (proposed fees)
Cashback generated is 5% of sales. Under post-pay the merchant deposits it over the month (first the opening deposit, then each weekly settlement). Fairly fee on cashback uses the tiers above; card fee is $0.03 x new cards. The test token tUSDC is treated as 1 USD.

| Size | Average ticket | Monthly sales | Cashback generated (5%) | Fee on cashback | Card fees | Fairly fees total | Merchant total |
|---|---|---|---|---|---|---|---|
| Small | $8 | $4,000 | $200 | $6.00 | $4.50 | $10.50 | $210.50 |
| Medium | $10 | $50,000 | $2,500 | $55.00 | $30.00 | $85.00 | $2,585.00 |
| Large | $12 | $600,000 | $30,000 | $480.00 | $240.00 | $720.00 | $30,720.00 |

Fee on cashback: small 3% x 200 = 6.00; medium 3% x 500 + 2% x 2,000 = 55.00; large 3% x 500 + 2% x 4,500 + 1.5% x 25,000 = 480.00. Fairly fees are 5.3% / 3.4% / 2.4% of the cashback generated.

Fairly fees against the network cost of the tables above (positive means the fees cover the network cost):

| Size | Existing users | Fees minus network at $3.55 | Fees minus network at $10 |
|---|---|---|---|
| Small | 0% | +$0.19 | -$18.53 |
| Small | 50% | +$4.75 | -$5.70 |
| Medium | 0% | +$13.73 | -$115.75 |
| Medium | 50% | +$44.11 | -$30.17 |
| Large | 0% | +$134.53 | -$929.20 |
| Large | 50% | +$377.57 | -$244.60 |

The fees cover the network cost at a NEAR price of $3.55 and do not at $10 for any size when few customers already have an account. That is why the fees are reviewed every month against the NEAR price.

## Compared with alternatives
- **Build an own loyalty app.** Published estimates for a custom loyalty app range roughly from $20,000 to $100,000, and up to $200,000 or more for enterprise builds, plus 15% to 20% of the build per year for maintenance. Sources are vendors with a commercial interest: [RaftLabs](https://www.raftlabs.com/blog/loyalty-program-development-costs), [Loyals Club](https://loyalsclub.com/en/resources/what-a-loyalty-app-costs-to-build/). A small merchant at about $210 a month would need years to reach the low end.
- **Paid social or search campaign.** No reliable survey of what small cafes spend was found. Vendor guides give planning ranges from about $300 to $600 a month to test search up to $1,000 to $4,000 a month for an independent restaurant ([FlashCrafter](https://www.flashcrafter.ai/restaurants-marketing-growth-engine/marketing), [Restroworks](https://www.restroworks.com/blog/restaurant-marketing-budget/)), and a cited 1.93% of revenue as actual restaurant ad spend, which is a secondary figure. Treat them as estimates only.
- **Typical loyalty uplift.** BCG consumer research found that nearly 40% of restaurant loyalty members visited more often and nearly 25% spent more after joining a full-fledged program (nearly 50% and nearly 30% for best-in-class programs): [BCG, Leveraging the Loyalty Margin](https://www.bcg.com/publications/2014/retail-transportation-travel-tourism-leveraging-loyalty-margin-rewards-programs-work). This is 2014 research and describes the share of members who changed behavior, not an average uplift. Other uplift numbers found online come from blogs that do not trace them to a primary source, so none are used here.

## Implemented versus proposed
| Item | Status |
|---|---|
| Sponsor pays relayed gas and customer account funding (0.01 NEAR, D-045) | Implemented |
| Merchant pays storage deposit and funds the tUSDC pool | Implemented |
| Merchant royalty on resales | Implemented |
| Post-pay: small opening deposit, cashback above the pool is Pending, weekly settlement with "Settle now" (D-046) | Implemented |
| Pending blocks selling in the UI | Implemented |
| Pending blocks selling in the contract | Proposed (TASKS B7) |
| Overdue-pending protection | Proposed (TASKS B5) |
| Fairly fee on cashback generated and flat fee per card, network cost folded in | Proposed (TASKS B3, B4, B6) |
| 2.5% marketplace fee on resales | Proposed (TASKS B2) |
| Pro tiers | Proposed, later |
