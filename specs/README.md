# Specs

Spec-driven development (decision D-004). Behavior is defined here first; code and tests follow.

## Conventions
- Requirement ids: `<AREA>-<NNN>` (e.g. `PASS-003`). Ids are never reused.
- Keywords: **MUST**, **SHOULD**, **MAY** (RFC 2119).
- Acceptance criteria use Given / When / Then and map to tests named after the id (e.g. `test_pass_003_...`).
- Amounts: stablecoin amounts are integers in tUSDC base units (6 decimals). Purchase amounts are integers in USD cents.
- Status per file: `draft` → `approved` → `implemented` → `verified`.

## Index
| File | Area | Status |
|---|---|---|
| [00-glossary.md](00-glossary.md) | Terms | approved |
| [01-program.md](01-program.md) | PROG: merchant programs and pool | implemented |
| [02-pass.md](02-pass.md) | PASS: NFT pass, metadata, tiers | implemented |
| [03-purchase.md](03-purchase.md) | BUY: recording purchases, cashback, cashier limits | implemented |
| [04-redeem.md](04-redeem.md) | RDM: redeeming balance and perks | implemented |
| [05-resale.md](05-resale.md) | SALE: listing, buying, royalties | implemented |
| [06-expiry.md](06-expiry.md) | EXP: inactivity expiry | implemented |
| [07-token.md](07-token.md) | TOK: tUSDC test stablecoin | implemented |
| [08-onboarding.md](08-onboarding.md) | ONB: customer accounts and sponsor | draft |
| [09-ui.md](09-ui.md) | UI: merchant, cashier, customer, market screens | draft |
| [10-demo.md](10-demo.md) | DEMO: seed data and demo script | draft |
| [11-nonfunctional.md](11-nonfunctional.md) | NFR: security, events, performance, docs | draft |
| [12-boosts.md](12-boosts.md) | BST: seasonal boosts | draft |
| [13-locations.md](13-locations.md) | LOC: locations and devices | draft |
| [14-analytics.md](14-analytics.md) | ANA: business analytics | draft |
| [15-runway.md](15-runway.md) | RUN: low and empty rewards money | draft |
| [16-events.md](16-events.md) | EVT: event history and real-time updates | draft |
