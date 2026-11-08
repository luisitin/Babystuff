# Progress

## Setup (done, 2026-11-08)
- The repo `luisitin/Babystuff` started empty. Work happens on `claude/beautiful-tesla-ojc3nq`. `main` was created from the README-only root commit (`1736b66`) so a PR can target it. GitHub made the work branch the default because it was pushed first; switch the default to `main` in Settings > Branches.
- The session ran on the user's Default environment. Its network was switched from Limited to Unrestricted, with the user's approval, so official sites could be read. Missing env vars: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_CODE_FORK_SUBAGENT`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`.
- **Fetching quirk:** after the network change, WebFetch kept failing with `getaddrinfo ENOTFOUND`, because the container's local DNS still followed the old allowlist. Pages were read through the session's HTTPS proxy instead, with a small helper (`fetch-page.mjs` in the session scratchpad) that sends an honest `BabyFreebiesFinder-research/1.0` user agent. Sites that refused (403, bot challenge, JS-only shell) were not retried; those entries rest on official-domain search results and are capped at medium confidence.

## Phase A, research (done)
Seven `sonnet` researchers wrote `research/<lane>.json` and `research/<lane>-notes.md` for the formula, diapers-wipes, registry-box, feeding-baby-care, health-assistance, rewards-testing and open-sweep lanes. Raw total: 46 entries (25 high, 21 medium) before merging.

## Phase B, data: in progress
- Merge (`sonnet`) into `data/programs.json`, `research/excluded.md` and `research/merge-log.md`: running
- Fact-check (fresh `sonnet`): next
- Link check (`haiku`): after the fact-check

## Phase C, build: not started
The contract is in `ARCHITECTURE.md` (file ownership, `BFF` namespace, storage keys, filter definitions).

## Phase D, checks and docs: not started
