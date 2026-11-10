# Review V1: Gmail card and iPhone fill script

Severity, file, what, status.

HIGH
- inboxview.js: search_threads was sent view 'SUMMARY'; the Gmail tool enum is THREAD_VIEW_SUMMARY. Fixed.
- inbox.js: "on the way" matched "your baby is on the way" (marketing to expecting parents) and moved a program to Signed up on a tap. "Delivered to your door", "just delivered", "now delivered" could produce a "received" suggestion for a plus-address marketing email. Parcel word now required. Fixed, tests added.
- fieldmatch.js: "Middle name", "Maiden name", "Cardholder name" got the full name; "Delivery date" and "Baby's birthday" got the due date; search/store-finder ZIP boxes were filled; autocomplete=given-name on a "Baby name" field bypassed the other-person check. Fixed, tests added.
- fieldmatch.js registrableDomain: "https://evil.example\@similac.com/" returned similac.com (backslash is a host delimiter). IP literals reduced to two labels. Fixed.

MEDIUM
- inbox.js: not_in_manifest (viewer switched Gmail off for the page) was grouped as "unavailable", so the card said "not available here". Now "not allowed". Fixed.
- inboxview.js: any declined prompt (approval_required, consent_required) hid the card for the rest of the session. Now only not_granted and not_in_manifest do. Fixed.
- inboxview.js: a label batch kept going after rate_limited or server_unavailable. Now stops, and shows how many were labelled. Fixed.
- inboxview.js: reason text claimed Claude "only lets a page use tools allowed without asking". Unconfirmed; reworded.
- fillscript.js: program list could include a shared host (myshopify.com, github.io and so on) as a gate. Denylist added; none in current data.
- fillscript.js: fields inside role=search or role=combobox are skipped.
- fieldmatch.js: SECOND_LEVEL extended (ne, or, go, gob, gouv, mil, sch, nom, ltd, plc, nhs).
- phone.js: STEPS said "iOS 17 and earlier" (research: 18 and older), put Shortcuts "under Apps" (research: Settings > Shortcuts > Advanced), stated the permission prompt and "Safari only" as fact. Reworded and hedged. Buttons moved into their steps (Copy fill script, Save as file in step 1 of the Shortcut; Copy bookmark code in step 1 of the bookmark). Three privacy warnings come before the first button. Each button group has its own status line and fallback text box.

LOW / left (judgement)
- inboxview.js "Use <account> as my email" stores the Gmail account address (from authuser in viewUrl) into My info, but only after a tap. This is mailbox-derived data in localStorage; strictly against rule 3. Left; the product owner should decide whether to remove it.
- "Confirm email" fields get the same email: intended.
- Exact plus-address match does not check the sender; a marketing email to the plus address with explicit delivery wording about a parcel can still suggest "received" (needs a tap).
- amazon.com, target.com, walmart.com gate the whole site, not the sign-up page.
- Residual: a compromised official page can read anything typed into it, and could hook Object/Array methods to see the profile object. Native-setter checks were not added: the page is the only party that could see it either way.
- Outside my files: host.js saveFile has no .ics/.xml in the downloads allowlist (it zips them, fine). BFF.host.use memoizes use('mcp') per page, fine.
