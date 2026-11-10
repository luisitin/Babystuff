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

## Phase F, Gmail connection, iPhone fill script, links that always work (done, 2026-11-10)
The user asked to "make it fully functional with just a connection to email or something, maybe an iPhone shortcut", to research and test thoroughly, and then to "make sure all links work". The contract is in ARCHITECTURE.md ("Phase F"). The rule from Phase E stands: nothing submits a sign-up form or clicks through a bot check.
- Research (`sonnet`), in `research/phase-f/`: iOS Shortcuts (`ios-shortcuts.md`), Safari and web apps on iPhone (`ios-safari-web.md`), email connections (`email-connection.md`). The session's network was Limited, so Apple, WebKit, MDN and Google help pages were seen only as search results (medium confidence at best). Anthropic's pages were read directly.
- Build (`sonnet` builders working in parallel on separate files):
  - `BFF.host` and `BFF.zip`: one place for saving files, copying text and showing text, so every button works both in the standalone page and inside a Claude artifact (no `window.open`, `mailto:` or `<a download>` needed there). `.xml` and `.ics` files are zip-wrapped for Claude's save prompt.
  - `BFF.inbox` and `BFF.inboxView`: the "Gmail connection" card in the tracker. Tap-to-run only, through Claude's Gmail connector, with five declared tools (`search_threads`, `list_labels`, `create_label`, `label_thread`, `create_draft`). It suggests tracker updates, labels matches and saves drafts to the person's own address. It never sends, deletes or archives, and stores only the time of the last check.
  - `BFF.fieldmatch`, `BFF.fill` and the "On your iPhone" panel: a fill script for a Shortcut ("Run JavaScript on Web Page") or a Safari bookmark. It runs only on https pages of the official program domains, fills only empty matching boxes, and never clicks or submits. No ready-made shortcut file is shipped, only a recipe.
  - `scripts/build.mjs` now writes two outputs: `index.html` (standalone, CSP blocks all network) and `artifact.html` (fragment for a Claude artifact). CI fails if either is stale.
- Review (`sonnet`), `research/phase-f/review-v1.md`: 4 high and 8 medium findings, all fixed with tests. Highlights: a wrong Gmail `view` enum, "your baby is on the way" read as a shipping notice, "Middle name" and "Cardholder name" getting the full name, and a backslash trick in `registrableDomain`.
- Links:
  - The checker (`scripts/check-links.mjs`) now covers every `signupUrl` and every `sourceUrls` entry and has a SUSPECT class. Last run on 2026-11-10: 85 unique links, 71 OK, 0 not found, 0 off-domain, 0 dead, 0 suspect, 14 blocked (the site refuses robots or times out).
  - Replaced: MyGerber sign-up and source, Huggies sign-up (and a dead `www1` source removed), Edgepark (`www` host), Babylist sign-up (`/registry/new`). See `research/phase-f/link-fixes*.json` and `docs/link-status.md`.
  - The 14 blocked links rest on same-day official-domain search results. Their programs stay at medium confidence. They were not retried with other headers or a real browser.
- Tests:
  - Unit: `node --test` passes 174 of 174.
  - Browser (`node tests/e2e/run.mjs`, Chromium through Playwright, not in CI): 620 checks, 0 failed, in ten groups (boot, routes, link audit, click-through of every link and button, downloads and copy, backup round trip, Gmail card with a mocked connector, fill script on fixture forms, persistence, accessibility). Both build outputs are tested.
  - Mutation spot-checks (`tests/e2e/MUTATIONS.md`): ten deliberate breakages were applied one at a time and nine were caught. The miss (the Download backup button moved from click to mouseover) is explained in the file, with the check to add.
- Docs (`haiku`): README (On an iPhone, Connect Gmail), PRIVACY (Gmail connection, fill script), `docs/iphone.md`, `docs/link-status.md`.
- Launch: PR #1 was merged into `main` on 2026-11-10 after the user reported that the GitHub Pages site showed only the placeholder README. `.nojekyll` was added so Pages serves the app as plain files. The site is https://luisitin.github.io/Babystuff/. Follow-up work goes through a new pull request from the same branch name.
- Claude artifact: `artifact.html` is published as a Claude artifact titled "Baby Freebies Finder", with the downloads permission and the five Gmail tools declared. The publisher refused the first try because a raw U+FFFD had crept into `src/js/inbox.js`; it is now built with `String.fromCharCode(0xFFFD)`, and a build test fails on a raw U+FFFD, U+2028 or U+2029 in `src/` or either output. The page's Gmail call arguments were compared with the connector's tool schemas and match. No real mailbox call was made, so result shapes are untested against real Gmail.
- Model audit: 38 subagent transcripts in the session so far (18 in this phase), 28 `claude-sonnet-5-5` and 10 `claude-haiku-5-5`, none on any other model. One `sonnet` builder stopped at the account's 5-hour usage limit before a small polish pass; that list is under Next steps.

### Not tested (needs a person)
- A real iPhone: Safari AutoFill, the Shortcut, the bookmark, Home Screen install.
- The real Claude viewer: the save prompt, the Gmail consent card, and whether the Claude iPhone app runs connector calls from an artifact.
- A real Gmail account and the real program sign-up forms.
- Screen readers (only automated name, label, focus and contrast checks ran).

### Next steps
- Polish pass (not done, waiting on the `sonnet` usage limit): select the text in the copy fallback (`src/js/host.js` `showText`); say "Nothing was sent." after a draft is saved; one wording for standalone downloads; ask before the guided run's "Start over"; a plus-address caveat in My info; a keyboard-activation check for the Download backup button (the mutation the suite missed). Details are in `tests/e2e/FINDINGS.md` and `tests/e2e/MUTATIONS.md`.
- Open the 14 robot-blocked links by hand (`docs/link-status.md`).
- Try the Shortcut recipe on a phone and correct `docs/iphone.md` if a step is off.
- Re-verify the Apple and Google help-page claims by reading the pages, once the session's network allows those hosts.
