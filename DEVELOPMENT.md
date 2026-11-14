# Fairly: development README

This is the entry point for working on Fairly. The judge-facing overview is `README.md`.

## Where to find everything
| I need… | Go to |
|---|---|
| What we are building and why | `docs/product.md` |
| How the pieces fit | `docs/architecture.md` |
| Why something was decided | `docs/decisions.md` |
| What is public / never committed | `docs/publication.md` |
| Exact behavior to implement | `specs/` (start at `specs/README.md`) |
| UX rules, palette, typography | `docs/ux.md` |
| Who uses which screen | `docs/roles.md` |
| Clickable HTML prototypes | `design/` (`docker compose up design`, open http://localhost:8088) |
| What to do next and status | `TASKS.md` |
| Rules for coding agents | `AGENTS.md` |

## Workflow (spec-driven)
1. Pick the next `todo` task in `TASKS.md`; mark it `in progress`.
2. Read its spec ids. If unclear or wrong, fix the spec first.
3. Write tests named after the ids, then the code.
4. Run tests in Docker; update spec status and `TASKS.md`.

## Toolchain (Docker only)
Host requirements: Docker and git. Nothing else is installed on the host.

```bash
docker compose build dev
```

```bash
docker compose run --rm dev bash
```

The `dev` image ships Rust (stable, `wasm32-unknown-unknown`), cargo-near 0.23, near-cli-rs 0.31, Node 22 and pnpm 12 (Debian trixie). NEAR binaries are downloaded from their GitHub releases and checked against the published SHA-256.

| Purpose | Command |
|---|---|
| NEAR CLI | `docker compose run --rm dev near ...` |
| Build contracts | `docker compose run --rm dev sh -c "cd contracts/fairly && cargo near build non-reproducible-wasm"` |
| Test contracts | `docker compose run --rm dev sh -c "cd contracts && cargo test"` |
| Deploy contracts to testnet | `docker compose run --rm dev ./scripts/deploy` |
| Type-check the web app and E2E specs | `docker compose run --rm dev pnpm -C app check` |
| Install web dependencies | `docker compose run --rm dev pnpm -C app install` |
| Web app dev server | `docker compose run --rm --service-ports dev pnpm -C app dev` → http://localhost:3000 |
| API (Workers) dev server | port 8787 |
| Seed demo data | `docker compose run --rm dev ./scripts/seed` |
| Start local Supabase (Postgres, Realtime, Studio at http://localhost:54323) | `docker compose run --rm supabase start` |
| Stop local Supabase | `docker compose run --rm supabase stop` |
| Update the NFT art base URL (contract account only) | `docker compose run --rm dev ./scripts/set-art-url https://<hosted app origin>` |
| Smoke test a running app | see below |

## Type checks
`pnpm -C app check` runs `astro check` (with TypeScript 6, the version `@astrojs/check` supports) over Astro, Vue and TypeScript files including `app/e2e`. It runs non-interactively and must report 0 errors, 0 warnings and 0 hints.

## README screenshots
With the dev server running and a funded sponsor: `docker compose run --rm --entrypoint node e2e /workspace/scripts/capture-screenshots.mjs` writes `docs/screenshots/*.png`. Compress them afterwards with ImageMagick in the dev image.

## Smoke test
`scripts/smoke <base_url> [--skip-csp]` checks that the landing, `/wallet`, `/market`, `/sitemap.xml`, `/robots.txt`, `/sw.js`, the wallet manifest and a card art route return 200, that the manifest parses, that the `fairly` contract answers `get_program` for the demo slug over RPC, and that the content security policy is present. The policy check is skipped automatically for localhost URLs and with `--skip-csp`. It exits non-zero when any check fails.

For the local dev server, run it on the host network so `localhost` reaches it:

```sh
docker run --rm --network host --env-file .env -v "$PWD":/workspace -w /workspace fairly-dev ./scripts/smoke http://localhost:3000
```

For the hosted app: `docker compose run --rm dev ./scripts/smoke https://<hosted app origin>`.

## Updating the art URL
`scripts/set-art-url <url>` calls `set_art_base_url` on the contract signed by the contract account (key in the `near-credentials` volume). Existing cards pick up the new `media` URL immediately. `scripts/deploy` upgrades the code in place without touching state when the contract is already initialized.

## Testnet accounts
Created with the faucet from inside the container:

```bash
docker compose run --rm dev near account create-account sponsor-by-faucet-service <name>.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create
```

| Account pattern | Role |
|---|---|
| `fairly-<suffix>.testnet` | Core contract |
| `tusdc-<suffix>.testnet` | Test stablecoin |
| `sponsor-<suffix>.testnet` | Funds new customer accounts |
| `demo-cafe-<suffix>.testnet` | Demo merchant |
| `demo-cashier-<suffix>.testnet` | Demo cashier |

## Supabase
The `supabase` service runs the Supabase CLI with the host Docker socket and host networking, so it can start the Supabase containers next to ours. Migrations live in `supabase/migrations`. After `start`, copy the publishable and secret keys it prints into `.env`.

## Production deploy
Production runs on Cloudflare Workers at https://fairly.disenoapps.dev with a hosted Supabase project. The `PROD_*`, `SUPABASE_*` and `CLOUDFLARE_*` values live in `.env`.

| Step | Command |
|---|---|
| Apply migrations (IPv4 session pooler) | `docker compose run --rm supabase db push --db-url "postgresql://postgres.<ref>:<db password>@aws-1-us-east-1.pooler.supabase.com:5432/postgres"` |
| Build and deploy the Worker (`workers.dev` URL stays off) | `set -a; . ./.env; set +a; timeout 900 docker compose run --rm -e PROD_APP_URL -e PROD_SUPABASE_URL -e PROD_SUPABASE_PUBLISHABLE_KEY -e CLOUDFLARE_API_TOKEN -e CLOUDFLARE_ACCOUNT_ID --entrypoint sh dev -c ./scripts/deploy-app` |
| Server secrets | `wrangler secret bulk --name fairly` with the sponsor, demo and Supabase server values |
| Sample data for the demo dashboard | `docker compose run --rm dev node scripts/seed-demo-events --prod` |
| Check the live site | `./scripts/smoke https://fairly.disenoapps.dev` (see Smoke test) |

## Secrets
Copy `.env.example` to `.env` and fill in testnet values. Never commit `.env` or key files. NEAR CLI credentials live in the `near-credentials` Docker volume, not in the repo.

## End-to-end tests
Browser tests run in the official Playwright image against the dev server and testnet, so nothing is installed on the host. Start the app first (`docker compose run --rm --service-ports dev pnpm -C app dev`), then:

```sh
docker compose run --rm e2e test
```

To test the production build (where the content security policy applies), build it and serve it with Wrangler on another port, then point the tests at it:

```sh
docker compose run --rm dev pnpm -C app build
docker run --rm --network host -v "$PWD":/workspace -w /workspace/app fairly-dev pnpm exec wrangler dev --ip 0.0.0.0 --port 8790 --env-file ../.env
docker compose run --rm -e E2E_BASE_URL=http://localhost:8790 e2e test
```

Reports land in `app/e2e-report/`. The tests create real testnet accounts paid by the sponsor and spend about 5 NEAR per full run, so run them with a funded sponsor account. A preflight (`app/e2e/global-setup.ts`) stops the run with a clear message when the sponsor holds less than 6 NEAR (override with `E2E_MIN_SPONSOR_NEAR` when running a single spec) or when the demo program is out of storage balance; top the program up with `deposit_storage` signed by the demo merchant. Run the suite alone: parallel runs share the sponsor key and the in-memory rate limits.
