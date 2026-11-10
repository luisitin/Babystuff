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
