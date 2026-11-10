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

## D-009 Pass balance model: proposed (spike T1.2)
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
- **Decision:** `main` is always deployable. One branch per phase or area (`feat/contracts`, `feat/web-customer`, ...), Conventional Commits referencing spec ids, merge to `main` when the area passes its tests. Push only with the human's approval. Copyright holder: the project owner.
