# PASS: NFT pass, metadata, tiers (implemented)

## Data
`Pass { token_id, program_slug, owner, balance, purchase_count, total_spent_cents, tier_index, last_activity_ns, created_ns }`

## Requirements
- **PASS-001** A pass MUST be a NEP-171 token implementing NEP-177 metadata and NEP-181 enumeration.
- **PASS-002** `issue_pass(slug, owner)` MUST be callable only by the program owner or one of its cashiers, and MUST mint a new pass to `owner` with zero balance and tier index 0.
- **PASS-003** An account MUST hold at most one pass per program. A second `issue_pass` for the same owner and program MUST fail with `ALREADY_HAS_PASS`.
- **PASS-004** `token_id` MUST be `<slug>:<code>`, where `code` is 6 characters of Crockford Base32 (`0-9`, `A-Z` without `I L O U`) drawn from the block random seed, unique within the program (e.g. `cafe-esquina:K7Q4MZ`). Codes are not sequential. UIs display them as `K7Q-4MZ`.
- **PASS-005** Metadata `title` MUST be `<program name>: <tier name>`; `media` MUST be `<APP_URL>/api/art/<slug>/<tier_index>.svg`; `extra` MUST be JSON with `tier`, `balance`, `purchase_count`.
- **PASS-005a** The contract account MUST be able to call `set_art_base_url(art_base_url)` to change the base URL used for `media`; any other caller MUST fail with `NOT_OWNER`. The value MUST start with `https://` or be `http://localhost` (optionally followed by a port or path), contain no whitespace and be at most 200 bytes, otherwise it MUST fail with `INVALID_URL`. The method MUST emit an `art_base_url_updated` event with `previous` and `art_base_url`. Existing passes MUST report the new `media` immediately.
- **PASS-006** The tier MUST be recomputed after every purchase as the highest tier whose `min_purchases <= purchase_count`. Tiers MUST NOT go down.
- **PASS-007** When the tier changes, the contract MUST emit a `tier_up` event.
- **PASS-008** NEP-171 transfer of a pass MUST move its balance, tier and history with it (balance belongs to the pass, not the account).
- **PASS-009** NEP-199 `nft_payout` MUST return the program's `royalty_bps` for the merchant and the rest for the owner.
- **PASS-010** `get_pass(token_id)` and `get_passes_by_owner(account)` MUST be public views returning the data above plus `tier_name`, `next_tier`, `purchases_to_next_tier`, `expires_at_ns`.
- **PASS-011** (D-009 option B, conditional) If pass vaults are adopted, each pass MUST have a sub-account whose only authority is `fairly`, and `get_pass` MUST return its `vault_account`.

## Acceptance
- Given the contract account calls `set_art_base_url("https://fairly.pages.dev")`, then existing passes return `media` under that URL and an `art_base_url_updated` event is logged; given a merchant calls it, then it fails with `NOT_OWNER`; given `http://fairly.example` or `http://localhost.evil.com`, then it fails with `INVALID_URL`.
- Given cashier Carol of `cafe-esquina`, when she issues a pass to `maria`, then `nft_tokens_for_owner(maria)` returns `cafe-esquina:1` with tier Bronze.
- Given Maria already has a pass, when Carol issues another, then it fails with `ALREADY_HAS_PASS`.
- Given tiers Bronze(0), Silver(3), Gold(10), when the 3rd purchase is recorded, then tier is Silver and a `tier_up` event is emitted.
- Given Maria's pass has 1.20 tUSDC, when she transfers it to Juan, then `get_pass` shows owner Juan and balance 1.20 tUSDC.
