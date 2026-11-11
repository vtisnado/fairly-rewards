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
| Install web dependencies | `docker compose run --rm dev pnpm -C app install` |
| Web app dev server | `docker compose run --rm --service-ports dev pnpm -C app dev` → http://localhost:4321 |
| API (Workers) dev server | port 8787 |
| Seed demo data | `docker compose run --rm dev ./scripts/seed` |
| End-to-end smoke | `docker compose run --rm dev ./scripts/smoke` |

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

## Secrets
Copy `.env.example` to `.env` and fill in testnet values. Never commit `.env` or key files. NEAR CLI credentials live in the `near-credentials` Docker volume, not in the repo.
