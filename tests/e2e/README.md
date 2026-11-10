# End-to-end browser test

Run from the repo root: `node tests/e2e/run.mjs` (optional `--shots <dir>` saves 1x screenshots, `--only 4,7` runs those group numbers).

- It builds the repo (`node scripts/build.mjs`), then drives Chromium through Playwright against `index.html` (standalone) and `artifact.html` (wrapped in the artifact skeleton, with a mocked `window.claude`: downloads, Gmail connector, `use()` returning null, and no runtime at all).
- Groups: 1 boot and layout, 2 routes, 3 link audit, 4 click-through of every link and button, 5 downloads and copy, 6 backup round trip, 7 Gmail card, 8 fill script on fixture forms, 9 persistence and privacy, 10 accessibility smoke.
- All network is blocked and recorded; the app must make no request of its own. Everything it sees is synthetic: the Gmail mock, the profile and the fixture forms (`lib/fixtures.mjs`). No real site or mailbox is touched.
- Exit code 1 if any check fails; the last line is `N checks, M failed`. Findings from the first run are in `FINDINGS.md`.
- Not part of `node --test` or CI: it needs a browser (Playwright is preinstalled locally, not on CI runners) and takes several minutes. Without Playwright it prints `e2e skipped: Playwright not available` and exits 0.
- Files are named without `.test.` on purpose so `node --test` never picks them up.
