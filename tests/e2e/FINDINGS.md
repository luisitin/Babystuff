# E2E findings

First full run: 620 checks, 0 failed. Nothing below breaks a hard rule; these are small gaps found while testing, most severe first. No app code was changed.

## Bugs
None. No console or page errors, no network request of the app's own, no horizontal scroll, no unexpected link, no stored data touched by a Cancel, and no form submit or click from the fill script in any run.

## Low severity

1. **Copy fallback in the tracker shows the text but does not select it** (`src/js/host.js:184`, `BFF.host.showText`).
   When copying is refused, "Copy my checklist" shows the text box and says "Select it and copy it", but the box is neither focused nor selected. The fill-script card (`src/js/phone.js`) does focus and select it, so the two fallbacks behave differently.
   Fix: after `parent.insertBefore(panel, after.nextSibling)` call `ta.focus(); ta.select();` (a try/catch is enough), or only do it when the call came from a failed copy.

2. **Draft message differs from the contract** (`src/js/inboxview.js:420` vs `ARCHITECTURE.md:215`).
   The page says "Draft saved in your Gmail." and a link. The architecture note promises "Draft created in your Gmail. Nothing was sent." The shorter text never claims a send, so it is honest, but it drops the reassurance.
   Fix: either append "Nothing was sent." in `draftDone`, or change the architecture note to match the code. The test accepts "saved" or "created" and only fails if the text claims a send.

3. **Different wording for the same outcome** (`src/js/phone.js:223` vs `src/js/tracker.js` `reportSave`).
   A standalone download from the tracker says "Downloaded ... Look in your Downloads."; the fill-script card says "Saved baby-freebies-fill.txt." Both are accurate; the second does not tell a person where to look.
   Fix: optional. Use the same sentence as the tracker when `BFF.host.inArtifact` is false.

## Suspects (informational)

- **Guided "Start over" asks no confirmation** (`src/js/guided.js:375`, link-style button during a run). It resets the run but keeps statuses (checked: tracker and My info data unchanged), so it is not data loss. A mis-tap loses only the place in the run. Optional fix: use `BFF.ui.confirm` as the directory's "Replace your current run?" does.
- **Buttons that visibly did nothing:** none found. Every visible, enabled button on every route (and in a guided run in progress) was clicked on a fresh load in both outputs. 22 buttons are visible during a guided run (21 enabled, 1 disabled at that moment).
- **Fill script contract:** the script embeds exactly the ten My info keys (first and last name, email, phone, address 1 and 2, city, state, ZIP, due date) plus `{domain, id, name, email}` per program; with plus addresses off every program `email` is empty. On a domain with two programs (enfamil.com) the script keeps the plain email when plus addresses are on, because the two programs have different tags. That is by design and is tested only as "fills the plain email".

## Not tested here
Real iOS Safari (WebKit behaviour, the Shortcuts "Run JavaScript on Web Page" action, bookmark saving), the real claude.ai viewer (its actual `claude.use`, sandbox, save prompt and consent card), real Gmail (the mock follows the type files and the shapes in `ARCHITECTURE.md`; real result shapes and error timing can differ), real program sites (all fixtures are synthetic and served by request interception), and screen readers (only the accessible-name, label, focus and contrast checks above).
