# Code review, Phase E (button and email automation, CI, link check)

Reviewed at commit 7a59622. Method: read the Phase E contract, `src/js/email.js`, the Phase E diffs (`git diff 9a70bb8..HEAD`), both workflows, `scripts/check-links.mjs`, the new tests and `docs/automation.md`. Ran `node --test` (69 pass) and rebuilt `index.html` (byte-identical). Exercised the built page with Playwright at 375x812 and 1280x800, light and dark, with axe-core on directory, My info, tracker and the guided run (0 violations in all 16 runs), and ran email.js against the real data. Screenshots: scratchpad `shots/review-e-*.png`.

Owners: **builder A** = app files (email.js, profile.js, guided.js, tracker.js, directory.js, css, build.mjs, build/email tests). **builder B** = workflows, `scripts/check-links.mjs`, its test, `docs/automation.md`.

## Verified OK
- Zero network requests in every run, including Gmail-filter download, ICS download, mailto click and the guided run. No `fetch`/XHR added. CSP unchanged and still correct (mailto and Gmail links are plain navigations).
- Gmail filter XML is well formed (parsed with a real XML parser), values are escaped, and the structure matches Gmail's export format (`feed`/`entry`, `category term="filter"`, `apps:property name="from|to|label|shouldArchive"`).
- `plusAddress` handles `a+b@`, uppercase domains, quoted/space/`@@`/no-dot inputs (returns ''), and replaces an old `+suffix`. mailto encodes `+` as `%2B`, `@` kept, and stays under 1,900 chars.
- ICS: required fields present, CRLF, folding at 75 octets without splitting characters, comma/semicolon/newline escaped in SUMMARY, invalid dates (2026-02-31) skipped, date math in UTC so no timezone shift.
- Build allowlist in `tests/build.test.mjs` is exact-match, not prefix: four extra entries, each justified.
- Workflows: top-level `permissions` are minimal (ci: `contents: read`; link-check adds only `issues: write`), no `pull_request_target`, the only expression in `env:` (not interpolated into script text), cron `17 14 * * 1` is valid, a first-run `link-check` label is auto-created by `issues.create`, `git diff --exit-code` works on a fresh checkout.
- Tag map: 37 programs, all unique, `[a-z0-9-]`, max 24.

## Findings

Counts: high 2, medium 7, low 9.

### Builder A (app)

1. **HIGH, `src/js/email.js:84-85,91` + `tracker.js:371-374`. Gmail filters match the whole domain, and "Skip the inbox" then archives all of that company's mail.** With plus tags off (the default) every filter is `from:<signup hostname>`: `amazon.com`, `target.com`, `walmart.com` (x2), `enfamil.com` (x2), `healthcare.gov` (x3). Importing with "archive" ticked hides the person's Amazon/Target/Walmart order and shipping mail from the inbox, and labels it "Baby Freebies/...". Reproduced: default profile, Download Gmail filters gives 37 `from` entries including `amazon.com`. Fix: do not offer archive unless plus tags are on (then `to:` is specific); with `from` filters, drop the archive option or warn "this also matches order emails from Amazon"; skip big retailers (amazon, walmart, target) for from-filters; de-duplicate identical `from` values (healthcare.gov x3 creates 3 labels on the same mail).

2. **HIGH, WCAG 2.1.4 Character Key Shortcuts (Level A), `guided.js:~410-430` (`onKey`). Single-letter shortcuts are always on, cannot be turned off or remapped, and D/S change data.** Verified: pressing `d` anywhere in the run view (no focus in a field) marks the program signed up and opens the next page; `s` works with focus on a `<summary>`. Screen-reader and voice-control users (and anyone resting a hand on the keyboard) will trigger these accidentally; there is no undo. Fix: ship them off by default behind a checkbox "Enable keyboard shortcuts" (stored in `guided.v1`), or require a modifier (Alt+Shift+letter); never let D/S act without a visible confirmation or Undo.

3. **MEDIUM, `guided.js` (Done handler `~333-345`). Auto-open opens duplicate tabs and gives a false confirmation.** Verified: Done on program 1 opens program 2; Back; Done again opens program 2 a second time. Skip, Next and Back never open anything, so after a Skip the person lands on a program with no tab opened (inconsistent). `window.open` with `noopener` always returns `null`, so a blocked popup is undetectable, yet the live message says "Opened the ... sign-up page in a new tab." Fix: remember per run which ids were opened (`run.opened`) and skip already-opened ones; make Skip behave like Done for opening, or document it; word the message "Trying to open..." and keep "Popup blocked? Use the plain link" visible; consider an anchor click rather than `window.open`.

4. **MEDIUM, `guided.js` (`BFF.guided.preselect`) + `directory.js:109-113`. "Start a guided run with these N" silently discards a run in progress** (`run = null; saveRun()`), including the position in the list. Verified: start a run, mark one done, go to Programs, tap the button: the run is gone and the setup shows the new selection. Fix: if a run is active, ask first ("You have a run in progress at 3 of 9. Replace it?") or add the filtered ids after resuming; label the button "Start a new guided run with these N".

5. **MEDIUM, `tracker.js` icsReminders caller `~392-399` + `setNote` (`tracker.js:~100`). The reminder date is "28 days after the last edit", not after signing up.** The code uses the entry's `updatedAt`, and `setNote` rewrites `updatedAt`. Editing a note (or Done in guided after another change) moves the reminder. Fix: store a `signedUpAt` when status first becomes `signed-up` and use that; or only update `updatedAt` on status changes.

6. **MEDIUM, `email.js:21-45` (`tagMap`). Tags are not stable when the data changes, and some are not readable.** Sorting by id and giving the plain base to the first id means adding or renaming a program shifts others: adding id `a-first` with brand "Similac Test" changes the existing Similac tag `similac` to `similac-mysimilac`, so the person's earlier plus-addressed sign-ups and Gmail filters stop matching. Readability: `1-natural-way...` gets tag `1`, lactation-network gets `the`, 211.org gets `united`, head start `head`, home tester `home`, `national`, `safe`, `procter`. Fix: persist the assigned tag per program id in `profile.v1` (or in a hard-coded `tags` field in the data) the first time it is used and never reassign; derive the base from the id's first non-stopword segment (skip `the`, digits-only, `home`, `national`) or add a `tag` field to `data/programs.json`.

7. **MEDIUM, `email.js:54-57` + 84-85. `from:` uses the signup hostname (e.g. `register.gerber.com`, `cert.safekids.org`, `fna.usda.gov`) instead of the registrable domain.** Real program mail comes from `@gerber.com`, `@e.gerber.com` etc., which `from:register.gerber.com` does not match (Gmail matches substring of the address), so the filter catches nothing. Same for `gmailSearchUrl` (`from:(register.gerber.com)`). Fix: use the registrable domain (reuse the logic in `check-links.mjs`'s `registrableDomain`, or a small helper), e.g. `gerber.com`, `safekids.org`, `usda.gov` (and accept that bare `usda.gov` is broad: prefer `to:` with plus tags).

8. **MEDIUM, `guided.js:~46-52` (`taggedEmail`/`detailList`). With plus tags on, the plain email is no longer offered in the run.** "Email for this program" replaces "Email"; some sign-up forms reject `+` in addresses and the person must leave the run, switch the toggle off and come back. Fix: show both rows ("Email for this program" and "Email (plain)").

9. **LOW, `tracker.js:~364-376` mailto. The checklist always lists every non-skipped program, including ones still "To do", and for the 37-entry list is always truncated** (about 12 entries fit; 1,807 chars). The full text is copied via the clipboard, which failed in headless; the message then tells the person to paste something that is not there. Fix: default to programs with status Signed up / To do after the person started (or only non-todo), and use a `Blob` download or visible textarea as the fallback when the copy fails. Also no handler on desktops without a mail client: "Opening your email app" is shown regardless.

10. **LOW, `tracker.js:~330` (`syncEmailBits`). The Gmail search link hard-codes `/mail/u/0/`.** For people signed in with several Google accounts where the address is not the first, the search runs in the wrong account. Fix: add a one-line note, or link `https://mail.google.com/mail/#search/` (no `u/0`).

11. **LOW, `guided.js:onKey`. No `e.isComposing` check and `e.key.length === 1` also accepts non-Latin keyboard layouts' mapped keys.** Minor; fix with `if (e.isComposing) return`.

12. **LOW, `profile.js:~75-90`. The plus preview is a polite live region that rewrites on every keystroke in the email field** (noisy for screen readers; also shows "(for 2-1-1...)" using `progs[0]` which looks arbitrary). Fix: remove `role="status"`, update on blur/checkbox change, and use a fixed friendly example such as the Similac program.

13. **LOW, `ARCHITECTURE.md` Phase E vs code. Contract drift:** the contract says Yahoo "return false"; code returns a tagged address for Yahoo from `plusAddress` (UI guards it, but `gmailFiltersXml` with `usePlus` is guarded only by the caller). Also `gmailFiltersXml` takes an `allPrograms` option that the contract does not list, and the filters apply to all non-skipped programs, not to chosen ones. Update the contract or add a "choose programs" step.

### Builder B (workflows, checker, docs)

14. **MEDIUM, `scripts/check-links.mjs:40-48,57-66`. A "bot challenge" body hides real failures.** The challenge regex (`captcha`, `access denied`, ...) runs before the off-domain and soft-404 checks and over the first 64KB of any page, so a legitimate page that merely contains a reCAPTCHA script is BLOCKED, and a redirect to a different site whose HTML mentions captcha is never reported as OFF-DOMAIN. Reproduced: `classifyDetailed({status:200,startUrl:'https://a.com/x',finalUrl:'https://evil.example/',bodySnippet:'captcha'})` returns `BLOCKED`. Fix: run the off-domain check first (host change is independent of body), and only treat the body as a challenge when status is 403/429/503 or the title matches `just a moment|attention required|access denied`.

15. **MEDIUM, `check-links.mjs:58`. Every network error is BLOCKED, so a dead domain is never reported.** `ENOTFOUND`/`ECONNREFUSED`, expired certificates (`CERT_HAS_EXPIRED`) all exit 0 and no issue is opened. Fix: classify DNS-not-found (`ENOTFOUND`, `EAI_AGAIN` x3 retries aside) as NOT-FOUND, keep timeouts and resets BLOCKED.

16. **LOW, `check-links.mjs:196-197` + `link-check.yml:105-108`. A crash is indistinguishable from a real failure.** An uncaught exception also exits 1, so the workflow opens the issue titled "programs need attention" with the placeholder "did not produce a report". Fix: wrap `main()` in try/catch exiting 3, pass the exit code to the script step (`echo "code=$?"`), and for code 3 post a different title/comment ("checker crashed, see run") or just fail the job without touching the issue.

17. **LOW, `link-check.yml:79-82,86-87`. Issue lookup edge cases.** `per_page: 1` then `find(!pull_request)` can miss the real issue when a PR carries the same label; no `concurrency:` group so a manual run overlapping the schedule can open two issues; a persistent failure adds a 60KB comment every week. Fix: `per_page: 30`, add `concurrency: link-check`, and only comment when the failing set changed (or edit the issue body instead of adding comments).

18. **LOW, `check-links.mjs:17-21`. The `fns.usda.gov -> fna.usda.gov` allowlist entry is dead:** `registrableDomain('fns.usda.gov')` is `usda.gov`, so the pair never matches (the redirect is accepted only because both reduce to `usda.gov`). It also means any `*.usda.gov` host is "expected". Fix: remove the entry, or compare full hosts for the allowlist.

19. **LOW, `check-links.mjs:107-121`. `http:` downgrades and a final non-https URL pass as OK** (`https://a.com` -> `http://a.com/` returns OK). Fix: treat a final `http:` URL as OFF-DOMAIN or add a WARN class.

20. **LOW, `ci.yml` / `link-check.yml`. Hardening.** Actions are pinned to tags (`@v4`, `@v7`), not SHAs; `checkout` keeps credentials (`persist-credentials: false` is enough for both jobs). `git diff --exit-code` does not catch an untracked `index.html`, so use `git status --porcelain` or `git diff --exit-code && test -z "$(git status --porcelain)"`.

Checker behaviour that is good: honest UA with repo URL, `redirect: 'manual'` with an 8-hop cap and per-request `AbortSignal.timeout(20s)`, 64KB body cap with `reader.cancel()`, one request at a time with 1.5s spacing, no retries, BLOCKED never fails, unknown flags exit 2.

## Accessibility of the new controls
axe clean in both themes at both sizes. Targets: all new buttons and links are at least 44px; archive and include-profile checkboxes are 24px but sit in 44px label rows. Focus moves to the program title after each guided action. Remaining issues are items 2, 3 (announcement says "Opened" even when blocked) and 12.

## Optional
- `email.js:15` unused `str` branches; `isGmail` could also cover `googlemail.com` display name; fine as is.
- ICS `DTSTAMP` is set to the event start date (stable, so deterministic builds) but is meant to be creation time; harmless. Add `X-WR-CALNAME:Baby freebies` and a `VALARM` for a better calendar experience.
- The ICS builder returns an empty VCALENDAR (invalid per RFC 5545, needs at least one component) when no entries are valid; the UI guards the zero-entry case, but guard in `icsReminders` too.
- `mailtoChecklist` uses `\n` in the body; RFC 6068 prefers `%0D%0A`.
- `docs/automation.md` mentions NODE_USE_ENV_PROXY; also note the Monday run is UTC and that Actions disables scheduled workflows after 60 days without repo activity.
- `tests/email.test.mjs` has no tag-stability test, no archive-warning test, and no test for `gmailFiltersXml` with duplicate domains.
