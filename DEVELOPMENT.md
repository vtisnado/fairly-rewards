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
| Clickable HTML prototypes | `design/` (serve with `docker run --rm -p 8088:80 -v "$PWD/design:/usr/share/nginx/html:ro" nginx:alpine`, open http://localhost:8088) |
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

Planned commands (available after T0.3 / T1.1 / T2.1):

| Purpose | Command |
|---|---|
| Build contracts | `docker compose run --rm dev cargo near build` |
| Test contracts | `docker compose run --rm dev cargo test` |
| NEAR CLI | `docker compose run --rm dev near ...` |
| Web app dev server | `docker compose up app` → http://localhost:3000 |
| Seed demo data | `docker compose run --rm dev ./scripts/seed` |
| End-to-end smoke | `docker compose run --rm dev ./scripts/smoke` |

## Secrets
Copy `.env.example` to `.env` and fill in testnet values. Never commit `.env` or key files. NEAR CLI credentials are kept in a Docker volume, not in the repo.
