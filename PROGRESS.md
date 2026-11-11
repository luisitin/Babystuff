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

## Phase G, what is really free, ranking, and a plan by due date (2026-11-10)
The user reported that the "Truly free" filter showed sweepstakes, coupons and points instead of real free samples, and asked for the list to show which offers are worth the most, a plan by due date, and research into money and benefit programs.

The contract is in `ARCHITECTURE.md` ("Phase G"). Rounds 1 to 5 are written there. Round 4 is the code-review fixes. Round 5 is a phone layout fix: the due-date buttons sit in one row of equal tiles, and the plus-address preview has its own line. Nothing in the product rules changed: no network calls, no form submission, and personal details only in localStorage.

- Research (the session's network was Limited, so no official page was read directly):
  - Wave 1: seven lanes, `formula-feeding`, `diapers-babycare`, `registry`, `health-benefits`, `assistance`, `rewards-testing` and `money`. Each wrote `research/phase-g/<lane>.json` and `<lane>-notes.md`. The shared brief is `research/phase-g/BRIEF.md`. The first merge took the list from 37 to 86 programs (`research/phase-g/merge-notes.md`).
  - Wave 2: four lanes, `wave2-samples`, `wave2-retail`, `wave2-health` and `wave2-money`, gave 71 entries. The second merge took the list to 146.
  - Link fixes: the Link check run before run 7 found 20 dead or moved addresses across 14 programs. Four programs were removed (text4baby, Ohio Every Baby Sleeps Safe, WellCare NC and Medela Mom's Room), five were re-pointed, and five dead source links were dropped. 146 minus 4 is 142 (`research/phase-g/link-fixes.md`).
- Data: 142 programs, up from 37.
  - By category: money 42, health benefits 39, assistance 16, registry welcome boxes 15, diapers and wipes 7, product testing 7, formula 6, baby care 6, feeding 3, rewards 1. `money` is the new category.
  - 60 programs are limited to some states. 5 entries are another way to get the same thing (`sameAs`), and all five point to the insurance-covered breast pump entry.
  - Confidence: 14 high, 95 medium, 33 low. The 14 high entries are all from the original 37. No program added in Phase G is high.
  - 95 entries have a value range: 29 from the official page and 66 estimates.
  - Truly free: 37 programs. 28 depend on eligibility rules (income, insurance, a benefit program). The other 9 have no eligibility rules: 6 are nationwide and 3 are for a single state. All 9 are marked likely. No truly free program is marked guaranteed.
- App changes:
  - "Truly free" means free to claim, no purchase or paid membership, a product first, and not dependent on chance. Sweepstakes, coupons, points and product testing never count.
  - Programs: a summary with the truly free programs open to everyone, their combined estimated value, how many more are free if you qualify, and a "Show these" button. The default sort is "Best value first", which groups programs under "Top pick", "Worth doing", "Also free", "Only if you would buy anyway" and "Long shot", with a rank on each card. Other sorts include by when to do it. Filters: search, category, "What you get" and four tick boxes. Each card shows what arrives free, the estimated value, how sure it is, the effort and the best time. Entries that are two ways to the same benefit sit under the main card.
  - Programs for other states are hidden until a state is set in My info, with a "Show them" button.
  - A due date in My info gives the weeks left and buttons that jump to the plan for now, the last weeks and after the birth.
  - The guided run and the tracker follow the same ranking and state rule. The tracker total estimates what is signed up or received, and counts each benefit once.
  - The email features (plus addresses, Gmail filters, Gmail searches and the Gmail connection) cover only programs where signing up means brand mail arrives: an `email` requirement and a sign-up site that is not a government site.
- Link check: run 7 on 2026-11-10 checked 309 unique addresses. 251 answered OK, 0 were not found, off-domain, dead or suspect, and 58 refused automated visits. See `docs/link-status.md`.
- Code review (`docs/code-review-phase-g.md`): 0 high, 3 medium and 4 low, The review was of commit `feb5ed6`. Its medium findings were: the tracker's "no known value" count mixed programs and groups; the due-date counts did not match the lists they jump to, and still showed after the due date; and plus addresses still applied to government programs in the guided run and the fill script. The four low findings are listed in the file. All seven were fixed in round 4, each with a unit test.
- Tests:
  - Unit: `node --test` passes 231 of 231.
  - Browser (`node tests/e2e/run.mjs`): 983 checks, 0 failed, and the same result again after round 5. Groups 11 and 12 are new and cover the ranking, the filters, the summary, the state rule, the due-date plan, the guided run, the tracker value line and the email features. Expected numbers are worked out from the data by the real modules (`tests/e2e/lib/model.mjs`), not typed in. Before the update the same suite had 591 checks and 9 failed; all 9 were old expectations that Phase G changed on purpose, and none was an app bug.
  - Mutation spot-check: 18 deliberate breaks, each made in a throwaway copy of the build, 18 caught (`tests/e2e/MUTATIONS.md`).
  - One browser check ("the Show them choice is remembered after a reload", artifact output) failed in one early run and passed in every later run. It is noted in `tests/e2e/FINDINGS.md`.
- Model audit: 65 subagent transcripts in the session (27 in this phase), 52 `claude-sonnet-5-5` and 13 `claude-haiku-5-5`, none on any other model.
- Limits:
  - The session's network was Limited, so no official page could be read directly in Phase G. Every Phase G entry rests on official-domain search results and is capped at medium.
  - The session hit its web-search limit during the second research wave. Leads left unsearched: the FSA or HSA life-event rule; the adoption credit; the head-of-household filing change; Oakland Brilliant Baby; Oklahoma Dream Accounts; more city and state child-account programs; Colorado's state child tax credit; more brand sample programs; and the pages that removed programs now forward to (Carolina Complete Health "Start Smart for Your Baby" and the Medela Family newsletter).

## Phase H, shorter list, tabs and "does this apply to me" (done, 2026-11-10)
Why: on a phone the Programs page was about 61,000px tall, the #1 "Top pick" was a tax credit, and 83 "if you qualify" programs gave no way to say whether you qualify.
- Data: every program has `audience` (who it is for; `[]` means anyone) and `insurer` (for member-only plans). Tagged from text already in the data, no new web research. Doubtful calls are in `research/phase-h/audience-notes.md`. 63 programs are for anyone; 14 insurers are named.
- Tabs: Programs opens on "Free stuff", with "Money", "Care and cover" and "All" beside it. `L.kindOf` sorts by the first offer. Ranks are numbered within the tab.
- Short cards: rank, badges, name, one line, value and the sign-up link; a Details button opens the rest. Sort and filters sit under "Sort and filter".
- Your situation (optional) in My info: health cover, insurer, WIC/SNAP or similar help, paid job. `L.fit` gives yes, no or maybe per program. A "no" hides the program (with a "Show them" line), a "yes" shows "Fits your answers". Programs already in progress are never hidden. The answers stay in localStorage, travel in the JSON backup, and are never used by the fill script, bookmark, phone view, autofill helper, guided copy or email. "Truly free", verdicts and ranking are unchanged.
- Size at 390px wide: Free stuff tab about 10,300px with no answers (was about 61,000px for the whole list), about 9,400px with a sample profile; All tab about 16,600px. First card starts within two screens. The targets of 9,000px and 190px cards were missed by a little (10,300px and a 195px median).
- Tests: 248 unit tests pass. Browser suite: 1235 checks, 0 failed (was 983), with new groups for tabs and cards (79), situation answers (101) and layout at 360 and 390 wide (72). No app bugs found by the suite.
- Known small things: the Programs list redraws a hidden-by-answers change only after leaving and returning to the page; an imported backup keeps an unknown insurer name as text.
- Helpers this phase: 3 on `sonnet` (data tags, app build, browser suite) and 1 on `haiku` (docs and screenshots). Expected environment variables other than `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` are still missing.

## Phase I, a Tracker you can work down and "what My info is missing" (done, 2026-11-11)
Why: the Tracker listed all 142 programs in file order on a page about 54,000px tall, Do it for me was about 13,000px tall, and a program that depends on your state, health plan or income did not say which answer in My info would settle it.
- Tracker: now the person's own to-do list. Programs for other states, ones the answers rule out and other ways to get something already signed up for are left out and counted (one button shows all). The summary says "X of N done" and what is still to claim. Tabs To do, Signed up, Received, Skipped and All carry counts. To do is split into Do now, Later and a closed section for purchase offers and long shots. "Do these with help" hands the Do now list to the guided run. Rows are short with a Details button, and a changed row stays put until the next full redraw. Email and calendar, the Gmail check and Backup and restore are folds that remember being open. New pure helpers in `logic.js`: `trackerScope`, `readyNow`, `trackerSections`, `toClaim`.
- Do it for me: one row per offer with other ways folded under it, purchase offers and long shots in a closed section, three-line rows, default ticks at most one per offer and none where something is already signed up for. `logic.freeNote` says why nothing arrives free.
- Programs and My info: the Programs header is shorter, and "Fill forms on your phone" in My info is a fold.
- Missing info: `logic.missingInfo` says which of five answers (state, health cover, health plan, income answer, paid job answer) a program still needs, and `missingInfoCounts` counts them over the programs still to do. `src/js/missing.js` builds one line per program ("My info is missing your state. Add it") and one notice per page: with a count per answer on Programs, one sentence on the Tracker and in Do it for me. Every link opens My info at that field, highlights it when it is empty, shows "N programs depend on this." and adds a link straight back. The due-date, email and plus-address prompts jump to their field the same way. With an empty My info, 92 programs wait on an answer (state 60, health cover 29, income 21, paid job 17, health plan 15). With only a state (Texas in the sample) it is 36. With a sample Texas profile that answers everything except the plan name it is 5, and with the plan name 0.
- Privacy: the state and the situation answers are still read only to hide and badge programs, and now also to say what is missing. They never go into the fill script, bookmark, phone view, autofill helper, guided copy or email (`CLAUDE.md` says so).
- Size at 390px wide with an empty My info: Tracker about 8,600px (was about 54,100px) with the first row at 791px (was 1,772px); Do it for me about 6,600px (was about 13,100px); My info about 2,800px (was about 7,000px); Programs about 10,700px (was about 10,300px; the missing-info box adds 200px, and the first card starts at 945px, was 1,012px). At 320px wide: Tracker about 11,900px (was about 62,100px), Do it for me about 7,800px (was about 14,800px), My info about 3,000px (was about 8,200px).
- Tests: 264 unit tests pass.
- Known small things: the first sign-up from a Tracker row moves the rows down 43px (the claimed-value line appears); with no state, the Tracker notice counts programs limited to a state that are not in its list (the number is the same on every page); removing a highlight in My info moves the field up 14px; at 320px wide the five Tracker tabs wrap onto two rows.
- Helpers this phase: 4 on `sonnet` (Tracker build, guided and Programs build, fix round, browser suite) and 2 on `haiku` (docs and screenshots, then a retake of two pictures). Expected environment variables other than `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` are still missing.

## Not tested (needs a person)
- Phase I: the new Tracker, the missing-info lines and the jump to a field in My info on a real phone and with a screen reader (only the automated browser checks ran).
- Phase G: the entries and value figures against their official pages (the network was Limited) and the due-date plan and state rule on a real phone. (After round 5 the due-date buttons were looked at once at 768 and 1280 pixels wide: one inline row, no sideways scroll. The browser suite itself runs at phone width.)
- A real iPhone: Safari AutoFill, the Shortcut, the bookmark, Home Screen install.
- The real Claude viewer: the save prompt, the Gmail consent card, and whether the Claude iPhone app runs connector calls from an artifact.
- A real Gmail account and the real program sign-up forms.
- Screen readers (only automated name, label, focus and contrast checks ran).

## Next steps
- Open the 58 robot-blocked links by hand (`docs/link-status.md`).
- Re-verify the Phase G entries on their official pages once the network allows direct reading.
- Search the leads listed under Phase G.
- Re-run research every few months. The Phase G values and `verifiedOn` dates are as of 2026-11-10.
- Try the Shortcut recipe on a phone and correct `docs/iphone.md` if a step is off.
- Re-verify the Apple and Google help-page claims by reading the pages, once the session's network allows those hosts.
- Phase F polish pass: done. The copy fallback selects its text, the download wording is the same everywhere, My info carries the plus-address caveat, and guided "Start over" asks inside the page. Still open: a browser check that starts the Download backup button from the keyboard (the one mutation the earlier suite missed). Details are in `tests/e2e/FINDINGS.md` and `tests/e2e/MUTATIONS.md`.
