# End-to-end browser test

Run from the repo root: `node tests/e2e/run.mjs` (optional `--shots <dir>` saves 1x screenshots, `--only 4,7` runs those group numbers). A full run takes about 6.5 minutes.

- It builds the repo (`node scripts/build.mjs`), then drives Chromium through Playwright against `index.html` (standalone) and `artifact.html` (wrapped in the artifact skeleton, with a mocked `window.claude`: downloads, Gmail connector, `use()` returning null, and no runtime at all).
- Groups: 1 boot and layout, 2 routes, 3 link audit (all programs, including the ones hidden by state and the ones inside "same thing" groups), 4 click-through of every link and button, 5 downloads and copy, 6 backup round trip, 7 Gmail card, 8 fill script on fixture forms (plus-address rules), 9 persistence and privacy, 10 accessibility smoke, 11 Phase G directory, 12 Phase G guided run, tracker and email features.
- Group 11 covers: best-value order and group headings, ranks, the Truly free, Open to everyone and What you get filters, every card line, the summary numbers, "Show these", the state rule with "Show them" and "Hide them", "same thing" groups, the due-date plan buttons, saved preferences from older versions, and no sideways scroll at 375px.
- Group 12 covers: the guided run order and default selection, the state rule in the guided list, "Start over" confirmation, tagged addresses in a run, the tracker value line, per-row plus addresses and Gmail links, and the Gmail filters file.
- Expected numbers are never typed in. `lib/model.mjs` loads the real `logic.js`, `email.js` and `fieldmatch.js` in Node and works them out from `data/programs.json`, so the page is compared with the module and the data.
- Dates for the due-date checks are relative to today, so they do not go stale.
- All network is blocked and recorded; the app must make no request of its own. Everything it sees is synthetic: the Gmail mock, the profile and the fixture forms (`lib/fixtures.mjs`). No real site or mailbox is touched.
- Exit code 1 if any check fails; the last line is `N checks, M failed`. The last full run: 983 checks, 0 failed. Findings are in `FINDINGS.md`; mutation spot-checks are in `MUTATIONS.md`.
- To test a changed copy of the build without touching the repo, put `index.html` and `artifact.html` in a folder and run `BFF_E2E_BUILD_DIR=<folder> node tests/e2e/run.mjs --only 11,12`. The run then skips the build and uses those files (this is how `MUTATIONS.md` was made).
- Not part of `node --test` or CI: it needs a browser (Playwright is preinstalled locally, not on CI runners). Without Playwright it prints `e2e skipped: Playwright not available` and exits 0.
- Files are named without `.test.` on purpose so `node --test` never picks them up.
- Layout: `run.mjs` (runner), `lib/harness.mjs` (reporter, page opener), `lib/model.mjs` (expected answers), `lib/groups-a.mjs` to `groups-d.mjs` (the checks), `lib/mock.mjs` (Gmail and artifact mock), `lib/fixtures.mjs` (synthetic form).

## Phase H (group 13)

Groups 1 to 12 open the Programs page through `open()`, which taps the All tab and unfolds "Sort and filter" (pass `all: false` for the real default view) and, where a card's status select is needed, opens the card with `openCard()`. Group 13 covers the tabs, collapsed cards, the filters disclosure, the four "Your situation" answers (save, reload, backup and restore, Clear my info), what they hide, the "Show them" choice, tracked programs never hidden, "Fits my answers", the answers never reaching the fill script, bookmark, phone view or guided copy, and no sideways scroll at 360 and 390. It prints three lines (13, 14, 15). Expected numbers come from `lib/model.mjs`.
