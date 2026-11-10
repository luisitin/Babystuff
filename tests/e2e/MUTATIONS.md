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
