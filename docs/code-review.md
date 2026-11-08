# Code review: Baby Freebies Finder

Reviewed at commit 0cfc4ea. Method: read all source, tests and tools; rebuilt `index.html` (byte-identical to the committed file, so the build is deterministic); drove the built page with Playwright at 375x812 and 1280x800, light and dark, keyboard-only, with axe-core 4.x on every view (axe reported 0 violations in all 20 runs; the issues below are ones axe cannot see). Screenshots are in the scratchpad `shots/review-*.png`.

## What passed (verified)
- Zero network requests in all four viewport/theme runs and while exercising import, export and sign-up buttons. CSP and referrer metas match ARCHITECTURE.md exactly.
- No `innerHTML`, `insertAdjacent*`, `eval`, `fetch`, XHR, WebSocket, beacon or `new Image` anywhere in `src/`. An imported note of `<img onerror>` stays text.
- Every external link has `target="_blank" rel="noopener noreferrer"`; `window.open` passes `noopener,noreferrer`. Links come only from `signupUrl` / `sourceUrls`. The only `http://` string in `index.html` is the SVG namespace inside the favicon data URI.
- Export contains My info only when the box is ticked (and a warning shows). Download works under the CSP.
- localStorage throwing, corrupt JSON in all five keys, a guided run with vanished ids, and a stale `index` all degrade cleanly with no page errors.
- No horizontal scroll at 320px. Content at the bottom of every view clears the fixed nav. No double-bound listeners (the document listeners are added once in `init`).
- Autofill code never clicks, presses Enter or submits; it is plain headed Chromium with no stealth; `--headless` is only allowed with `--fixture`.

## Findings

Severity counts: high 3, medium 8, low 11.

### Builder 1: build.mjs, index.html, base.css, logic.js, directory.js, app.js

1. **HIGH, `src/js/app.js:246-248,309` + `src/index.html:71`. The "Skip to content" link switches you to the Programs view.** The link's `href="#main"` changes the hash; `currentView()` treats the unknown hash as `directory`, so the router hides the current view and shows Programs, then moves focus to its h2. Repro: open `#tracker` (or #info, #guided), press Tab, Enter on the skip link; Programs appears. Keyboard and screen-reader users lose their place on every use. Fix: handle the skip link with a click handler that calls `preventDefault()` and focuses `#main` (give `<main>` `tabindex="-1"`), or have `route()` ignore hashes that are not view names and keep the current view.

2. **HIGH, `src/css/base.css:308-313` (+ features.css:384). The fixed bottom nav hides the "Open sign-up page" button in the guided run at 375x812.** Measured: the button spans y=748-804 and the nav starts at y=752, so only 4px shows. The title is at y=283 and the header takes 176px. The primary action of the guided flow is effectively off-screen on first view, and "Done/Skip" are at y=1724 (two screens down; the Your details list has 14 rows). See `review-m-light-guided-run.png`. Fix (builder 2 owns features.css, builder 1 owns the header): shrink the header (item 3), and move "Open sign-up page" above the description or make a sticky action bar (Open / Done / Skip) that sits above the nav; collapse the details list behind a `<details>` or two-column grid.

3. **MEDIUM, `src/index.html:72-81`, `base.css:291-294`, `directory.js:399-411`. The first program card is not visible on the Programs view at 375x812.** Header is 176px (the promise paragraph wraps to 4 lines next to the theme button), then h2, then a 429px filter panel; the first card starts at y=707 and the nav covers from y=751, so about 44px of the card title shows. Fix: on phones shorten the promise to one line or move it to the footer, put the theme toggle in the footer or make it an icon button, put Search on one row and make Category/Sort/checkboxes collapse inside a `<details>Filters</details>` (closed by default), and lay the checkboxes in one row. Target: first card heading visible with room for its badges at y<600.

4. **MEDIUM, `base.css` (no `scroll-padding-bottom`), `features.css:390`. Fixed nav and sticky bar hide the focused element (WCAG 2.4.11).** Tabbing in My info, Tracker and Do it for me leaves focused inputs partly or fully under the nav (e.g. My info state select at y=720-764 with nav at 751; Tracker textareas at 744-810; guided checkboxes under the sticky Start bar at y=684). Fix: `html { scroll-padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 80px); }` (or add 72px more where `.fx-sticky` exists), and in the desktop media query set scroll-padding to 0.

5. **MEDIUM, `src/js/app.js` / `src/index.html`. Section accessible names are broken for three views** (reported against app.js because the contract is the router + shell; the fix lives in builder 2's files, see 14). `#view-info`, `#view-tracker`, `#view-guided` keep `aria-labelledby="h-info|h-tracker|h-guided"` but each view's `init` runs `el.textContent = ''` and rebuilds the h2 without the id, so the reference dangles. Fix: in builder 2's inits keep the existing h2 (don't clear it) or set `id`. Also have `app.js` assert this in `boot()` in dev.

6. **LOW, `directory.js:504-507`. Every card's status select is labelled just "My status"** (37 identical labels), so screen-reader users hear no program name. Same for the 37 checkboxes' unnamed context in the guided view (those do have names). Fix: `aria-label="Status for " + p.name` (or visually hidden text in the label).

7. **LOW, `directory.js:491,498`, `base.css:391-392`. Source links are 19px tall and open new tabs without saying so.** The "Notes and sources" links (87 of them) fail the 24px minimum target (WCAG 2.5.8) and the arrow glyph is read aloud. Fix: give `.source-list a` `display:inline-block; min-height:24px; padding:2px 0` (44px preferred) and add visually hidden "(opens in a new tab)"; mark the glyph `aria-hidden`.

8. **LOW, `src/index.html:83-93`. DOM order puts the nav (5 links) before `<main>`, while the nav is visually at the bottom on phones.** Keyboard users tab through the theme button and 5 nav links on every page before reaching content (WCAG 2.4.3 meaningful sequence). Fix: keep it but make the skip link work (item 1) and add a second skip target, or move `<nav>` after `<main>` in the DOM (it is `position:fixed` on mobile) and use `order` in the desktop layout.

9. **LOW, `base.css:319`. Nav labels are 11px** (`.6875rem`), the smallest text in the app. Fix: 12px minimum, shorten "Do it for me"/"Spot a fake" if needed.

10. **LOW, `scripts/build.mjs:13-19,27`. Missing optional source files are skipped with a warning and exit code 0.** If `features.css` or a JS file is deleted or misspelled, the build silently emits a broken page. Fix: treat every file in `CSS`/`JS` as required (throw), which also matches ARCHITECTURE.md's fixed order.

11. **LOW, contract: `tests/` vs `ARCHITECTURE.md` "Tests" section.** The doc promises tests for the data schema, https/official links and dates, `index.html` equal to a fresh build, and no external URLs; none exist (only `logic`, `store-tracker`, `autofill-matcher` tests). I verified manually that the build is byte-identical and that data is clean (37 programs, unique ids, https, ISO dates), but nothing will catch a regression. Fix: add `tests/build.test.mjs` (rebuild into a temp dir or compare output of the build function with `index.html`; regex check for `src=|href=|url(|@import` with http), and `tests/data.test.mjs`.

### Builder 2: store.js, tracker.js, profile.js, guided.js, features.css

12. **HIGH, `src/js/store.js:158-186`. After one failed write (quota exceeded), reads return stale data and the app reports success.** `set` writes `mem[key]`, then if `ls.setItem` throws it sets `persistent=false` but `get` still prefers `ls` whenever `ls` is non-null, so it returns the old stored value, not the new one. Verified: with `setItem` throwing, `setStatus(id,'skipped')` then `getStatus(id)` returns the earlier `'received'`. Verified with a 60,000-entry backup: the page said "Restored: 60000 entries imported", `tracker.all()` still had 2 entries and localStorage was unchanged. The "browser isn't saving" notice is only shown at boot (`app.js:292`), never after a later failure. Fix: in `get`, read `mem` first when `store.persistent === false` (or set `ls = null` on failure); return the success boolean from `set`; show/announce the notice when `persistent` flips (dispatch `bff:storage-failed`); make `importJSON`, `setStatus`, `setNote` and profile saves surface `set()`'s result ("Could not save: storage is full").

13. **MEDIUM, `src/js/tracker.js:30-57,310-332`. Importing has no size limits.** A multi-MB or 60,000-entry file is read and parsed entirely (about 0.5s for 8MB here, minutes for hundreds of MB), then the merged state is written to localStorage, hitting the quota (item 12) or filling it with junk ids that are kept forever ("unknown programs are kept"). A 3MB note is accepted. Fix: reject files over about 1MB before `readAsText`; cap entry count (e.g. keep only ids in `BFF.programs`, or max 500); truncate notes to 2000 (matches the textarea `maxlength`); cap profile strings to about 200 chars and only keep the 10 known profile keys; drop `__proto__`/`constructor` keys (`parseBackup` currently loses a `__proto__` entry silently while counting it as imported, line 46; use `Object.create(null)` or `has()` + skip).

14. **MEDIUM, `tracker.js:267`, `profile.js:435-437`, `guided.js:333-335`. The inits wipe the shell's h2** (see 5). Fix: remove `el.textContent = ''`, append after the existing h2, or re-set `id="h-info"` etc. on the recreated h2.

15. **MEDIUM, `guided.js:273-275`. "Done" and "Skip" overwrite an existing status.** "Select all" in setup includes programs already `received`; clicking Done then downgrades them to `signed-up` (verified with a seeded `received` entry), and Skip replaces `received` with `skipped`. The saved note and `updatedAt` change too. Fix: in the run view show the current status and, for non-`todo` programs, hide Done/Skip or only upgrade (`todo`→`signed-up`) and never downgrade `received`; or confirm.

16. **MEDIUM, `guided.js:343-346` (`show`). The program selection resets every time you come back to the Do it for me tab.** `show()` calls `initSelection()` whenever no run is active, then re-renders, so unticking programs and switching tabs (or hitting "Fill in My info", which is the link offered in this same view) loses the choices. Verified: "Select none", visit Tracker, return: "9 of 37 selected". Fix: only call `initSelection()` when `selected` is null or after Start over; keep `selected` in memory (or `guided.v1`).

17. **MEDIUM, `tracker.js:197-198,247`. Changing a status while a status filter is active hides the row that has focus, and focus drops to `<body>`.** Repro: Tracker, filter "To do", Tab to a row's Status select, choose Received; the row vanishes and focus is lost (verified: `document.activeElement` is BODY). Fix: when `applyFilter` would hide the focused row, move focus to the next visible row's select (or the filter button) and announce "Moved to Received" in a live region; or keep the row visible until the filter changes.

18. **MEDIUM, `profile.js:420,427`. A due date that is not `YYYY-MM-DD` is silently wiped.** `<input type="date">` rejects other values, so `fill()` shows blank, and the next edit of any other field runs `saveNow()`, which writes `dueDate: ''`. Reproduced with an imported backup containing `"dueDate":"03/05/2027"` (the import accepts any string): after editing First name the stored dueDate became empty. Also `guided.js:42-44` and the autofill matcher then fail to format it (guided shows it raw). Fix: normalize on import and in `fill()` (parse MM/DD/YYYY, M/D/YY, "March 5, 2027" to ISO manually, never `new Date(str)`), keep unknown values in a text fallback, and in `saveNow` don't overwrite stored fields whose inputs could not represent the value. (No `new Date('YYYY-MM-DD')` is used anywhere; `today()` and exports use local-date parts, so there is no timezone shift. Good.)

19. **LOW, `profile.js:413-416,455-456`. Validation messages are not exposed as errors.** The email/ZIP hint is plain text in a `role="status"` span with no `aria-invalid`, no error icon or colour-independent marker, and ten separate live regions exist on the page (11 total). Fix: set `aria-invalid="true"` while the hint shows, prefix with "Check this: ", and drop `role="status"` from the hints (one shared live region is enough).

20. **LOW, `profile.js:424-431,485-487`. Debounced profile save (400ms) is not flushed on `pagehide`/`visibilitychange`**, so closing the tab right after typing loses the last edit. Tracker notes flush on blur but not on `pagehide` either. Fix: flush in `visibilitychange` (hidden) and `pagehide`.

21. **LOW, `tracker.js:323,335`, `profile.js:474`. `window.confirm` is the only guard for restore, reset and clear.** Inside sandboxed iframes (Claude artifact preview, some embeds) `confirm` can return `false` immediately without a prompt, so those buttons silently do nothing and the user sees "cancelled" or no feedback. Fix: use an inline two-step confirm (button turns into "Really reset? Yes / Cancel"), which is also more accessible.

22. **LOW, `features.css:390`. `.fx-sticky { bottom: var(--nav-h) }` also applies on desktop (>=720px) where the nav is static**, leaving a 60px gap under the sticky Start bar (bar bottom at y=740 of 800). Fix: reset `bottom` to 0 in the `min-width:720px` media query.

### Builder 3: tools/autofill

23. **MEDIUM, `tools/autofill/field-matcher.mjs:306-327`. The matcher fills the user's own details into fields about other people or other things.** Checked with a script: "Last menstrual period (LMP)" gets `lastName`; "First time parent?" gets `firstName`; "Phone type" gets the phone number; "Doctor's phone", "Gift recipient email", "Spouse email" and "Business address" all get the user's email/phone/address, because the `OTHER_NAME` check (line 322) runs after the email/phone/address branches. Fix: apply `OTHER_NAME` first for every kind (not only names), use whole-phrase matches (`first name`, `last name`, not bare `first`/`last`), require the word `type`/`menstrual`/`time` not to be present, and add the cases to `tests/autofill-matcher.test.mjs`.

24. **MEDIUM, `tools/autofill/autofill.mjs:72-91`. Honeypot and off-screen fields are filled.** `scanFrame` only skips `display:none`, `visibility:hidden` and elements under 2px, so fields hidden with `opacity:0`, `position:absolute; left:-9999px`, `clip`, `aria-hidden="true"`, `tabindex="-1"` + off-screen, or inside a hidden ancestor with zero offset are filled. Filling a honeypot is what bot checks look for and can get the user flagged or blocked, and it puts details into fields they cannot see. Fix: also skip when `opacity` is 0, when the element is not within the document's scrollable bounds, when `aria-hidden` or `tabindex="-1"` and not focusable, or `!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})`.

25. **LOW, `autofill.mjs:229-234`. No check that the page you land on is still the program's official domain.** The `signupUrl` is validated, but the page may redirect (or JS-navigate) to a different host, and `fillPage` then fills personal details there. Fix: after `goto`, compare the final registrable hostname to `signupUrl`'s; if different, print a warning and ask `y/N` before filling (and only fill the main frame's origin, which is already so).

26. **LOW, `autofill.mjs:140-141,167`. Page-controlled text is printed raw to the terminal** (labels, names, ids, placeholders). A hostile label with ANSI/OSC escape sequences can rewrite the terminal. Fix: strip `[\x00-\x1f\x7f-\x9f]` and truncate to ~80 chars before printing.

27. **LOW, `autofill.mjs:204-206` vs `src/js/logic.js:45-61`. `--all-free` uses `costToClaim === 'free'` only**, so it includes programs that need a purchase, membership, insurance or an eligibility check; the app's own "guided default" excludes those. Fix: share the `guidedDefault` rule (copy the 6 lines, as the helper can't import from `src/js` in a browser bundle) and update the README line.

28. **LOW, `autofill.mjs:146-149`. Selecting an option or filling a field can fire page `change`/`input` handlers that auto-submit** (a few sites submit when a state `select` changes, or on a single-field step). The README's "never submits" holds for the tool's own actions, but it can't promise that page scripts won't. Fix: add one README sentence saying so, and don't fill `select` elements that have an `onchange`/`data-auto-submit` attribute.

## Optional (nitpicks)
- `guided.js:223-224` print `undefined` if `brand` or `whatYouGet` were ever missing (`textContent = undefined`). Data currently always has them; default to `''` like `tracker.js:226`.
- `tracker.js:112` unused `var s = state();` in `counts()`.
- `store.js:175` `JSON.stringify(undefined)` stores the string "undefined"-ish `undefined` in `mem`; guard `value === undefined`.
- `app.js:293` the storage notice should also be set on later failures (see 12); `role="status"` on a `hidden` element at load may not announce when un-hidden in some SRs, so toggle text after unhiding.
- Theme toggle label changes are not announced; add a polite live message "Theme: Dark".
- `directory.js:392-394` the 150ms debounce re-renders all 37 cards on each pause; fine now, but reuse DOM nodes (toggle `hidden`) if the list grows.
- `directory.js:374` ids `dir1-q` use a module counter; harmless.
- `index.html` has no `<noscript>` message; with JS off the page is a blank shell under the footer text.
- No `autocomplete` tokens on `dueDate` (`off` is fine); consider `bday` is not appropriate here, so no change.
- `tools/autofill/package.json` pins `playwright@1.49.1` but has no lockfile; commit `package-lock.json` or note it.
- Dark theme token block is duplicated verbatim (`base.css:200-248`); generate it in `build.mjs` or use one `:root[data-theme]` + `@media` pair via a mixin to avoid drift.
