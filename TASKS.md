# TASKS

Status: `todo` · `in progress` · `done` · `blocked` · `cut` (dropped for time)
Deadline: **2026-11-14 23:59 UTC**. Today plan starts 2026-11-10.

## Phase 0: Foundations (2026-11-10)
| Id | Task | Specs | Status |
|---|---|---|---|
| T0.1 | Project folder, docs, specs, AGENTS, TASKS, READMEs | - | done |
| T0.2 | Confirm working name and LICENSE copyright holder with human (D-001) | - | done |
| T0.3 | `docker/Dockerfile` (Rust stable + wasm target, cargo-near, near-cli-rs, Node LTS, pnpm) and `docker-compose.yml` with `dev` service | NFR-007 | done |
| T0.4 | `git init` and first commit (`.gitignore`, `.env.example` already created) | NFR-003 | done |
| T0.5 | Create testnet accounts (contract, tusdc, sponsor, demo merchant, demo cashier) via near-cli in Docker; store keys outside repo | - | done |
| T0.6 | Local Supabase stack in Docker (Postgres, Realtime, Storage) when the API needs it | D-032 | done |

## Phase 0.5: Design review (2026-11-10, before any commit or app code)
| Id | Task | Specs | Status |
|---|---|---|---|
| D0.1 | UX principles, visual language, roles diagram (`docs/ux.md`, `docs/roles.md`) | D-018..020 | done |
| D0.2 | HTML prototypes v3 (review round 2): landing, customer walkthrough, counter tablet/phone, business backoffice, market, roles SVG | UI-* | done |
| D0.10 | Review round 4: hover lag fix, onboarding carousel, backoffice drawers, pagination, chart tooltips, boost calendar, runway alerts | ANA-011/012, RUN | done |
| D0.9 | Review round 3: illustrations, slanted marquee and footer, coin shine, custom selects and calendars, backoffice screens (customers, boosts, locations, devices, rewards money, settings) | ANA-005..010, EXP-000 | done |
| D0.8 | Spec new features from review: boosts, locations, analytics, branding, categories | BST, LOC, ANA, PROG-011/012, BUY-009..011 | done |
| D0.3 | Image generation prompts (`design/IMAGE-PROMPTS.md`) | - | done |
| D0.4 | Human review of prototypes; record changes as spec updates | UI-* | todo |
| D0.5 | Pick final name (replace `BRAND` in `design/assets/setup.js` and docs) | D-001 | done |
| D0.6 | Design missing states: expiry warning, errors, offline (redeem-code entry done) | UI-012, EXP-004 | todo |
| D0.7 | Generated products sheet cut into 8 WebPs (ImageMagick in Docker) and used in hero and footer | D-029 | done |

## Phase 1: Contracts (2026-11-11)
| Id | Task | Specs | Status |
|---|---|---|---|
| T1.1 | Verify near-sdk / cargo-near / near-contract-standards versions on docs.near.org; scaffold `contracts/` workspace | D-006 | done |
| T1.2 | Spike: pass vault sub-accounts with global contracts on testnet (max 4 h) → decide D-009 | PASS-011 | cut (not enough time) |
| T1.3 | `tusdc` NEP-141 with faucet | TOK-001..004 | done |
| T1.4 | Programs: create, fund, withdraw, cashiers, pause, views | PROG-001..010 | done |
| T1.5 | Passes: mint, NEP-171/177/181, one per program, metadata, tiers | PASS-001..010 | done |
| T1.6 | Purchases: cashback, pool check, daily cap, events | BUY-001..007 | done |
| T1.7 | Redeem and perks | RDM-001..006 | done |
| T1.8 | Resale + NEP-199 payouts | SALE-001..007 | done |
| T1.9 | Expiry sweep (+ demo feature seconds) | EXP-001..005 | done |
| T1.10 | Unit tests for all MUST contract requirements (54 passing) | NFR-006 | done |
| T1.12 | Sandbox (near-workspaces) integration tests for cross-contract flows: fund, redeem, sale payouts | NFR-002, NFR-011 | cut (not enough time; the cross-contract flows are covered by the browser E2E suite) |
| T1.14 | Card codes (Crockford Base32) and MCC category, contract redeployed with fresh state and `scripts/seed` | PASS-004, PROG-014, DEMO-001 | done |
| T1.13 | Owner method to update `art_base_url` once the hosted app URL exists, `scripts/set-art-url`; code redeployed to testnet in place (state kept), URL not changed yet | PASS-005a | done |
| T1.11 | Deploy script to testnet | - | done |

## Phase 2: Web app (2026-11-12)
| Id | Task | Specs | Status |
|---|---|---|---|
| T2.1 | Astro + Tailwind + Vue scaffold, testnet badge, NEAR config | UI-* | done |
| T2.2 | Art route (SVG by tier) | UI-040, PASS-005 | done |
| T2.3 | Wallet Selector as an optional merchant signer | ONB-006 | cut (not enough time; browser keys and NEAR Auth recovery cover merchant access) |
| T2.4 | Merchant dashboard at /business/<slug>: overview with custom range and comparison, customers and devices with detail panels, cashback pool with demo top-up, locations with demo add, join QR | UI-002, UI-004 | done |
| T2.12 | Merchant self-serve: setup wizard, browser account, boosts, withdrawals, pause, device pairing, key backup | UI-001, UI-003, ONB-011, ONB-012 | done |
| T2.13 | Install @astrojs/check and run type checks in Docker (`pnpm -C app check`, 0 errors) | NFR | done |
| T2.14 | One program per business, time zone, manager role, device pause, location edit, boost suggestions | PROG-015..017, BST-010, LOC-010 | done |
| T2.15 | Email recovery for customers and businesses with NEAR Auth (FastAuth) | ONB-013..015 | done |
| T2.19 | Ask NEAR Auth operators to allow the hosted origin on the testnet login | ONB-015 | todo |
| T2.16 | Browser E2E tests with Playwright: customer and counter, balance codes, camera fallback, business setup, device pairing and pause, manager invite | UI-001..014 | done |
| T2.17 | E2E for resale and royalties | SALE-001..010 | done |
| T2.18 | Non-extractable WebCrypto keys, recovery-key backups and strict CSP, with E2E checks | NFR-012..014 | done |
| T2.5 | Customer onboarding, join and relay routes | ONB-001..010, DEMO-005 | done |
| T2.6 | Cashier POS: identify card (camera, code, recent), keypad purchase, honor balance codes live | UI-010..014, EVT-007 | done |
| T2.7 | Customer pass screen + actions | UI-020..023 | done |
| T2.8 | Events in Supabase and real-time screens without polling | EVT-001..005 | done |
| T2.9 | Block follower for events that skip the API (cashier signing directly) | EVT-006 | cut (not enough time) |
| T2.11 | Cashier device keys for non-demo programs, paired by QR | BUY-008, UI-014 | done |
| T2.20 | Home screen shortcuts: manifest per context, install offers, iOS connect-by-code | UI-060..066 | done |
| T2.21 | Service worker `/sw.js`: network-first passthrough, no caches, registered with install criteria; remove the UI-066 no-worker rule | NFR-015, D-043 | done |
| T2.22 | `/wallet` page: list all cards, total balance, empty state, live updates; `/join/<slug>` adds the card and opens the wallet; card detail at `/wallet/<slug>` | WAL-001..004, WAL-013, WAL-020, UI-070, ONB-016 | done |
| T2.23 | Rotating customer code API: `customer_codes` migration, `POST /api/customer-code`, code screen with QR, typed code, countdown and rotation | WAL-005..008, WAL-016..019, NFR-016 | done |
| T2.24 | Counter lookup by customer code: `POST /api/cashier/customer-code`, scan and typed field, resolve the card of the counter's program, continue purchase and redeem flows | WAL-009, WAL-011, WAL-012 | done |
| T2.25 | Issue a card on the spot when the resolved customer has none | WAL-010 | done |
| T2.26 | Shortcut consolidation: wallet manifest, remove the card manifest, install offer on the wallet, iOS connect once with slug `wallet` | UI-067, UI-068, WAL-014, ONB-017 | done |
| T2.27 | Update E2E: wallet with two cards, code rotation and expiry, counter resolve, issue on the spot, sell one card from the wallet, service worker never caches API | WAL-*, SALE-011, NFR-015 | done |
| T2.10 | Customer key recovery: covered by email recovery with NEAR Auth (T2.15) | ONB-002, ONB-011..015 | done |
| T2.29 | E2E hardening: RPC failover and retried views, join page 503 instead of 404 on RPC errors, preflight of sponsor balance and demo storage, full suite 28 passed and 1 skipped | NFR-006 | done |
| T2.28 | Wallet follow-ups: E2E for `RATE_LIMITED` on code resolve (needs a production-limits run), wallet code offline state check on a real phone (level-up screen and intro slides are already restored) | WAL-006, WAL-009 | todo |

## Phase 3: Market, demo, polish (2026-11-13)
| Id | Task | Specs | Status |
|---|---|---|---|
| T3.1 | Market screen + buy flow | UI-030, SALE-008..010 | done |
| T3.2 | Landing page with demo roles | UI-050, DEMO-003 | done |
| T3.3 | `scripts/smoke <base_url>` (HTTP routes, manifest, RPC view, CSP) | DEMO-001, 002, 004 | done |
| T3.4 | Deploy to Cloudflare (Pages + Workers) and Supabase; env vars; verify on phone | NFR-008..010 | todo |
| T3.5 | Stretch: email login, covered by email recovery with NEAR Auth (T2.15) | ONB-007, ONB-011..015 | done |
| T3.6 | Post-pay UI: $20 minimum first deposit with the "Start small" note, "Pending to settle" and "Settle now" on the dashboard with the 7 day reminder, Available and Pending on the wallet card and detail, counter shows both, selling disabled while pending | PROG-018, PROG-019, RUN-008, RUN-009, WAL-021, WAL-022, SALE-012, UI-005, UI-006, UI-015, UI-071, D-046 | done |
| T3.7 | E2E: cashback above the pool shows Pending, selling disabled, Settle now makes it Available | PROG-018, RUN-008, WAL-021, SALE-012 | done |

## Phase 4: Submission (2026-11-14)
| Id | Task | Specs | Status |
|---|---|---|---|
| T4.1 | Final judge README (try the demo, run locally, conventions, screenshots, test coverage, NEAR role, libraries used); draft written with screenshots, `<DEMO_URL>` and `<VIDEO_URL>` placeholders still to fill | docs/publication.md | in progress |
| T4.2 | Record 90 s demo video (human) | DEMO video script | todo |
| T4.3 | Draft X post; human publishes | - | todo |
| T4.4 | Publication checklist; human makes repo public | docs/publication.md | todo |
| T4.5 | Build submission payload; human confirms; submit once | HACKATHON.md | todo |

## Backlog (after the hackathon)
| Id | Task | Specs | Status |
|---|---|---|---|
| B1 | Apple Wallet and Google Wallet passes for each card, updated on balance changes | WAL-015 | todo |
| B2 | Marketplace fee of 2.5% on resales in the `fairly` contract, alongside the merchant royalty (docs/business-model.md) | SALE-* | todo |
| B3 | Fairly fee on cashback generated (3% up to $500 a month, 2% to $5,000, 1.5% above) charged in the weekly settlement, never to the customer | PROG-021 | todo |
| B4 | Network cost folded into the fees and reviewed monthly against the NEAR price (no oracle); show the review to the merchant | PROG-021 | todo |
| B5 | Overdue-pending protection: stop crediting new cashback after N days of pending (default 14) and show a notice on the market | PROG-020 | todo |
| B6 | Flat fee per card issued (about $0.03), attributed to the merchant whose QR the customer joined, charged in the weekly settlement | PROG-021 | todo |
| B7 | Contract enforcement: reject `list_pass` when `pending > 0` with `PENDING_ON_CARD` and ignore listings of a card that gains pending | SALE-013 | todo |
| B8 | Settle more than 20 pending cards in one step (loop `settle_pending` from the dashboard after a deposit) | RUN-008 | todo |
