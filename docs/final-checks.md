# Final checks

Run date: 2026-11-08. Repo: `/home/user/Babystuff`. Branch: `claude/beautiful-tesla-ojc3nq`. Scope: after Phase E (button and email automation). Nothing was committed.

## 0. Environment variables

Command: `env | grep -E 'CLAUDE_CODE|ANTHROPIC_DEFAULT'`

Present: `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, plus other `CLAUDE_CODE_*` session variables.

Missing from the set that CLAUDE.md asks for:

- `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (should be 500000)
- `CLAUDE_CODE_FORK_SUBAGENT` (should be 0)
- `ANTHROPIC_DEFAULT_SONNET_MODEL` (should be `claude-sonnet-5-5`)
- `ANTHROPIC_DEFAULT_HAIKU_MODEL` (should be `claude-haiku-5-5`)

Result: four of the five required settings are missing. The run carried on. Subagents were not used for this pass.

## 1. Build leaves no diff

Command: `node scripts/build.mjs`, then `git status --porcelain -- index.html`

```
Inlined: src/index.html, data/programs.json, src/css/base.css, src/css/features.css, src/js/logic.js, src/js/store.js, src/js/email.js, src/js/tracker.js, src/js/profile.js, src/js/directory.js, src/js/guided.js, src/js/app.js
Wrote index.html (183480 bytes)
exit=0
```

`git status --porcelain -- index.html` output: (empty)

Result: PASS. The committed `index.html` matches a fresh build.

## 2. Tests

Command: `node --test`

```
# tests 80
# suites 0
# pass 80
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 222.682538
```

Result: PASS. 80 of 80 tests passed. (The previous run before Phase E had 46.)

## 3. Offline at phone width (Playwright)

Script: `/tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/final2/check.js`
Raw results: `/tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/final2/results.json`
Browser: system Chrome (`/usr/bin/google-chrome`), with the `playwright` package from `/opt/node-tools`.

Setup: viewport 375x812, deviceScaleFactor 2, `offline: true`. Every non-`file:` request was logged and aborted. The page is opened from `file:///home/user/Babystuff/index.html`.

| Check | Result |
|---|---|
| Blocked non-file requests | 1 (see below) |
| Console errors | none |
| Page errors | none |
| `scrollWidth <= 375` on programs | yes (375) |
| `scrollWidth <= 375` on my-info (plus addresses on) | yes (375) |
| `scrollWidth <= 375` on guided run | yes (375) |
| `scrollWidth <= 375` on tracker | yes (375) |
| `scrollWidth <= 375` on tracker, Email and calendar panel | yes (375) |
| `scrollWidth <= 375` on spot-a-fake | yes (375) |
| `scrollWidth <= 375` on programs-dark | yes (375) |
| `scrollWidth <= 375` on focus check summary | yes (375) |

Blocked request detail: one top-level `document` request to `https://register.gerber.com/`. It was logged in the focus-check context, where the Done button was pressed twice. The guided run's "open the next sign-up page when I tap Done or Skip" option is on by default, so that tap opened the next program's official page in a new tab. The request was a page navigation in that new tab, not a request made by the app's own page. The app page itself made 0 requests. This attribution is inferred from the log (type, URL and the step that caused it), not from a separate check of the tab that made the request.

Sample data: My info was filled with Jane Doe, `jane@gmail.com`, 123 Main St, Austin, TX, 78701, due date 2027-03-15, with "Give each program its own plus address" on. The preview read `Preview: jane+similac@gmail.com (for MySimilac Rewards)`. The guided view was started with the default selection, so its first step is "Enfamil Family Beginnings" (1 of 9), with the email row showing `jane+enfamil@...`.

Screenshots written to `docs/screenshots/`, regenerated in this run:

- `programs.png`
- `my-info.png` (plus-address section and preview visible)
- `guided.png` (guided run, step 1 of 9)
- `tracker.png`
- `tracker-email.png` (the "Email and calendar" panel)
- `spot-a-fake.png`
- `programs-dark.png`

The Keyboard focus check (Tab order under the bottom nav) from the earlier run was not repeated in this pass. Its result applies to the build before Phase E.

Result: PASS on console errors, page errors and phone-width overflow. The one blocked request is the popup navigation described above, not a request from the app.

## 4. Model audit

Command: `for f in ~/.claude/projects/*/*/subagents/*.jsonl; do grep -o '"model":"claude-[^"]*"' "$f" | sort | uniq -c; done`

Location: `/root/.claude/projects/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/subagents/`. There are 20 `.jsonl` transcripts. Transcripts were not read. Each count was taken with `grep -o` and `sort -u`, and each transcript had exactly one model name.

| Model | Transcripts |
|---|---|
| claude-sonnet-5-5 | 15 |
| claude-haiku-5-5 | 5 |
| any other model | 0 |

Result: PASS. No transcript used a model other than Sonnet or Haiku. The earlier report listed 17 transcripts; there are now 20.

## 5. Docs changed in this pass

- `README.md`: new "Automation: buttons and email" section, new "Automatic checks on GitHub" section, and `tracker-email.png` in the Screenshots block. The README does not state a test count, so none was changed.
- `PRIVACY.md`: new "Email and calendar buttons" section, a plus-tag map note under Backups, and a GitHub link-check note under Hosting.
- `docs/final-checks.md`: this report.
- `docs/screenshots/*.png`: all seven screenshots regenerated, including the new `tracker-email.png`.

Not edited: `src/`, `scripts/`, `data/`, `tests/`, `tools/`, `.github/`, `index.html` (the build output is unchanged).

## Overall

Build: PASS (no diff). Tests: PASS (80 of 80). Offline phone-width check: PASS, with one popup navigation blocked and inferred to come from the Done button's opening of the next sign-up page. Model audit: PASS (15 Sonnet, 5 Haiku). Environment: four of five required `CLAUDE_CODE_*` and `ANTHROPIC_DEFAULT_*` settings are missing.
