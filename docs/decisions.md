# Decision log

Format: each decision has an id, status, context, decision and consequences.
Status values: `accepted`, `proposed` (needs human or spike), `superseded`.
Never edit an accepted decision in place; add a new one that supersedes it.

---

## D-001 Name: accepted
- **Decision:** product name is **Fairly**, long form **Fairly Rewards**. Repository `fairly-rewards`. Core contract `fairly`.

## D-002 Language: accepted
- **Decision:** all repository content (code, docs, specs, UI, README) is in English.
- **Consequences:** chat with the human may be Spanish; files are English.

## D-003 Docker-only toolchain: accepted
- **Context:** nothing may be installed on the host machine.
- **Decision:** every tool (Rust, cargo-near, near-cli-rs, Node, pnpm) runs inside Docker via `docker compose`. The host needs only Docker and git.
- **Consequences:** a `dev` container with mounted source; all commands in docs are `docker compose run --rm dev <cmd>`.

## D-004 Spec-driven development: accepted
- **Decision:** behavior is defined in `specs/` before code. Each requirement has an id (e.g. `PASS-003`). Code, tests and commits reference requirement ids. A change in behavior starts with a spec change.
- **Consequences:** `TASKS.md` links tasks to spec ids; tests are named after spec ids.

## D-005 Network: testnet only: accepted
- **Context:** HACKATHON.md Q-010 allows testnet-only projects; no mainnet spend is needed.
- **Decision:** deploy everything to NEAR testnet. No mainnet deploys, no real funds.
- **Consequences:** a mock stablecoin is needed (D-008).

## D-006 Smart contract stack: accepted
- **Decision:** Rust + `near-sdk` (latest 5.x) built with `cargo-near`. Standards: NEP-171 (core), NEP-177 (metadata), NEP-178 (approvals, minimal), NEP-181 (enumeration), NEP-199 (royalties), NEP-141 for the stablecoin.
- **Consequences:** verify exact crate versions against docs.near.org at implementation time (Phase 1, task T1.1).

## D-007 One core contract, programs as records: accepted
- **Context:** deploying one contract per merchant costs storage and time.
- **Decision:** a single `fairly` contract stores all programs, passes and ledgers. Each program has a human-readable slug (e.g. `cafe-esquina`).
- **Consequences:** simpler deploys and upgrades; per-merchant named accounts are a future option.

## D-008 Mock stablecoin "tUSDC": accepted
- **Decision:** deploy a standard NEP-141 token `tusdc` (6 decimals) with a public faucet method on testnet. Merchants fund pools via `ft_transfer_call` to `fairly`.
- **Consequences:** clearly labeled "test USDC" in UI and README.

## D-009 Pass balance model: accepted (option A), option B pending spike T1.2
- **Context:** the `nfts` track hints at "NFTs as accounts / sub-accounts". A real sub-account per pass needs a small vault contract deployed per pass; storage cost may be too high unless NEAR global contracts are available on testnet.
- **Option A (fallback):** pass balances are an internal ledger in `fairly` keyed by `token_id`. Transfer of the NFT transfers the balance.
- **Option B (target):** each pass gets a keyless sub-account `p<id>.fairly.<net>` running a shared "pass vault" global contract that only obeys `fairly`; tUSDC sits in that account.
- **Decision:** build Option A first behind a small internal interface; attempt Option B in spike T1.2. If the spike succeeds within 4 hours, adopt B.
- **Consequences:** specs describe behavior ("the pass holds a balance"), not storage location.

## D-010 Cashier authorization: accepted
- **Decision:** the merchant registers one or more cashier account ids per program. The cashier device holds a NEAR function-call access key restricted to `fairly.record_purchase` (and `issue_pass`). The contract enforces a per-program daily cashback cap.
- **Consequences:** a stolen cashier device cannot withdraw funds or exceed the daily cap.

## D-011 Customer onboarding without a wallet: accepted
- **Context:** NEAR's former official email login (FastAuth) is retired; third-party options are not verified for testnet this week.
- **Decision:** the app creates a key pair in the customer's browser (implicit account). A small server-side sponsor funds new accounts with a tiny amount of testnet NEAR so they can sign redeem/resell. Email/social login is a stretch goal.
- **Consequences:** customer keys live in browser storage (acceptable for a testnet demo; documented as a limitation). Merchants use a normal testnet wallet via NEAR Wallet Selector.

## D-012 Resale inside the contract: accepted
- **Decision:** `fairly` includes a minimal marketplace: `list_pass(price)`, `cancel_listing`, and purchase via tUSDC `ft_transfer_call`. Royalty is applied by the contract per NEP-199 values.
- **Consequences:** no dependency on external NFT marketplaces on testnet.

## D-013 Dynamic artwork: accepted
- **Decision:** NFT `media` points to an SVG route in the web app: `/api/art/<program>/<tier>.svg`, generated from program colors and tier. `reference` JSON includes tier and balance snapshot.
- **Consequences:** artwork changes instantly with tier; no IPFS needed for the demo.

## D-014 Expiry is lazy: accepted
- **Decision:** a pass whose last activity is older than the program's `expiry_days` can be swept by anyone calling `sweep_expired(token_id)`; its balance returns to the pool. Reads show the "would expire" state.
- **Consequences:** no cron job needed.

## D-015 Frontend stack and hosting: accepted
- **Decision:** Next.js (App Router) + TypeScript + Tailwind, `near-api-js` (or `@near-js/*`) and NEAR Wallet Selector. Hosted on Vercel free tier. Sponsor endpoint runs as a Next.js route handler with a testnet key in environment variables.
- **Consequences:** one deployable app; keep the hosted demo up until at least 2026-11-25.

## D-016 Repository layout and publication: accepted
- **Decision:** the `fairly/` folder is the public repository (MIT). See `publication.md` for what is committed and what never is.

## D-017 Regulatory framing: accepted
- **Decision:** cashback is described as a merchant-prepaid discount, not a deposit or investment. No yield, no fiat redemption.
- **Consequences:** README and UI copy follow this wording.

## D-018 Design before code - accepted
- **Decision:** the full UX/UI flow is prototyped in static HTML (Tailwind CDN + Alpine.js) in `design/` and reviewed before any app code or commit. Prototypes are served by an `nginx:alpine` container.
- **Consequences:** the Next.js app reuses the same tokens (`design/assets/setup.js`) and copy.

## D-019 Visual language - superseded by D-021
- **Decision:** warm neutral palette with one brand color (pine) and one attention color (coral); Bricolage Grotesque + Geist; flat surfaces; no dashes, gradients, pill clusters or hype copy. Full rules in `docs/ux.md`.

## D-020 Customer vocabulary - accepted
- **Decision:** customer screens never show crypto terms (wallet, NFT, gas, token, sign). Technical details appear only behind "See it on NEAR".

## D-021 Visual language v2 - accepted (supersedes D-019)
- **Context:** human review rejected v1 (too plain, too much text, weak colors) and shared references: bold color-block loyalty apps.
- **Decision:** cream background, ink dark surfaces, coral brand, sun for money, lilac and mint as secondary blocks; Outfit type; rounded shapes; illustrated coins and cards; motion on key moments. Details in `docs/ux.md`.

## D-022 Backoffice has its own visual language - accepted
- **Decision:** the business backoffice uses a neutral, data-first palette (off-white, white panels, 1 px borders, 8 px radius, monospace numbers) with the merchant's brand color as the only accent. Customer and landing keep the warm brand palette.

## D-023 How NEAR is presented - accepted
- **Decision:** customer screens never mention NEAR or crypto. The landing has one short "Under the hood" section and the README explains NEAR's role concretely, as HACKATHON.md recommends. The landing footer does not need the hackathon mention; the X post and README carry it.

## D-024 Product data off-chain - accepted
- **Decision:** the counter can tag a purchase with a category. Category and location go into contract events; detailed product data (SKUs) needs POS integration and stays out of scope.

## D-025 Funding methods - accepted
- **Decision:** hackathon build funds pools with test USDC from a NEAR testnet wallet. Production paths: card via a fiat on-ramp partner, and USDC/USDT from other chains via NEAR Intents. The UI shows all three and labels the first two as production.

## D-026 Visual refinements v3 - accepted
- **Decision:** smaller radii (14 to 18 px on blocks, 10 to 12 px on buttons), soft tints instead of saturated blocks, pills only for value chips, hover states on every interactive element, slanted hero edge with a perforated line.

## D-027 Prototype rules, review round 3 - accepted
- **Decision:** every dropdown and date picker is a custom Tailwind + Alpine component (`select`, `datepicker` in `design/assets/setup.js`), never the native control. Demo-only notes appear as `(demo · ...)` in a monospace face (`.demo`). Gold coins carry a staggered diagonal shine. Product illustrations are shaded SVGs. The landing hero, the marquee and the footer share one slant angle.

## D-028 Empty pool never blocks a purchase - accepted
- **Decision:** when rewards money is short, the visit still counts and cashback is stored as pending, settled automatically on the next top-up (RUN). Backoffice shows a red banner from 7 days of runway; counters warn from 2 days.
- **Consequences:** contract needs a pending ledger and a settle method; spec BUY-004 changed.

## D-029 Hero products as raster art - accepted
- **Decision:** the hero and footer products come from one generated sprite sheet (prompt in `design/IMAGE-PROMPTS.md`), cut into transparent PNGs. They intentionally break the flat SVG style. Coins stay SVG.

## D-030 API runtime: Cloudflare Workers - accepted
- **Context:** spike `docs/spikes/2026-11-10-near-on-workers.md`: near-api-js 7.4.0 reads, signs, sends, adds limited keys and relays meta transactions inside workerd with no compatibility flags. Bundle 93 KiB gzip.
- **Decision:** the API (sponsor, relayer, event sync) runs on Cloudflare Workers. Supabase Edge Functions (Deno) also passed and stay as fallback.

## D-031 Package manager and supply-chain policy - accepted
- **Decision:** pnpm only (via corepack, inside Docker). `minimumReleaseAge: 1440` and `allowBuilds` allow-list in `pnpm-workspace.yaml`. Exact versions in lockfile; no npm or yarn.

## D-032 Stack - accepted (supersedes D-015)
- **Decision:** Astro + Tailwind + Vue islands on Cloudflare (Pages/Workers); Supabase (Postgres, Realtime, Storage) for history, analytics and merchant data; NEAR testnet for money. Everything runs locally in Docker.

## D-033 Git workflow - accepted
- **Decision:** `main` is always deployable. One branch per phase or area (`feat/contracts`, `feat/web-customer`, ...), past-tense commit messages referencing spec ids (see AGENTS.md), merge to `main` when the area passes its tests. Push only with the human's approval. Copyright holder: the project owner.

## D-034 Contract implementation choices - accepted
- **Pass balances:** option A of D-009 (internal ledger keyed by `token_id`). Option B stays a stretch goal behind spike T1.2.
- **Storage:** the merchant prepays NEAR when creating a program; passes, purchases, listings and transfers are charged to that program storage balance, because cashier function-call keys cannot attach deposits (PROG-001, PROG-013).
- **Approvals:** NEP-178 approvals are not enabled; resale happens inside the contract (D-012). `nft_payout` and `nft_transfer_payout` (NEP-199) are implemented for owner-initiated transfers.
- **Listings:** invalidated lazily when the owner changes (SALE-005).
- **Payout safety:** every tUSDC payout has a callback that restores the pass balance or pool, or credits a claimable refund (NFR-011). The test token auto-registers receivers (TOK-005).
- **Deployment:** testnet `fairly-ayxv4.testnet` (built with the `demo` feature) and `tusdc-ayxv4.testnet`, via `scripts/deploy`.

## D-035 Gasless customer actions through a relay - accepted
- **Context:** an implicit account funded with 0.05 NEAR cannot prepay 100 Tgas, and customers should never see gas.
- **Decision:** customer actions are signed in the browser as NEP-366 meta transactions and relayed by the sponsor via `POST /api/relay`, which only accepts calls to the `fairly` contract on an allowlist of methods (ONB-010). The demo program issues passes and simulates purchases server-side with the demo cashier key (ONB-008, DEMO-005).
- **Consequences:** the sponsor pays gas for every customer action; the relay is rate-limited per IP. Rate limits are in-memory per worker instance, acceptable for the demo.

## D-036 Card codes, merchant categories and real-time events - accepted
- **Card codes:** 6-character Crockford Base32 codes from the block random seed (about one billion per program, not guessable, easy to read aloud). Category uses the ISO 18245 MCC standard as a program field, not a prefix in the code (PASS-004, PROG-014).
- **Events and real time:** events live in Supabase Postgres (one transparent, queryable history that analytics also uses) and reach screens through Supabase Realtime, which manages reconnection and a long-polling fallback. Chosen over Cloudflare Durable Objects (state hidden inside Cloudflare) and over a custom SSE endpoint (more code, would still read the database in a loop). Interval polling of the contract is removed (EVT-001..005).
- **Consequences:** the contract was redeployed with fresh state on testnet. Supabase runs locally through its CLI in Docker.

## D-037 Self-serve merchants, device keys and map addresses - accepted
- **Context:** judges must be able to create their own program in the demo without installing a wallet, and counter devices of new programs need their own limited signer.
- **Decision:** merchants get an implicit account in the browser, funded by the sponsor, and act through the same meta-transaction relay as customers (ONB-011, ONB-012). The relay checks a per-receiver method allowlist with deposit caps. A counter device is a new implicit account created by the merchant (0.01 NEAR transfer) and registered with `add_cashier`; its key travels in the pairing QR fragment, so it never reaches the server. Balance codes from a device are honored only with a fresh signature from a registered cashier key. Event rows store the meta-transaction sender as `signer_id`. Addresses use OpenStreetMap tiles with Leaflet and Nominatim search, called from the browser.
- **Consequences:** no wallet is needed for the full demo, at the cost of the sponsor paying gas and 0.5 NEAR per new merchant (rate limited). Wallet Selector (T2.3) stays as an option for real accounts. The shared demo program keeps owner-only actions locked. The key lives in local storage, so the backup download matters.

## D-038 One program per business, local time zone and manager role - accepted
- **Context:** the product treats a business as one loyalty program; the dashboard let an account create several. Daily limits and weekly boosts used UTC days, which split the business day in the Americas. Devices needed a way to be handed out per location without exposing the owner key.
- **Decision:** the contract allows one program per owner (PROG-015), stores `utc_offset_minutes` and uses local days for the daily cap and weekly boosts (PROG-016), and adds a manager role limited to device management at one location or all (PROG-017). Pausing a device removes it from the cashiers and reactivating adds the same account back, so a lost device stops at once. The contract was redeployed with fresh state on testnet with `scripts/reset-testnet`.
- **Consequences:** the offset is fixed, so daylight saving changes need an update from the owner. Previous testnet data was discarded.

## D-039 Pairing codes instead of keys in links - accepted
- **Context:** the first device pairing put the device key in the QR link fragment. A link with a key can end up in browser history, screenshots, chat apps or QR reader logs.
- **Decision:** each device or manager creates its key on its own screen and registers only its public account id in `pairing_requests` (Supabase, server access only), which returns a 6-character code valid for 15 minutes. The owner types the code; the app looks up the account id, funds it with a small amount of test NEAR if it does not exist, and calls `add_cashier` or `add_manager`. The waiting screen opens by itself when the matching event arrives.
- **Consequences:** no private key is ever shown, copied or sent. A leaked code only lets someone ask to be added; the owner still chooses the location and approves.

## D-040 Non-extractable browser keys, recovery keys and CSP - accepted
- **Context:** all signing keys lived as text in local storage, readable by any script running on the page.
- **Decision:** keys are WebCrypto Ed25519 `CryptoKey` objects created non-extractable and stored in IndexedDB; a custom near-api-js `Signer` signs with them (NEP-366 meta transactions still go through the relay). Backups no longer export the device key: a new recovery key is added to the account on chain and downloaded once. Production pages get a CSP from Astro's built-in `security.csp` with hashed scripts and a fixed list of origins. The relay accepts a single full-access `AddKey` only when the delegate sender is also the receiver.
- **Consequences:** an injected script could still ask the page to sign while it is open, but it cannot steal the key for later use; the CSP makes injection harder. A lost device is handled by revoking its key on chain. Email recovery with NEAR Auth (T2.15) adds a second path that needs no file.
