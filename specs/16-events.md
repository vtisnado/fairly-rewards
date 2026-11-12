# EVT: Event history and real-time updates (draft)

Goal: one transparent, queryable history of everything that happens to programs and cards, and instant updates on screens without polling (D-036).

- **EVT-001** Every NEP-297 event emitted by `fairly` MUST be stored in the Supabase table `events` with: `id`, `tx_hash`, `block_height`, `log_index`, `event`, `program_slug`, `token_id`, `account_id`, `signer_id` (the account that signed the transaction, used for per-device history), `data` (JSON), `created_at`. `(tx_hash, log_index)` MUST be unique so ingestion is idempotent.
- **EVT-002** Every transaction submitted or relayed by the API MUST have its `EVENT_JSON` logs parsed from the execution outcome and inserted into `events` before the API responds.
- **EVT-003** Events MUST be readable by anyone (they are public on-chain data) and writable only by the server (service role).
- **EVT-004** The `events` table MUST be published to Supabase Realtime. Customer, cashier and merchant screens MUST subscribe to the rows of their card or program and refresh from the contract when an event arrives. Interval polling of the contract MUST NOT be used.
- **EVT-005** On (re)connection, screens MUST refresh once from the contract so nothing is missed while offline, and MUST show a discreet connection state.
- **EVT-007** Honored redemption codes MUST be stored in the Supabase table `honored_codes` (`code` unique, `program_slug`, `token_id`, `amount`, `honored_by`, `honored_at`), readable by anyone, writable only by the server, and published to Realtime.
- **EVT-006** (follow-up) A block follower MUST ingest `fairly` events that did not go through the API (for example a cashier signing directly), using the same table and uniqueness rule.
