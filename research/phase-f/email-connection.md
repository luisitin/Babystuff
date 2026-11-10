# Email connection research (Phase F lane: email-connection)

Read on 2026-11-10. Method note: the container proxy blocked (CONNECT tunnel failed, 403) support.google.com, developers.google.com, support.apple.com, learn.microsoft.com, support.microsoft.com, fastmail.com, proton.me, help.yahoo.com. These are the container's network policy, not the sites refusing. A second try near the end of the run was blocked too. Only support.claude.com and claude.com/docs could be read. Everything else is "from search result, page not read": the search tool returned a paraphrase of the official page, with URL. Treat those as medium confidence at best, and the exact quotes below are not available for them. No mailbox was touched; no Gmail tool was called.

## 1. Answers

### Q1 Plus addressing and dots (Gmail)
- Answer: Google's "Send emails from a different address or alias" page (https://support.google.com/mail/answer/22370) is reported to say that adding a plus sign and any word before the @ makes a variation, and mail to the original address or any plus variation arrives in the same inbox. It suggests filtering by the alias in the To field. It also warns aliases are not private. From search result, page not read.
- Dots: https://support.google.com/mail/answer/7436150 ("Dots don't matter in Gmail addresses"): johnsmith@gmail.com and j.o.h.n.s.m.i.t.h@gmail.com reach one inbox. Exception: Google Workspace accounts, where dots change the address. From search result, page not read.
- gmail.com and googlemail.com are the same (https://support.google.com/mail/answer/10313). From search result, page not read.
- Workspace addresses (work or school): not confirmed for personal-style plus addressing. A Workspace admin page (https://support.google.com/a/answer/1346934) mentions Gmail removes dots and plus signs from usernames at delivery for content compliance rules, which suggests plus works in Workspace, but not stated as a promise. Not confirmed.
- Official caveat about sites that reject "+": not found on Google pages. Fastmail's own help (see Q7) says some websites wrongly treat + addresses as invalid.
- Confidence: medium for personal Gmail, low for Workspace.

### Q2 Gmail search operators
- Source: https://support.google.com/mail/answer/7190 ("Refine searches in Gmail"), computer, Android and iPhone versions exist. From search result, page not read.
- Confirmed by the search summary: `from:`, `to:`, `label:`, `newer_than:` and `older_than:` (units d, m, y), `OR`, `{ }` as another way to write OR (example `{from:amy from:david}`), `( )` grouping, `-`, quoted phrases, `subject:`, `has:`, `size:`, `larger:`, `AROUND`.
- Does `to:` match a plus address exactly? Not stated in the pages found. Not confirmed. Google's alias page says to put the alias in the To field of a filter, which implies it works.
- Query length limit: not documented (nothing found).
- Warning from the page: negative operators can still show conversations that contain excluded messages.
- Confidence: medium-high for the operators, low for exact `to:` plus-address matching.

### Q3 Gmail filters and import
- Source: https://support.google.com/mail/answer/6579 ("Create rules to filter your emails"). From search result, page not read.
- Import steps reported: Settings > See all settings > Filters and Blocked Addresses > Import filters (at the bottom) > choose file > Open file > Create filters. Export is the same page, tick filters, Export, gives a .xml file.
- Computer only? The filter page is written for "your computer" and the search found no iPhone version of creating or importing filters. So on iPhone: not documented as possible. Not confirmed as a flat "impossible".
- What Google documents for iPhone instead: Gmail iPhone app > Settings > Inbox customizations > Labels > add a rule (auto-label by criteria). Source: https://support.google.com/a/users/answer/9260550 (Workspace Learning Center, iPhone & iPad version), summary only. Whether this exists for personal Gmail in the iPhone app today: not confirmed.
- Mobile Safari "desktop site" workaround: not documented by Google in anything found. Not confirmed.
- Caveat quoted in summary: a filter that forwards only affects new messages. Filters apply to new mail; "also apply to matching conversations" is an option on the create screen (not verified on the import path).
- Confidence: medium (steps), low (iPhone limits).

### Q4 Gmail links on iPhone
- What happens when `https://mail.google.com/mail/u/0/#search/<query>` is tapped in Safari on iPhone: not confirmed. No Google page found that says whether it opens the app, the mobile web, or an install prompt.
- First-party pages found only say to go to mail.google.com in a browser to find mail, and to add accounts in the Gmail app (https://support.google.com/mail/answer/8494 iPhone version). Nothing about Universal Links.
- Documented Gmail iOS URL scheme (`googlegmail://`) on developers.google.com or Gmail Help: none found. Google documents `comgooglemaps://` for Maps, but no Gmail equivalent was found. The Gmail markup docs (https://developers.google.com/gmail/markup/actions/declaring-actions) are about linking out of emails. Treat any Gmail scheme as undocumented and unsupported.
- Confidence: low (it is "not confirmed", not a finding of absence).

### Q5 Google Calendar template link
- Documented? Yes, by Google, but thinly: https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events reportedly describes a pre-filled event link starting with the eventedit path and `action=TEMPLATE`, with `dates`, `stz`, `etz`, `details`, `location`, `text`; description, location and title must be URL encoded. The `https://calendar.google.com/calendar/render?action=TEMPLATE` form: not seen in a first-party page. Date format (`YYYYMMDD/YYYYMMDD` for all-day, `YYYYMMDDTHHMMSSZ` otherwise, end date exclusive): not confirmed from Google; third-party only. Phone behaviour: not confirmed.
- Confidence: low-medium.

### Q6 Calendar files on iPhone
- Apple "Set up mail, contacts, and calendar accounts on iPhone" (https://support.apple.com/guide/iphone/ipha0d932e96/ios) reportedly says you can subscribe to an .ics calendar by URL (Other > Add Subscribed Calendar) or import an .ics file from Mail. Button label, and how many events a multi-event file adds: not confirmed.
- Gmail iPhone app handling of .ics attachments: not confirmed (Gmail Help "Open & download attachments", https://support.google.com/mail/answer/30719, not read).
- Google Calendar Help says importing/exporting .ics is for a computer only (https://support.google.com/calendar/answer/37118), not phone or tablet. That matters: a person whose calendar is Google Calendar cannot import the file on iPhone through Google; Apple Calendar is the route.
- Confidence: low.

### Q7 Other providers
| Provider | Supports `+tag` | Source | `supportsPlus` in code |
|---|---|---|---|
| Gmail / googlemail.com | yes (personal), not confirmed Workspace | support.google.com/mail/answer/22370 (search result) | true. OK |
| Outlook.com, hotmail.com, live.com (consumer) | not documented in what we found | Only Exchange Online doc found | true. Mismatch risk: unconfirmed |
| Microsoft 365 / Exchange Online | yes, on by default, receive only; admin can disable (`DisablePlusAddressInRecipients`) | learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/plus-addressing-in-exchange-online (search result) | custom domains return null. OK |
| iCloud (icloud.com, me.com) | not documented (Apple pages show aliases and Hide My Email only) | support.apple.com/guide/icloud (search result) | true. Mismatch: should be null |
| Yahoo | no `+`; its disposable addresses use `basename-keyword@yahoo.com`, need Yahoo Mail Plus or an existing basename | help.yahoo.com/kb/SLN36718.html (search result) | false for yahoo.com. OK (nuance: the dash scheme is paid and the base name is fixed) |
| Proton (proton.me, protonmail.com) | yes, free, no setup | proton.me/support/addresses-and-aliases (search result, page about 4 years old) | true. OK |
| Fastmail | yes by default; some sites reject it, subdomain addressing offered | fastmail.com/help/receive/addressing.html (search result) | true. OK |
| AOL | not documented (only send-only addresses) | help.aol.com (search result) | not listed, returns null. OK |

Mismatches to fix: iCloud `true` should be null (undocumented). Outlook consumer domains `true` should be null or labelled "likely works, not confirmed". Note also the code gives `false` for yahoo.com only; ymail.com, rocketmail.com, aol.com are null, fine. Gmail `isGmail` covers gmail.com and googlemail.com: matches Google's statement that they are the same.

### Q8 Connecting Gmail in Claude (read directly)
- https://support.claude.com/en/articles/10166901-use-google-workspace-connectors (read 2026-11-10): "Google Workspace connectors (Gmail, Google Calendar, and Google Drive) are available for all users on Claude and Claude Desktop." It lists Gmail: search and read, draft emails, send/reply/forward ("By default, Claude asks for your approval before each of these actions"), manage labels and threads, list drafts. Limits: "Some advanced Gmail filters may not be supported." "Complex queries may require multiple API calls." Reconnect: Customize > Connectors > select Google connector > Disconnect.
- Conflict: https://claude.com/docs/connectors/google/gmail (read 2026-11-10) says "Claude can't create, send, or modify emails" and the connector is read-only. The support.claude.com page is newer-looking ("Updated over a week ago") and lists drafts, labels, sending. The app's label and draft features depend on this; say "may" in the app and handle a failed call.
- Steps, web: https://claude.com/docs/connectors/google/gmail: Customize > Connectors in claude.ai > find Gmail, select Connect > sign in to Google and grant the permissions. The button then reads Disconnect. Use: select + at lower left of the message box > Connectors > turn on Gmail.
- https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities: "Web connectors are available for all users on Claude, Cowork, Claude Desktop, and Claude Mobile (iOS and Android)." "You can connect Claude to a new service on Claude, Claude Desktop, and Claude for iOS and Android. Installing connectors on mobile is currently in beta." Once connected on web it is available on mobile "the next time you log in". Menu path on mobile for connecting: the page gives chat "+" > Connectors > Manage connectors; iPhone-specific menu names are not separately documented. Team and Enterprise: an Owner must enable the connector first.
- Artifacts: https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them (read): "Available on Pro, Max, Ultra, Team, and Enterprise plans, on Claude on web and desktop." Artifacts "can connect to the apps you've connected to Claude". "The first time an artifact needs a connected app, Claude shows which apps and tools it will use and asks you to approve them. You can turn individual tools off." "Connector tools that need approval for each action aren't available to artifacts." "Everyone connects their own apps, even when using a shared or published artifact." On Team/Enterprise an owner can turn this off. iOS section of the same page: Claude for iOS can view artifacts in an Artifacts tab; connector use in artifacts on the iPhone app is not stated (page says web and desktop). Not confirmed on iPhone.
- Important consequence: send/reply/forward in Gmail need per-action approval by default, so under that rule those actions are not available to artifacts. Drafts and labels may still be blocked if the user set them to "Needs approval". The app should not promise them.
- Confidence: high for the quoted points.

## 2. Steps for the app

(a) Connect Gmail in Claude (do this on a computer or in the browser first; Claude says a connection made on the web appears in the iPhone app the next time you sign in)
1. Open claude.ai in a web browser and sign in. This needs a Pro, Max, Ultra, Team or Enterprise plan to use it inside an artifact.
2. Go to Customize, then Connectors.
3. Find Gmail and select Connect.
4. Sign in to your Google account and allow the permissions it asks for. The button changes to Disconnect when it worked.
5. In a chat, select the + at the lower left, choose Connectors, and turn Gmail on.
6. Open this app as an artifact. The first time it needs Gmail, Claude lists what it will use and asks you to approve. You can turn individual tools off.
7. If it says to reconnect: Customize, Connectors, Gmail, Disconnect, then connect again.
8. On a work or school Google account, your Google admin may need to allow Claude first. On a Team or Enterprise plan, your organization's owner must turn Gmail on first.

(b) Import the filters file (on a computer only; not confirmed in the iPhone app)
1. Download the filters file from the app and save it somewhere you can find it.
2. On a computer, open Gmail in a browser (mail.google.com).
3. Click the gear icon, then See all settings.
4. Open the Filters and Blocked Addresses tab.
5. At the bottom, click Import filters.
6. Choose the file, click Open file, then click Create filters.
7. Check the filters in the list. Filters only affect new mail unless you tick the option to apply them to existing conversations.

(c) Add the reminders to a calendar on an iPhone (not confirmed by Apple pages read; wording must be tested on a device)
1. Download the reminders (.ics) file to your iPhone, or email it to yourself and open it in Mail.
2. Open the file. Apple says an .ics file can be imported from Mail; the button name is not confirmed.
3. Choose the calendar to add the events to. They show as all-day events.
4. If it adds only one event or nothing, tell us. Google Calendar's own help says importing .ics is for a computer only, so on a computer you can import it at calendar.google.com instead.

## 3. Limits and risks
- Plus addresses: Gmail supports them, but some sign-up forms reject the + sign. Say: "If a form says your email is not valid, use your plain address for that program."
- Plus-address delivery is unaffected by dots; for Workspace addresses it is not confirmed.
- Search links: how they open on iPhone is not confirmed; they may open the mobile site or the Gmail app. Say: "If the link does not show your mail, open the Gmail app and paste the search into its search box."
- No documented Gmail query length limit; the app's own 1,900-character cap on links is our choice, not Google's.
- Filters: no confirmed way to import or create them from the iPhone Gmail app. Say: "Do this on a computer."
- Claude connector: Anthropic's two pages disagree on whether Gmail can draft, label or send. Do not promise labels or drafts; tell the person Claude asks for approval. Artifacts cannot use tools that need per-action approval, so sending mail is not possible from the artifact. The app itself never sends mail.
- The artifact must be opened on claude.ai web or desktop for connectors; iPhone use is not confirmed.
- Calendar template link: the render?action=TEMPLATE form is not confirmed by Google; prefer the .ics file or a plain date in the app.
- iCloud and AOL: no documented plus addressing; do not tell users it works.
- Search-result summaries are not verbatim quotes. Where the app shows Google or Apple menu names, re-check them on a real device.

## 4. Not confirmed
- Exact Gmail Help sentence on plus addressing; Workspace and googlemail.com plus behaviour.
- Whether `to:` matches a plus address exactly (likely yes).
- Gmail iPhone behaviour for `mail.google.com/mail/u/0/#search/...`; any Gmail iOS URL scheme.
- Whether the Gmail iPhone app can create or import filters; any mobile Safari desktop-site route.
- Whether the Gmail iPhone app and Apple Mail add an .ics with several events as one or many; Apple Calendar import steps for multi-event files.
- The `calendar.google.com/calendar/render?action=TEMPLATE` parameters and phone behaviour from a first-party page.
- Plus addressing for consumer Outlook.com, iCloud Mail, AOL.
- Whether connectors work inside artifacts on the Claude iPhone app; iPhone-specific menu names for connecting Gmail.
- Which Anthropic page is right about Gmail drafting/labelling (read-only vs write).
