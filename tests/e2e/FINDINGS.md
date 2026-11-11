# E2E findings

Phase G update (2026-11-10): the suite now has 983 checks and the last full run had 0 failed. The first run on the Phase G app had 9 failures. All 9 were old test expectations that the Phase G design changed; none was an app bug. Details below.

## Bugs
None found. No console or page errors, no network request of the app's own, no horizontal scroll (390, 375 and 320 wide), no unexpected link, no stored data touched by a Cancel, and no form submit or click from the fill script in any run.

## What the 9 failures were (all test expectations, all fixed in the tests)
1. Group 3, six failures (standalone, artifact full, artifact none, each for "every program card links to its signupUrl" and "every sourceUrl is shown in its card"). Programs for other states are now hidden until a state is set or "Show them" is used, so only 87 or so of the 142 cards existed. The audit now checks the hiding rule, uses "Show them", and counts every card, including the ones inside the closed `details.same-group` (it reads the DOM, not visible text).
2. Group 8, two failures ("similac with plus addresses", "target subdomain with plus addresses"). By design, similac.com and target.com each list two programs with different tags, so the fill script uses the plain address. The plus-address checks now use a domain with one program that passes `inEmailFeatures` (picked from the data in code), keep a subdomain case, and new checks assert the plain address on similac.com, enfamil.com, registry.target.com and on a government domain (tn.gov).
3. Group 9, one failure (it stopped the group). The test looked for the status select of `babys-only-free-sample-shipping` on a directory card after a reload, but "Truly free" was still on from earlier in the test and that program has a shipping fee, so the directory correctly did not list it. The test now looks in the Tracker (which lists every program) and, in the directory, only at programs that Truly free still lists.

## New in Phase G
Groups 11 and 12 and new cases in 3, 8 and 9. See `README.md` for the list. Dates are relative to today and every count comes from `lib/model.mjs`.

## Earlier findings, now fixed in the app (checked in the source)
- The copy fallback now focuses and selects the text (`src/js/host.js`).
- The draft message now reads "Draft saved in your Gmail. Nothing was sent."
- The fill-script download says "Downloaded ... Look in your Downloads." like the tracker.
- Guided "Start over" now asks inside the page (group 12 checks this and that no `confirm()` dialog opens).

## Doubtful behaviour seen (not failures)
- The due-date buttons have the visible text "30 do now" and hidden text ", show these programs". Chrome builds the accessible name as "30 do now , show these programs" (a space before the comma), because the hidden text is absolutely positioned. Screen readers speak it the same. The test accepts the optional space and checks the words and the count. If a tidy name matters, wrap the whole label in one `aria-label` instead.
- Without a state, the "Show them" text reads "N programs only for some states are shown." This is clear but long; no action needed.

## Suspects (informational)
- **Buttons that visibly did nothing:** none found. Every visible, enabled button on every route (and in a guided run in progress) is clicked on a fresh load in both outputs.
- **Flaky check seen once:** in one full run, "state TX: the Show them choice is remembered after a reload" and the check after it failed in the artifact output, and did not fail in four later runs of group 11. The reload check now waits up to 4 seconds for the list to be drawn. If it comes back, look at whether the reload read `bff.prefs.v1` before the write finished.
- **Fill script contract:** the script embeds exactly the ten My info keys plus `{domain, id, name, email}` per program. With plus addresses on, `email` is set only for programs that pass `inEmailFeatures`. On a domain with two or more listed programs the runtime uses the plain address. Both are tested.

## Not tested here
Real iOS Safari (WebKit behaviour, the Shortcuts "Run JavaScript on Web Page" action, bookmark saving), the real claude.ai viewer (its actual `claude.use`, sandbox, save prompt and consent card), real Gmail (the mock follows the type files and the shapes in `ARCHITECTURE.md`), real program sites (all fixtures are synthetic), and screen readers (only the accessible-name, label, focus and contrast checks).
Phase G specifically not covered: the phone view's own tagged addresses (`phone.js`) beyond the fill script, the `tools/autofill` helper, the Gmail connection's use of `inEmailFeatures` for its searches and labels (only the filters file and the tracker links are compared with the module), and states other than TX and "no state" in the directory.

## Phase I (2026-11-11)

Group 14 and the updates to groups 1 to 13. `README.md` has the group list and the last full run.

### App bugs
None found. In every run: no console or page error, no network request of the app's own, no horizontal scroll at 320 and 390 with each notice form showing, localStorage holding only the four `bff.*.v1` keys, and the My info hand-off storing nothing.

### What changed in the old groups (all test expectations, none an app bug)
- The Tracker tool folds (Email and calendar, Check Gmail, Backup and restore) and the My info phone fold start closed. Groups 5, 6, 7, 8, 12 and 13 now open them through `openTools` / `openPhoneFold` first, and look for messages in `details.fx-fold` instead of `.fx-card`.
- Rows are the person's own list: scoped, ranked, tabbed, and the note, address and "Search my Gmail" are in a Details panel built on first open. Groups 6, 9 and 12 use the All tab with "Show all N programs", `revealRow` and `openRowDetails`. Groups 3 and 4 still audit and click every sign-up and Gmail link on the Tracker (`showAllRows` + `openAllPanels` in `enterRoute`); group 4 clicks every fourth Tracker external link and every fifth Details button to keep the run short.
- Programs header: the estimate note is part of the main line, "N more are free if you qualify." lost its brackets, and the "Answer four quick questions" prompt and the "N programs fit your answers" line are gone on purpose. Group 11 checks the new main line (estimate note and the no-value count inside it). Group 13 checks that no `.sum-situation` exists, that the missing-info notice asks for the answers instead, and that the answers box says how many are hidden. `model.summaryFor` now takes the profile because "more are free" skips programs the answers rule out.
- Do it for me list: one row per group, other ways folded, optional section last. Group 12 now expects groups together with the optional section last, at most one default tick per group, "N of M selected" counted in groups, and "Truly free only" ticking the lead of each group only.

### Odd, not an app bug
- **The browser sometimes empties a file: page's whole localStorage, and an init script that touches localStorage makes it likely. The evidence points to the browser, not the app.** Seen as `bff.prefs.v1` being null after a reload although it was there a moment before. Measured with a bare page (one button that writes a key, no app code), the test writing a second marker key itself, a fresh context per try, one run at a time, headless Chromium through Playwright 1.63.0. In every loss the marker was gone too, so the whole store was empty, not one key. (1) With an init script that reads or writes localStorage on a file: page: 38 of 200 tries lost (read and write), 63 of 200 (read only), 56 of 200 (write only), 36 of 200 in the full Chromium build, 34 of 150 in a persistent profile, 32 of 150 with a 2 s wait before the reload, 26 of 150 with a 1 s pause after closing each context. The real app page with the old harness: 17 of 200, 17 of 150 and 31 of 200. (2) With no init script that touches storage (file: page): 3 of about 2,700 tries lost (bare page 1 of 1,000 and 0 of 300, an init script that touches nothing 1 of 300, persistent profile 1 of 850, the app page 0 of 250). (3) Served from http://127.0.0.1: 0 of 2,900 (bare page 1,000, persistent profile 1,000, the app page in a persistent profile 500, with an init script that touches storage 400). That bounds the rate on http at roughly 0.1 percent or less; it does not prove it is zero. Letting the page's own scripts record their Storage calls showed that in the 31 app-page losses no script removed or cleared anything. What is not known: why the browser does it. Not measured: https, the Claude artifact viewer, a phone browser, another Chromium version, several runs at once. Case (3), a page served from a web address instead of opened from a file, is the nearest measured case to how people open the app; no loss was seen there, in a limited sample.
- How the suite handles it: no init script touches localStorage any more (`open({ profile, seed })` writes the values from a blank page first), and `reloadAfterWrite` and `guardedReload` check an empty store against the record of the page's Storage calls. A script that removed or cleared data fails the group at once; otherwise the group runs once more from the start, the first attempt is not counted (check counts do not change), and a second loss fails. The old repeat loops and reload-four-times retry are gone: a reload never brought the data back. In the last full run no group repeated: 3728 checks, 0 failed.
- Today's `data/programs.json` has one group with more than one member (the breast pump group) and none of its members is ticked by default in Do it for me, so "none in a group already signed up for" and "at most one tick per group" have nothing to bite on. Group 14 (I3) therefore patches the page's own copy of the data (a wrapped `JSON.parse` that makes one default program an "other way" of another) and checks the rule on that. If the data gains a real group with default programs, both checks apply to it as well.
- With no state set, the Tracker and Do it for me notices count programs that are limited to a state although the lists leave them out. This is by design (the number is the same on every page) and is tested as such.
- The Tracker's "mail" and "plus address" hints are inside the Email and calendar fold, so they cannot be seen until it is opened. Tested as such (I6 opens the fold first).
- Group 4 lists "All (6)" on the Programs page as a button that changed nothing visible. `open()` already presses the All tab (Phase H), so pressing it again is expected to change nothing. It is reported, not failed, as before.

## Phase J (2026-11-11)

Group 15 (J1 to J10) and the port of groups 1 to 14. `README.md` has the group list and the last full run.

### App bugs
None found. In every run: no console or page error, no network request of the app's own (a run that opens the next sign-up page is the one thing the browser tries on purpose; J8 turns that option off), and no stored key other than the four `bff.*.v1`.

### What changed in the old groups (all test expectations, none an app bug)
- The Programs boxes `.dir-state` and `.dir-fit` and their "Show them" / "Hide them" buttons are now `details.dir-hidden` with a Show / Hide button per reason (groups 3, 11, 13). The old checks "the choice is remembered in prefs" became "the choice is never saved, and everything is hidden again after a reload".
- A program that is signed up, received or marked not for me is hidden on Programs and in Do it for me (reasons done, not for me). Group 13's "a tracked program is never hidden" became "a marked program leaves the list under its own reason, and showing that line brings it back with the Does not match badge". Group 12 / I3 expect a signed-up group (and its covered other ways) to be absent from the Do it for me list; the patched-data checks expect the same.
- `prepare()` (groups 3 to 10) sets the three statuses in the page while My info is open, so the Programs page draws them hidden when it opens; the audits use `showAllHidden` to list every program.
- The Tracker and Do it for me now say "Not for me" where they said "Skipped"; the Tracker summary reads "(N not for me)"; the empty-tab texts changed; the live message is "<name> marked done.".

### Notes for the person who decides (not failures)
- The brief for this round says that after a redraw the undo memory is gone; `ARCHITECTURE.md` (Phase J, Ticks) says the memory is a module-level map that is kept for the visit and forgotten only on a bulk change or a reload. The suite follows `ARCHITECTURE.md` and the app agrees with it (J6: undo still works after a redraw, and after a reload `statusAfterTick` decides).
- The brief says an undo restores `bff.tracker.v1` exactly. Status, note and sign-up date are restored exactly (J6), but `updatedAt` moves forward with every save, and an untouched program that was ticked and unticked ends as a to-do entry instead of no entry. J6 compares everything except `updatedAt` (which must not go backwards). If an exact `updatedAt` is wanted, `ticks.js` would have to restore the whole entry.
- Reading the sentences as a person would: with no state set, a shown other-state line reads "60 only for some states. Add your state in My info to see the ones for you. (shown for now)"; the invitation is odd once the programs are shown. Minor.
- Harness: the tail of Storage calls in `guardedReload` was read before the reload and was practically always empty. A removal made while the old page unloads (a `pagehide` handler) cannot be recorded at all: a binding call and a `window.name` write made from `pagehide` are lost, while the same handler's `localStorage` writes land (measured in Chromium). The tail was dropped; the comment says so. Such a page would be run once more and then failed by the "second loss" rule.
- Not covered: the Gmail panel and the guided run's keyboard shortcuts with the new "Not for me" label (S), a real phone, and a real claude.ai viewer.
