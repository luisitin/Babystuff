# Final checks

Run date: 2026-11-08. Repo: `/home/user/Babystuff`.

## 1. Build leaves no diff

Command: `node scripts/build.mjs`, then `git status --porcelain`

```
Inlined: src/index.html, data/programs.json, src/css/base.css, src/css/features.css, src/js/logic.js, src/js/store.js, src/js/tracker.js, src/js/profile.js, src/js/directory.js, src/js/guided.js, src/js/app.js
Wrote index.html (145405 bytes)
exit=0
```

`git status --porcelain` output: (empty)

Result: PASS. The build left no diff.

## 2. Tests

Command: `node --test`

```
# tests 46
# suites 0
# pass 46
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 181.139318
```

Result: PASS. 46 of 46 tests passed. No failures.

## 3. Offline at phone width

Script: `/tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/final/check.js`
Raw results: `/tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/final/results.json`

Setup: viewport 375x812, deviceScaleFactor 2, `offline: true`. Every non-`file:` request was logged and aborted.

| Check | Result |
|---|---|
| Blocked non-file requests | 0 |
| Console errors | none |
| Page errors | none |
| `scrollWidth <= 375` on programs | yes (375) |
| `scrollWidth <= 375` on my-info | yes (375) |
| `scrollWidth <= 375` on guided | yes (375) |
| `scrollWidth <= 375` on tracker | yes (375) |
| `scrollWidth <= 375` on safety | yes (375) |
| `scrollWidth <= 375` on programs-dark | yes (375) |

Screenshots written to `docs/screenshots/`: `programs.png`, `my-info.png`, `guided.png`, `tracker.png`, `spot-a-fake.png`, `programs-dark.png`.

Notes on the setup: My info was filled with Jane Doe, jane+baby@example.com, 123 Main St, Austin, TX, 78701, due date 2027-03-15. The guided view was started with the default selection, so its first step is "Enfamil Family Beginnings" (1 of 9).

Result: PASS.

## 4. Keyboard focus check

Setup: fresh context at phone width. In Do it for me, "Select none" was clicked, then 2 programs were selected and started. Done was pressed twice, which reached the "All done for now" summary. Focus was left where it landed, and Tab was pressed 15 times.

Nav top: 752 px. Viewport height: 812 px.

| Tab | Tag | Text | In viewport | Under nav |
|---|---|---|---|---|
| 1 | a | Open the Tracker | yes | no |
| 2 | button | Back to last program | yes | no |
| 3 | button | Start over | yes | no |
| 4 | a | Programs (nav) | no* | inside nav |
| 5 | a | My info (nav) | no* | inside nav |
| 6 | a | Tracker (nav) | no* | inside nav |
| 7 | a | Do it for me (nav) | no* | inside nav |
| 8 | a | Spot a fake (nav) | no* | inside nav |
| 9 | (none) | focus left the page | n/a | n/a |
| 10 | a | Skip to content | yes | no |
| 11 | button | Theme: System (toggle) | yes | no |
| 12 | a | Open the Tracker | yes | no |
| 13 | button | Back to last program | yes | no |
| 14 | button | Start over | yes | no |
| 15 | a | Programs (nav) | no* | inside nav |

\* The nav links report a bottom edge of 813 px against a 812 px viewport. That is a 1 px rounding overshoot at the bottom edge, not a hidden control.

Result: PASS. No focused element is hidden under the fixed bottom nav. The nav links are the only focus stops outside the 812 px viewport, by that 1 px.

## 5. Model audit

Location: `/root/.claude/projects/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/subagents/` (17 `.jsonl` transcripts). Counted with `grep -o '"model":"claude-[^"]*"' <file> | sort | uniq -c`. Transcripts were not read.

| File | Model(s) | Count |
|---|---|---|
| agent-a1125891be360e36f.jsonl | claude-sonnet-5-5 | 61 |
| agent-a12702d5f807a448a.jsonl | claude-haiku-5-5 | 21 |
| agent-a208886a07ec80194.jsonl | claude-sonnet-5-5 | 49 |
| agent-a2e9d3eac7aeee885.jsonl | claude-sonnet-5-5 | 50 |
| agent-a4bf40ba224c617c1.jsonl | claude-sonnet-5-5 | 64 |
| agent-a53b4c59304543113.jsonl | claude-sonnet-5-5 | 68 |
| agent-a53bd19e550d265da.jsonl | claude-sonnet-5-5 | 53 |
| agent-a5d4b56b0afc4759f.jsonl | claude-sonnet-5-5 | 11 |
| agent-a981903f4eb550275.jsonl | claude-sonnet-5-5 | 23 |
| agent-aa81ea0c273eb6755.jsonl | claude-sonnet-5-5 | 39 |
| agent-aa85fcacd3eab172c.jsonl | claude-haiku-5-5 | 36 |
| agent-ab50187488f118698.jsonl | claude-haiku-5-5 | 42 |
| agent-abc3513e3a99c3184.jsonl | claude-sonnet-5-5 | 78 |
| agent-ac71832c0bdeddbaa.jsonl | claude-sonnet-5-5 | 76 |
| agent-ad48a7f713b4be396.jsonl | claude-sonnet-5-5 | 43 |
| agent-ae60d924191bc0b72.jsonl | claude-haiku-5-5 | 20 |
| agent-af41c6fe55d854fbd.jsonl | claude-sonnet-5-5 | 74 |

Summary: 13 transcripts used Sonnet (claude-sonnet-5-5). 4 used Haiku (claude-haiku-5-5). No transcript shows a model other than Sonnet or Haiku. No file has more than one model.

Result: PASS.

## 6. README

Added a "Screenshots" section after the intro paragraph in `README.md`. It shows `docs/screenshots/programs.png`, `docs/screenshots/guided.png` and `docs/screenshots/programs-dark.png` with alt text.

## Overall

All six checks passed. The repo now has uncommitted changes: the six screenshots in `docs/screenshots/`, `docs/final-checks.md`, and the README Screenshots section. Nothing was committed, and `src/`, `scripts/`, `data/`, `tests/` and `tools/` were not edited.
