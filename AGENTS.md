# AGENTS.md: instructions for coding agents

You are helping a solo developer build **Fairly** for NEAR HACKATHON (development ends 2026-11-14T23:59:00Z).
Read this file first, then `TASKS.md`, then the spec you are implementing.

## Golden rules
1. **Specs first.** Behavior lives in `specs/`. Do not implement anything that has no requirement id. If behavior must change, edit the spec first, then code. Reference requirement ids in test names (`test_buy_003_cashback_amount`) and in commit messages, never in code comments.
2. **Docker only.** Never install anything on the host. Every command runs through `docker compose run --rm dev <cmd>` (see `DEVELOPMENT.md`). If a tool is missing, add it to `docker/Dockerfile`.
3. **Testnet only.** Never deploy to mainnet, sign mainnet transactions or spend real funds.
   - **Every asset movement needs human confirmation first**, on any network (testnet, devnet, sandbox): transfers, storage deposits, faucet requests, pool funding or withdrawals done by hand or by a script outside the test suite. State the amount, the source and the destination, then wait for a yes.
   - **Every long command has a timeout.** Test runs, builds, deploys and scripts run with an explicit time limit so a stuck step fails fast instead of blocking.
4. **No secrets in git.** Keys go in `.env` (ignored). Update `.env.example` with names only.
5. **Human confirmation required** before: making the repo public, posting anywhere, submitting to the hackathon API.
   - **Agents never push.** Only the human pushes.
   - **Every commit message is shown to the human and approved before committing.**
   - **No attribution of any kind.** No co-author lines and no credit to any tool, company or model in commits, code, comments or docs.
6. **English** in all files, code, UI and commits.
7. **Decisions are logged.** Any architectural choice goes into `docs/decisions.md` as a new `D-NNN` entry.
8. **Keep `TASKS.md` current.** Update status when you start (`in progress`) and finish (`done`) a task; add newly found work as tasks.
9. **No comments in code.** Code must read on its own through standard structure, file names and descriptive identifiers. Context, pending work and notes go in `TASKS.md` or `docs/`, never in source or config files.
10. **Tests grow with the code** but must not slow delivery. If they do, add the task to `TASKS.md` and finish them at the end. Final coverage is reported in `README.md`.

## Repository map
| Path | Content |
|---|---|
| `README.md` | Judge-facing README (public) |
| `DEVELOPMENT.md` | Developer entry point |
| `TASKS.md` | Tasks by phase with status |
| `docs/` | Product, architecture, decisions, UX rules, roles, publication rules |
| `design/` | HTML prototypes (source of truth for layout, copy and tokens) |
| `specs/` | Requirements with ids and acceptance criteria |
| `contracts/` | Rust contracts (`fairly`, `tusdc`, optional `pass-vault`) |
| `app/` | Astro + Tailwind + Vue web app (D-032) |
| `scripts/` | deploy, seed, smoke |
| `docker/` | Toolchain image |

## Definition of done (per task)
- Requirement ids covered by tests that pass in Docker.
- Spec status updated (`implemented` / `verified`).
- `TASKS.md` updated.
- No lint errors; `cargo fmt` / `prettier` applied.

## Conventions
- Rust: `near-sdk` 5.x, `cargo near build`, errors as stable string codes (see NFR-001).
- TypeScript: strict mode, no `any` in app code.
- Amounts: tUSDC base units (u128 as string in JSON); purchase amounts in cents.
- Commits: past tense, impersonal, short and descriptive, no repetition. Example: `Added cashback calculation on purchase (BUY-003)`, `Fixed rounding in tier progress`.
- README: clear sections (try the demo, run locally, conventions, test coverage), concise, with screenshots.

## Hackathon judging notes
Judges and automated screeners read the README and try the demo. Prefer working, reproducible flows over extra features. Keep the README factual: "do X → see Y".
