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
