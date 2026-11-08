# Progress

## Setup (done, 2026-11-08)
- The repo `luisitin/Babystuff` started empty. Work happens on `claude/beautiful-tesla-ojc3nq`. `main` was created from the README-only root commit (`1736b66`) so a PR can target it. GitHub made the work branch the default because it was pushed first; switch the default to `main` in Settings > Branches.
- The session ran on the user's Default environment. Its network was switched from Limited to Unrestricted, with the user's approval, so official sites could be read. Missing env vars: `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_CODE_FORK_SUBAGENT`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`.
- **Fetching quirk:** after the network change, WebFetch kept failing with `getaddrinfo ENOTFOUND`, because the container's local DNS still followed the old allowlist. Pages were read through the session's HTTPS proxy instead, with a small helper (`fetch-page.mjs` in the session scratchpad) that sends an honest `BabyFreebiesFinder-research/1.0` user agent. Sites that refused (403, bot challenge, JS-only shell) were not retried; those entries rest on official-domain search results and are capped at medium confidence.

## Phase A, research (done)
Seven `sonnet` researchers wrote `research/<lane>.json` and `research/<lane>-notes.md` for the formula, diapers-wipes, registry-box, feeding-baby-care, health-assistance, rewards-testing and open-sweep lanes. Raw total: 46 entries (25 high, 21 medium) before merging.

## Phase B, data (done)
- Merge (`sonnet`): 37 programs in `data/programs.json`; drops are in `research/excluded.md`, changes in `research/merge-log.md`.
- Fact-check (fresh `sonnet`): 23 entries re-checked (all below high, plus a seeded random 30% of high). 6 confirmed, 10 fixed, 8 unverifiable because the sites block automated reading (kept at medium with a caveat in notes), 0 dropped. See `research/factcheck.md`.
- Link check (`haiku`): 27 OK, 10 blocked (403, bot challenge or connection error), 0 not found, 0 off-domain. See `research/link-check.md`.

## Phase C, build (done)
- Contract: `ARCHITECTURE.md`. Builder 1 did the shell, directory, build and logic; builder 2 did My info, the tracker and the guided run; builder 3 did the autofill helper.
- Review (`sonnet`): 28 findings (3 high, 10 medium, 15 low) in `docs/code-review.md`. All were fixed by the builders. Highlights:
  - the skip link;
  - focus hidden under the bottom nav;
  - stale reads after a storage failure;
  - import size caps;
  - inline confirms instead of `window.confirm`, which is blocked in sandboxed iframes;
  - autofill skipping spouse, doctor, LMP and honeypot fields;
  - a final-domain check for autofill.
- Mobile layout: compact header and filters, so the first card shows at 375x812. The guided run puts "Open sign-up page" first, with a sticky Done/Skip/Problem bar. "Recommended" is the default sort.

## Phase D, checks and docs (done)
- Tests (`haiku`): `tests/data.test.mjs` (schema, enums, https, official domain, dates) and `tests/build.test.mjs` (fresh build matches, no external resources, CSP, no network APIs). The suite also includes the logic, store/tracker and autofill-matcher tests.
- Docs (`haiku`): `README.md` and `PRIVACY.md`.
- Final checks (`haiku`), in `docs/final-checks.md`: rebuilding leaves no diff, and `node --test` passes 46 of 46. At 375x812 offline there are 0 blocked requests, no console errors and no horizontal scroll on any view. Focus is never hidden under the nav. Screenshots are in `docs/screenshots/`.
- Model audit: 17 subagent transcripts, 13 `claude-sonnet-5-5` and 4 `claude-haiku-5-5`, none on any other model.

## Known gaps / next steps
- Eight entries rest on official-domain search results because their sites block automated reading: Gerber, Babylist, buybuy BABY, Huggies, Edgepark, Early Head Start, Cribs for Kids, Healthy Start and PSI. Recheck them in a normal browser.
- Diapers, feeding and baby care have few real freebies. Most brands offer only discounts or paid trials (see `research/excluded.md`).
- Offers change. Re-run research and fact-checking every few months and update `verifiedOn`.

## Phase E, button and email automation (done)
The user asked to "automate through buttons and email connections" and keep going without check-ins. The contract is in ARCHITECTURE.md ("Phase E"). Nothing submits sign-up forms or clicks through bot checks, which is the user's original rule.
- Builder A (`sonnet`): `BFF.email` (per-program plus addresses, Gmail filter XML, Gmail search links, mailto checklist, .ics reminders); the guided run's Done opens the next page, plus keyboard shortcuts; the directory's "Start a guided run with these N".
- Builder B (`sonnet`): GitHub Actions CI (build, diff, tests) and a weekly or button-triggered link check that opens or closes a `link-check` issue (GitHub emails the owner); `scripts/check-links.mjs`.
- Builder 3 (`sonnet`): autofill runs from the app's backup (`--from-backup`), uses the same persisted plus tags, and writes a new `-updated.json` with statuses and `signedUpAt` for re-import. It still never submits.
- Review (`sonnet`): 20 findings (2 high), all fixed (`docs/code-review-phase-e.md`):
  - Gmail filters archive only plus-address mail, and never filter retailer or .gov domains;
  - single-key shortcuts are opt-in, with Undo;
  - auto-open never opens a page twice and reports blocked popups;
  - plus tags persist in `profile.plusTagMap`;
  - reminders use `signedUpAt`;
  - the link checker has a DEAD class and exit code 2 for crashes.
- Docs and final checks (`haiku`): README and PRIVACY updated. `node --test` passes 80/80, the build leaves no diff, and offline at 375px the page made 0 requests with no errors. CI passes on GitHub.
- Model audit: 20 subagent transcripts, 15 `claude-sonnet-5-5` and 5 `claude-haiku-5-5`, none on any other model.
