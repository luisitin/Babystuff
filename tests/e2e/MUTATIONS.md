# Mutation spot-checks

Date: 2026-11-10. A mutation spot-check applies one small deliberate breakage to the app source and checks whether the browser suite (`tests/e2e/run.mjs`) fails. Each of ten mutations was applied one at a time, only the listed test groups were run (`--only`), and the source file was restored with `git checkout` afterwards. Nothing was committed. Result: 9 of 10 caught.

| # | File | What was broken | Groups run | Result | Checks that failed |
|---|------|-----------------|------------|--------|--------------------|
| 1 | src/js/fillscript.js | Guard for "page is not a listed program domain" weakened | 8 | Caught | 1 of 72: "evil.example: says why, once, and the banner closes" |
| 2 | src/js/fillscript.js | https-only check disabled | 8 | Caught | 2 of 72: "plain http on a program domain: fills nothing"; "plain http on a program domain: says why, once, and the banner closes" |
| 3 | src/js/inboxview.js | Gmail connector called on load without a tap (list_labels) | 7 | Caught | 4 of 82 (7a: 3, 7b: 1): "nothing called on load"; "needs consent: buttons are disabled and progress is announced while waiting" |
| 4 | src/js/inboxview.js | Call to an undeclared tool (get_thread) | 7 | Caught | 2 of 82: "every call came within a tap and uses an allowed tool"; "only the five allowed tools were ever called" |
| 5 | src/js/inboxview.js | A message subject written to localStorage | 7, 9 | Caught | 1 of 117 (group 7; group 9 passed): "nothing from the mailbox is stored" |
| 6 | src/js/directory.js | Sign-up link address altered (`?x=1` added to `signupUrl`) | 3, 4 | Caught | 558 of 619 (group 3: 558 of 585; group 4 passed) |
| 7 | src/js/tracker.js | Download backup button runs on mouseover instead of click | 4, 5 | Not caught | 0 of 180 |
| 8 | src/js/tracker.js | A declined save reported as "Saved" | 5 | Caught | 4 of 146 (5a): "artifact(a) backup [declined]: never says Saved or Downloaded"; "artifact(a) filters [declined]: never says Saved or Downloaded" |
| 9 | src/js/tracker.js | Backup version check removed | 6 | Caught | 2 of 50: "standalone bad backup (unsupported version): refused with a message"; "artifact bad backup (unsupported version): refused with a message" |
| 10 | src/js/store.js | Inline confirm panel: Cancel runs the confirm action | 4, 6, 9 | Caught | 4 of 119 (group 4; groups 6 and 9 passed): "standalone #info: ... Clear my info: Cancel changed stored data" |

## Not caught

Mutation 7 changes the backup download from a click handler to a mouseover handler. The suite still passed all 180 checks in groups 4 and 5. The browser driver's click moves the pointer over the button before pressing it, so the mouseover handler fires and the download still appears. The test therefore cannot tell the two apart.

Follow-up (not yet added): add a check that focuses the backup button and activates it from the keyboard (focus, then Enter), and expects the download to start. Keyboard activation sends a click and no mouseover, so a mouseover-only handler would fail that check.

## Limits

- Only the groups listed for each mutation were run, not the full suite. This is not a measure of what the full suite would catch.
- Ten hand-picked mutations are a spot-check, not a measure of test coverage.
- The suite uses a mocked Gmail connector and synthetic forms (`lib/fixtures.mjs`). No real site or mailbox is touched.

# Phase G mutation spot-check

Date: 2026-11-10. This round covers the checks added for Phase G (groups 11 and 12, and the new cases in group 8). Eighteen mutations were applied one at a time. None touched the repo: each one was made in a throwaway copy of `index.html` and `artifact.html` (the same text replaced in both), and the suite was pointed at the copy with the environment variable `BFF_E2E_BUILD_DIR=<folder>` (set it and `run.mjs` skips the build and tests the files in that folder). Only the groups that could notice were run. Result: 18 of 18 caught. One first attempt (mutation 16) changed nothing the data can show and was replaced by a real one; see the note below.

| # | File | What was broken | Groups run | Failed checks | First checks that caught it |
|---|------|-----------------|-----------|---------------|-----------------------------|
| 1 | logic.js | `isTrulyFree` no longer needs a product as the first offer (sweepstakes, coupons and points get in) | 11, 12 | 24 of 231 (g11), 10 of 62 (g12) | "Truly free: every shown card passes isTrulyFree"; "Truly free: no card starts with prize draws, coupons, points or testing"; "guided Truly free only selects exactly the truly free programs"; the summary count |
| 2 | directory.js | Due-date button counts include the grouped (same-thing) entries | 11 | 18 of 231 | "buttons are the ones with a count above zero ... with the module counts" in the 10 weeks, under a week and Truly free cases |
| 3 | directory.js | "Show these" keeps the Category | 11 | 6 of 231 | "Show these: search text, Category and What you get are cleared"; "count line equals the summary figure" |
| 4 | fillscript.js and phone.js | Plus addresses are given to government programs (the inEmailFeatures guards removed in both places) | 8 | 2 of 129 | "plus-address mode tags exactly the programs that pass inEmailFeatures"; "government program domain tn.gov ... gets the plain address" |
| 5 | logic.js | `totalValue().missing` counts programs, not groups | 11, 12 | 4 of 62 | "a main program and two of its doors count the benefit once, and nothing says a program has no known value" |
| 6 | logic.js | `rankMap` numbers programs instead of groups (gaps in the ranks) | 11, 12 | 8 of 231 | "lead ranks run 1, 2, 3 ... with no gaps"; "state TX: ranks ... have no gaps" |
| 7 | logic.js | With no state, state-only programs are shown | 11, 12 | 19 of 50 (the group then stopped) | "no state: state-only programs are not in the list" |
| 8 | guided.js | The guided run gives government and no-email programs a tagged address | 11, 12 | 4 of 62 | "plus run: government program shows no tagged address"; "program with no email requirement ..." |
| 9 | tracker.js | Government rows show "Sign up with:" and the Gmail link | 12 | 6 of 62 | "a government program row has no Sign up with address"; "every row has Sign up with and Search my Gmail only when the program passes inEmailFeatures" |
| 10 | directory.js | "N more are free if you qualify" counts programs, not groups | 11, 12 | 2 of 231 | "summary says how many more are free if you qualify (distinct groups)" |
| 11 | directory.js | After the due date all three buttons are offered | 11, 12 | 6 of 231 | "due date passed: only the after-birth button shows" |
| 12 | directory.js | "Show them" and "Hide them" lose focus | 11, 12 | 8 of 231 | "focus stays on the Show them / Hide them button" (no state and state TX) |
| 13 | fillscript.js | On a multi-program domain the first plus address is used | 8 | 3 of 129 | "similac.com (two programs) with plus addresses gets the plain address"; same for enfamil.com and registry.target.com |
| 14 | logic.js | The "What you get" filter does nothing | 11, 12 | 2 of 231 | "What you get: each of the eight kinds keeps exactly the programs that give it" |
| 15 | directory.js | A saved offer such as "constructor" is accepted | 11, 12 | 4 of 231 | "old saved prefs (offer constructor) load: list is not empty" |
| 16 | logic.js | "Open to everyone" lets health and assistance programs in | 11, 12 | 10 of 231 | "Open to everyone: exactly the programs the module calls open to all"; the summary count |
| 17 | logic.js | Values of programs in one same-thing group are added, not the largest taken | 11, 12 | 2 of 62 | "a main program and two of its doors count the benefit once" (the line shows a doubled figure) |
| 18 | directory.js | Cards show no rank | 11, 12 | 4 of 25 (the group then stopped) | "every card shows a rank like #3" |

Notes:
- Mutation 16 first removed only the `if-eligible` test from `isOpenToAll`. That was not caught, and it cannot be: in today's data every `if-eligible` program is also eligibility based (health, assistance, or an eligibility or insurance requirement), so the removed test adds nothing. It is an equivalent mutation, not a test gap. The version in the table removes the other half of the rule.
- Mutation 4 first changed only the check in `fillscript.js`. That was not caught either, for a different reason: the tag map built in `phone.js` already leaves government programs out, so two guards protect the same rule. The table row breaks both.
- Mutations 7 and 18 stop group 11 early (the later steps need the state line or the rank), so the failed count is small compared with the checks left unrun. They still fail the run.
- Mutations 1, 2, 5 and 6 ran while other mutation runs shared the machine, so their failed counts may include a little timing noise. Mutation 3 showed extra failures that did not repeat when it was rerun alone, and the table gives the quiet numbers for it. The caught or not caught answer is the same in every case.
- Only the listed groups were run per mutation, not the full suite. Eighteen picked mutations are a spot-check, not a coverage measure.

## Phase I

Date: 2026-11-11. Sixteen mutations were applied one at a time to a throwaway copy of `index.html` and `artifact.html` (the same text replaced in both, with a script that stops unless the text is found exactly once in each), and group 14 was pointed at the copy with `BFF_E2E_BUILD_DIR=<folder>`; only the part of group 14 that could notice was run (`BFF_E2E_SUB=I4,I5 ...`). Nothing touched the repo. Result: 15 of 15 real mutations caught; mutation 13 changed nothing the page can show and was replaced by 16.

| # | File | What was broken | Parts run | Failed checks | First checks that caught it |
|---|------|-----------------|-----------|---------------|-----------------------------|
| 1 | logic.js | `missingInfoCounts` ignores `statusOf` (programs already signed up still count) | I4, I5 | 30 of 412 | "data-missing-total and data-missing-keys equal L.missingInfoCounts" and "the sentence" on Programs and Tracker, in the runs where three statuses are set (92 vs 89) |
| 2 | tracker.js | the Tracker notice loses `compact` (the full form with chips shows) | I4 | 30 of 364 | "Tracker notice: one-sentence form (miss-box--one), no chips"; "the sentence" |
| 3 | guided.js | Do it for me shows the notice while "My info is empty" is showing | I4 | 6 of 364 | "My info is empty, so exactly one warning shows and no notice box" (1 warning, 1 box) |
| 4 | missing.js | `take()` returns the hand-off without clearing it | I6 | 24 of 434 | "coming back through the nav shows no highlight and no back link" |
| 5 | profile.js | the highlight is removed on every keystroke in the email field | I6 | 4 of 434 | "typing in the email field keeps the highlight"; "a full address typed but not yet left keeps the highlight" |
| 6 | missing.js | a line's `data-info-key` is always `state` | I4, I6 | 65 of 663 | "every card, row and line equals L.missingInfo (data-missing, sentence, link, first key)" on all three pages |
| 7 | logic.js | `trackerScope` keeps programs for other states | I1 | 16 of 27 (the group then stopped) | "summary reads X of N done" (137 vs 77); progress bar; the rows and the left-out sentence |
| 8 | tracker.js | a row's own status select no longer sets `localChange`, so the row moves at once | I2 | 2 of 13 (the group then stopped) | "the row stays where it was" |
| 9 | guided.js | the default tick ignores a group already signed up for | I3 | 4 of 136 | "same-thing group (patched data) ... nothing in the group is ticked" (second signed up, first received) |
| 10 | tracker.js | a fold's open state is not written to `prefs.trkOpen` | I2 | 10 of 224 | "prefs.trkOpen records the open folds" |
| 11 | profile.js | the back link always points at `#directory` | I6 | 2 of 107 (the group then stopped) | "one back link, Back to Tracker, href #tracker" |
| 12 | profile.js | the hand-off highlights a field that already has an answer | I6 | 9 of 434 | "field already answered ... no highlight (it is answered)" |
| 13 | profile.js | a hint is not hidden when the field is answered | I5 | 0 of 48, not caught | equivalent mutation: an answered field has a count of 0 in `missingInfoCounts`, so the hint is hidden by the count anyway; replaced by 16 |
| 14 | directory.js | the Programs notice is always the compact one-sentence form | I4 | 30 of 364 | "full form has no miss-box--one class and no inline link"; "the sentence" |
| 15 | logic.js | `trackerSections` puts programs that are not ready into Do now | I1 | 145 of 1043 | "now rows equal trackerSections ids and order" (46 vs 27); the sections list |
| 16 | profile.js | the "N programs depend on this." hint shows the total instead of the field's count | I5 | 10 of 48 | "each unanswered field shows N programs depend on this. with the module count" (92 vs the state count) |

Notes:
- Mutations 7, 8 and 11 stop their part early (the later steps need the row or the page that the mutation broke), so the failed count is small next to the checks left unrun. They still fail the run.
- Mutation 9 changes nothing on today's unpatched data (the only group with more than one member has no program that is ticked by default), which is why group 14 runs that rule on data patched in the page (see README, "Phase I"). On the patched data it is caught.
- Sixteen picked mutations are a spot-check, not a coverage measure.

## Phase J

Date: 2026-11-11. Sixteen mutations were applied one at a time to a throwaway copy of `index.html` and `artifact.html` (the same text replaced in both, with a script that stops unless the text is found exactly once in each), and group 15 was pointed at the copy with `BFF_E2E_BUILD_DIR=<folder>`. Only the parts that could notice were run first (`BFF_E2E_SUB=J5,J9 ...`), and when those found nothing the whole of group 15 was run. Nothing touched the repo. Baseline (the unchanged copy): 1035 checks, 0 failed. Result: 15 of 16 caught.

| # | File | What was broken | Parts run | Failed checks | First checks that caught it |
|---|------|-----------------|-----------|---------------|-----------------------------|
| 1 | logic.js | `hideReason` no longer hides programs for other states | J1, J9 | 53 of 194 (the part then stopped) | "the cards are exactly the programs the model lists"; "count line says Showing N of N" (it read "Showing 142 of 142 programs"); "the box is there and not hidden" |
| 2 | logic.js | `hideReason` hides a program only once it is received (a signed-up program stays listed) | J5, J9 | 22 of 176 (the part then stopped) | "step 1 (tick done)" (`.is-ticked` was false where true was expected); "step 3 (untick received)" |
| 3 | logic.js | `hideReason` files a program marked not for me under the reason done | J2, J9 | 18 of 170 (the part then stopped) | "five reasons, default: one line per reason with a count, in order"; "Show otherState: one line per reason with a count, in order"; "Hide otherState: one line per reason with a count, in order" |
| 4 | logic.js | `statusAfterTick`: unticking Not for me leaves the program marked | J5, then all of group 15 | 1 of 1019 (the part then stopped) | "group ran to the end" (in J6: unticking the Not for me box did not change its state). J5 alone found nothing: 0 of 208 |
| 5 | logic.js | `tickChange` drops the sign-up date when a tick is taken back | J6 | 8 of 27 | "Not for me off: back to signed up with the same sign-up date and note"; "Done on again: signed up with the old date"; "Not for me, then Done: signed up and the sign-up date is kept" (signedUpAt was today's date) |
| 6 | ticks.js | the memory of the last tick is never found again (no true undo) | J6 | 8 of 27 | "Not for me off: back to signed up with the same sign-up date and note" (status came back "todo", not "signed-up"); "Done on again: signed up with the old date" |
| 7 | ticks.js | the Received box is offered before the program is marked done | J5, J7 (only J5 failed) | 10 of 304 | "at the start the Received label is hidden, nothing is ticked and no card is a strip"; "step 5 (untick done): boxes [0,0,0] and the Received box is shown only while done" (shown while not done) |
| 8 | directory.js | the Show button of a reason shows nothing | J2 | 72 of 275 | "Show otherState: the cards are exactly the programs the model lists" (page-only list empty); "Show otherState: summary reads 'Hidden from this list: 14 programs'" (it read 69) |
| 9 | directory.js | a tick that could not be saved does not say so on the card | J10 | 4 of 50 | "the card note adds the could-not-be-saved sentence" (the card read only "Marked done. It will be hidden from this list. Untick to undo."); "the live message adds it too"; the same card check on artifact |
| 10 | directory.js | a search that matches only hidden programs no longer says so | J4 | 4 of 23 | "the empty-state line says so (singular)" (no line, where 1 hidden program was expected); "the empty-state line says so (plural)" (no line, where 3 were expected) |
| 11 | logic.js | `coveredGroups` counts a group as covered only once something is received | J7, J9 | 20 of 192 | "Texas, private cover, five reasons: tab counts equal the model"; "the left-out line equals trackerScope(...).left worded from it" |
| 12 | guided.js | Do it for me lists the programs that Programs hides | J8 | 14 of 62 | "Texas, private cover, five reasons: the setup list is exactly the programs the model does not hide" (3 extra programs on the page); "the left-out line has the module counts"; "no profile: the setup list is exactly the programs the model does not hide" |
| 13 | logic.js | `pruneSelection` keeps a selected program that has since become hidden | J8, then all of group 15 | 0 of 1035, not caught | none (J8 alone: 0 of 62 failed) |
| 14 | app.js | the notice at the top of every page never appears when saving starts to fail | J10 | 10 of 50 | "#directory: #storage-notice is visible with the exact text"; "#info: #storage-notice is visible with the exact text"; "#tracker: #storage-notice is visible with the exact text" |
| 15 | tracker.js | the note under a Tracker row names the wrong tab | J7 | 6 of 96 | "Tracker: ticking Done leaves the row in place" (note said "listed under To do", where "Signed up" was expected); "Tracker: Received in the Signed up tab" (note said "listed under To do", where "Received" was expected) |
| 16 | logic.js | the wording of the other-state reason changes ("in other states") | J2, J8 | 32 of 337 | "five reasons, default: one line per reason with a count, in order" (read "55 in other states", where "55 for other states" was expected); "Show otherState: one line per reason with a count, in order"; "otherState: the button is named Hide plus the reason, and the box stayed open" |

Notes:
- Mutations 1, 2 and 3 stop their part early (J1, J5 and J2): after the first failure a click or a locator timed out, and the rest of that part did not run (J1 ran 98 of 142 checks, J5 80 of 208, J2 74 of 275). Mutation 4 stops J6 early (11 of 27 checks) in the whole-group run. They still fail the run.
- Mutation 4 changes the rule that applies when the visit has no memory of the tick, which is the case after a reload. J5 ticks and unticks within one visit, where the remembered tick decides (the undo path in `tickChange`), so it cannot see this change: 0 of 208 failed. J6 unticks after a reload. There the box stayed ticked, Playwright's `uncheck()` threw ("Clicking the checkbox did not change its state"), and J6 stopped after 11 of its 27 checks. So the run fails through a stopped part ("group ran to the end"), not through a check that names the rule. J6 was the right part to run for this mutation; J5 has no gap here.
- Mutation 13 was not caught by J8 (0 of 62) or by the whole of group 15 (0 of 1035). The unit test "pruneSelection: drops ids that were listed and are hidden now, keeps ones handed over while hidden" in `tests/logic.test.mjs`, which runs in CI, does fail with it (checked on a copy of the sources: 1 of the 76 logic tests fails). The browser suite missed it because J8 only ever made a ticked program hidden by changing that program's own status, and the status rule in the same function drops such a program first. Nothing in J8 changed the state or an answer in My info, or signed up for another way to get the same thing, while a program was ticked.
- While group 15 was being written, its author also reported two builds with several changes at once: one (changed note, line and notice wording and a broken Done-off rule) made 68 checks fail across J2, J5, J7, J8, J9 and J10, and one with undo disabled made 8 checks fail in J6. Those were not repeated here.
- Sixteen picked mutations are a spot-check, not a coverage measure.
