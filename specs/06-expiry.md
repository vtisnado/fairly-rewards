# EXP: Inactivity expiry (draft)

## Requirements
- **EXP-000** Merchants choose expiry from: 90 days, 180 days, 1 year, or never.
- **EXP-001** A pass is expired when `now - last_activity_ns > expiry_days` (D-014).
- **EXP-002** Anyone MUST be able to call `sweep_expired(token_id)`; it MUST move the full balance back to the program pool, set balance to 0, and emit an `expired` event. The pass, tier and history remain.
- **EXP-003** Sweeping a non-expired pass MUST fail with `NOT_EXPIRED`.
- **EXP-004** `get_pass` MUST return `expires_at_ns` so the UI can warn the owner.
- **EXP-005** For the demo, `expiry_days` MAY be overridden by a program-level `expiry_seconds` field, allowed only when the contract is built with the `demo` feature.

## Acceptance
- Given expiry 90 days and last activity 91 days ago, when anyone sweeps, then balance returns to the pool.
- Given last activity 10 days ago, then sweep fails with `NOT_EXPIRED`.
