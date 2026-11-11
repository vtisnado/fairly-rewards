# PROG: Merchant programs and pool (implemented)

## Data
`Program { slug, owner, name, brand_color, logo_url, cashback_bps, tiers[], royalty_bps, expiry_days (none = never), daily_cap (per location), locations[], cashiers[], boosts[], pool_balance, pending_total, storage_balance, paused }`
`Tier { name, min_purchases, perk (optional text) }`

## Requirements
- **PROG-001** Any account MUST be able to create a program by calling `create_program` with an unused `slug` (3-32 chars, `[a-z0-9-]`) and attaching enough NEAR for storage. NEAR attached beyond the program's own storage becomes the program's storage balance, which pays storage for passes and purchases recorded by cashiers (their function-call keys cannot attach deposits).
- **PROG-002** `cashback_bps` MUST be between 1 and 2500 (0.01%-25%). `royalty_bps` MUST be between 0 and 2500. `expiry_days` MUST be between 1 and 365.
- **PROG-003** `tiers` MUST contain 1-5 entries, the first with `min_purchases = 0`, strictly increasing `min_purchases`.
- **PROG-004** The program owner MUST be able to fund the pool by sending tUSDC with `ft_transfer_call` and `msg = {"fund": "<slug>"}`. Any account MAY fund any program.
- **PROG-005** Funding with any token other than the configured tUSDC MUST be refunded in full.
- **PROG-006** The owner MUST be able to withdraw unused pool funds with `withdraw_pool(slug, amount)`. Others MUST NOT.
- **PROG-007** The owner MUST be able to add and remove cashier accounts.
- **PROG-008** The owner MUST be able to pause and unpause the program. While paused, `issue_pass` and `record_purchase` MUST fail; redeem, resale and expiry MUST still work.
- **PROG-009** The owner MAY update name, colors, perks and `cashback_bps`; changes MUST NOT alter balances already credited.
- **PROG-011** A program MUST store branding: `brand_color` (hex) and optional `logo_url`, used by the card artwork and customer screens.
- **PROG-012** The hackathon build MUST fund pools only with tUSDC from a NEAR testnet wallet. Card payments (fiat on-ramp) and stablecoins from other chains (NEAR Intents) are documented as production paths and shown as such in the UI.
- **PROG-013** Anyone MAY top up a program's storage balance with `deposit_storage(slug)`. When it is too low, cashier calls fail with `NO_STORAGE`.
- **PROG-014** A program MUST store its category as an ISO 18245 merchant category code `mcc` (4 digits, e.g. 5814 fast food and cafés, 5812 restaurants, 5462 bakeries, 5411 grocery, 7230 barbers). UIs show it as a label and icon, never inside the card code.
- **PROG-010** `get_program(slug)` and `get_programs_by_owner(account)` MUST be public views.

## Acceptance
- Given slug `cafe-esquina` is free, when Alice creates it with valid params, then `get_program("cafe-esquina").owner == alice`.
- Given the slug exists, when Bob creates it again, then the call fails with `SLUG_TAKEN`.
- Given Alice sends 50 tUSDC with `{"fund":"cafe-esquina"}`, then `pool_balance == 50_000_000`.
- Given Bob (not owner) calls `withdraw_pool`, then it fails with `NOT_OWNER`.
