# RDM: Redeeming balance and perks (draft)

## Requirements
- **RDM-001** The pass owner MUST be able to call `redeem(token_id, amount)` to spend balance at the merchant. Amount MUST be > 0 and <= balance.
- **RDM-002** Redeemed tUSDC MUST be transferred from `fairly` to the program owner (the merchant receives the discount value back as settlement of the purchase it honors).
- **RDM-003** Each redemption MUST emit a `redeem` event and return a short redemption code (`<token_id>#<n>`) the cashier UI can display to confirm.
- **RDM-004** The owner MUST be able to call `claim_perk(token_id, tier_index)` once per tier reached. A claimed perk MUST NOT be claimable again by any later owner.
- **RDM-005** Redeem and claim MUST update `last_activity_ns`.
- **RDM-006** A pass listed for sale MUST NOT be redeemable until the listing is cancelled.

## Acceptance
- Given a pass with 1.00 tUSDC, when the owner redeems 0.60, then balance is 0.40 and the merchant account received 0.60 tUSDC.
- Given balance 0.40, when the owner redeems 0.50, then it fails with `INSUFFICIENT_BALANCE`.
- Given Silver perk was claimed by Maria, when Juan buys the pass and claims Silver, then it fails with `PERK_CLAIMED`.
