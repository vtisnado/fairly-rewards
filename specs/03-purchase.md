# BUY: Recording purchases and cashback (implemented)

## Requirements
- **BUY-001** `record_purchase(token_id, amount_cents)` MUST be callable only by the program owner or its cashiers.
- **BUY-002** `amount_cents` MUST be between 1 and 100_000 (max 1,000 USD per purchase).
- **BUY-003** Cashback in tUSDC base units MUST equal `amount_cents * cashback_bps`. (1 cent = 10_000 base units, so `amount_cents * 10_000 * cashback_bps / 10_000` simplifies to this; no rounding needed.)
- **BUY-004** Cashback MUST move from the program pool to the pass balance. If the pool is insufficient, the purchase MUST still be recorded (visit count, tier) and the missing cashback MUST be stored as `pending` on the pass (see RUN) and settled first-in first-out when the pool is refilled (RUN-002, PROG-018). Pending MUST NOT be redeemable: redeem and perk claims use `balance` only.
- **BUY-005** The sum of cashback issued by a program in the current UTC day MUST NOT exceed `daily_cap`; otherwise the call fails with `DAILY_CAP`.
- **BUY-006** Each purchase MUST increment `purchase_count`, add to `total_spent_cents`, update `last_activity_ns`, and recompute the tier (PASS-006).
- **BUY-007** Each purchase MUST emit a `purchase` event with token id, amount, cashback and new balance.
- **BUY-009** `record_purchase` MAY include a `category` (short string, e.g. Coffee, Food). It MUST be included in the `purchase` event and MUST NOT affect cashback.
- **BUY-010** `record_purchase` MUST include the `location_id` of the cashier device (see LOC).
- **BUY-011** Effective cashback MUST be `cashback_bps` plus the sum of active boosts at the block timestamp (see BST), capped at 2500 bps.
- **BUY-008** The cashier device SHOULD use a function-call access key limited to `issue_pass` and `record_purchase` on `fairly` (D-010). Documentation MUST show how to create it.

## Acceptance
- Given 5% cashback (500 bps) and a 5.00 USD purchase (500 cents), then cashback is 250_000 base units (0.25 tUSDC).
- Given the pool holds 0.10 tUSDC, when a purchase needs 0.25, then 0.10 is credited, 0.15 is stored as pending, and the visit counts.
- Given the pending of 0.15 above, when the merchant deposits 0.15 tUSDC, then the card balance rises by 0.15 and its pending is 0.
- Given daily cap 10 tUSDC already reached, then the next purchase fails with `DAILY_CAP`.
- Given an account that is not a cashier, when it records a purchase, then it fails with `NOT_CASHIER`.
