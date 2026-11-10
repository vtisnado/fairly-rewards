# What goes into the public repository

The `fairly/` folder is the repository. It is published under the MIT license before 2026-11-14T23:59Z.
Making it public, pushing and posting are done only with the human's explicit confirmation (HACKATHON.md).

## Committed (public)
| Path | Why it is public |
|---|---|
| `README.md` | Entry point for judges: problem, product, how to try it, NEAR's role |
| `LICENSE` | MIT (Q-014) |
| `DEVELOPMENT.md` | How to build and run everything with Docker |
| `AGENTS.md` | Instructions for coding agents |
| `TASKS.md` | Plan and status by phase |
| `docs/` | Product brief, architecture, decisions, this file |
| `specs/` | Spec-driven requirements with ids and acceptance criteria |
| `design/` | HTML prototypes and image prompts; shows the design-first process |
| `docs/screenshots/` | Screenshots used in the judge README |
| `contracts/` | Rust smart contracts and their tests |
| `app/` | Web app source |
| `scripts/` | Deploy, seed and smoke-test scripts |
| `docker/`, `docker-compose.yml` | Reproducible toolchain |
| `.env.example` | Variable names with empty or testnet-safe values |

## Never committed
| Item | Reason |
|---|---|
| `.env`, `.env.local`, any `*.key`, `~/.near-credentials` copies | Secrets (sponsor key, deployer keys) |
| Submission payload (`submission.json` or similar) | Contains personal data (HACKATHON.md) |
| `target/`, `node_modules/`, `.next/`, build output | Generated |
| Anything outside this folder | Private planning material |

`.gitignore` enforces this list.

## Judge-facing checklist (before publishing)
- [ ] README states the problem, what was built, and NEAR's concrete role.
- [ ] README has "do X → see Y" steps for the hosted demo and for local Docker run.
- [ ] README lists libraries and templates used (Q-005).
- [ ] README links the other hackathon project if a second one is submitted (Q-015).
- [ ] Hosted demo works with no wallet install.
- [ ] Demo video linked; X post published by the human.
- [ ] No secrets in git history (`git log -p | grep -i key` sanity check).
- [ ] LICENSE present; repo public.
