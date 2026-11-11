# DEMO: Seed data and demo script (draft)

## Requirements
- **DEMO-001** `scripts/seed` MUST create program `cafe-esquina` ("Corner Café", MCC 5814): 5% cashback, tiers Bronze(0)/Silver(3)/Gold(6) with perks, royalty 5%, expiry 90 days, daily cap 100 tUSDC per location, location "Downtown", the demo cashier, and a pool of 50 tUSDC. A 5-minute expiry MAY be set with `set_expiry_seconds` only while recording the video.
- **DEMO-002** Seed MUST create cashier `demo-cashier` and two customers (Maria, Juan) with passes and some history.
- **DEMO-003** The landing page MUST offer "Try as merchant / cashier / customer" using demo accounts so judges need no wallet.
- **DEMO-004** `scripts/smoke` MUST run the full flow end-to-end on testnet (create → fund → issue → 3 purchases → tier up → redeem → list → buy → sweep) and exit non-zero on any failure.

- **DEMO-005** On the demo program only, the customer code screen MUST offer a "Simulate a purchase" button that calls `POST /api/demo/purchase`, which records the purchase with the demo cashier key. It is labeled as a demo and rate-limited.

## Video script (90 s)
1. 0-15 s: Crumpled paper stamp card: "This is worth nothing."
2. 15-30 s: Merchant creates "Corner Café" in 3 clicks, funds 50 test USDC.
3. 30-50 s: Maria taps "Get my card": no wallet, no gas. Shows QR.
4. 50-65 s: Three purchases: balance rises live, tier jumps to Silver, artwork changes.
5. 65-80 s: Maria lists the card; Juan buys it; balance and tier move; café earns 5%.
6. 80-90 s: Explorer link: "This card has its own account and its own money."
