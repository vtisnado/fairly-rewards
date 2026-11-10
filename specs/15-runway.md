# RUN: Rewards money running low (draft)

Goal: customers never see an error because a business forgot to top up, and the business is warned early and loudly.

- **RUN-001** The contract MUST keep `pending` cashback per pass when the pool cannot cover a purchase (BUY-004).
- **RUN-002** When the pool is funded, pending cashback MUST be settled first, oldest first, in batches callable by anyone (`settle_pending(slug, limit)`).
- **RUN-003** Customer screens MUST show pending cashback as "Cashback pending" with the amount, never as an error.
- **RUN-004** Runway = pool balance / average daily cashback of the last 14 days. Levels: healthy (> 14 days), watch (8 to 14), low (2 to 7), critical (<= 2), empty (0).
- **RUN-005** Low, critical and empty MUST show a red banner on every backoffice screen with a Top up button, plus a red dot on the Rewards money menu item.
- **RUN-006** Low MUST also send email and push to owner and managers; critical MUST show a warning on counter devices on each purchase.
- **RUN-007** Email-only alerting is not acceptable (owner request, 2026-11-11).
