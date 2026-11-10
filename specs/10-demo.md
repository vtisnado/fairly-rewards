# DEMO: Seed data and demo script (draft)

## Requirements
- **DEMO-001** `scripts/seed` MUST create program `cafe-esquina` ("Corner Café"): 5% cashback, tiers Bronze(0)/Silver(3)/Gold(6) with perks, royalty 5%, pool 50 tUSDC, demo expiry 5 minutes.
- **DEMO-002** Seed MUST create cashier `demo-cashier` and two customers (Maria, Juan) with passes and some history.
- **DEMO-003** The landing page MUST offer "Try as merchant / cashier / customer" using demo accounts so judges need no wallet.
- **DEMO-004** `scripts/smoke` MUST run the full flow end-to-end on testnet (create → fund → issue → 3 purchases → tier up → redeem → list → buy → sweep) and exit non-zero on any failure.

## Video script (90 s)
1. 0-15 s: Crumpled paper stamp card: "This is worth nothing."
2. 15-30 s: Merchant creates "Corner Café" in 3 clicks, funds 50 test USDC.
3. 30-50 s: Maria taps "Get my card": no wallet, no gas. Shows QR.
4. 50-65 s: Three purchases: balance rises live, tier jumps to Silver, artwork changes.
5. 65-80 s: Maria lists the card; Juan buys it; balance and tier move; café earns 5%.
6. 80-90 s: Explorer link: "This card has its own account and its own money."
