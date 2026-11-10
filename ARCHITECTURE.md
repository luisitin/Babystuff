# Architecture and build contract

This file is the contract between the builders. If you need to change something here, say so in your reply instead of silently diverging.

## Output
`node scripts/build.mjs` reads `src/` and `data/programs.json` and writes one self-contained `index.html` at the repo root. The build must be deterministic: no timestamps, no random values, and the same input gives byte-identical output. A test checks that `index.html` matches a fresh build.

The built page:
- Has no external URLs in `<script src>`, `<link href>`, `@import`, `url()` or fonts. All CSS and JS are inline.
- Sets `<meta name="referrer" content="no-referrer">` and this CSP meta, which blocks every network request:
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`
- Works from `file://`, from GitHub Pages, and pasted into a Claude artifact. If localStorage throws, it falls back to in-memory storage and shows a small notice.
- Opens every external link with `target="_blank" rel="noopener noreferrer"`. Links go only to the `signupUrl` and `sourceUrls` values from the data.
- Never submits a form. Use `<form>` only with `onsubmit` calling `preventDefault`, or don't use forms at all.

## Source layout and ownership
| File | Owner | Purpose |
|---|---|---|
| `scripts/build.mjs` | builder 1 | inlining build (order below) |
| `src/index.html` | builder 1 | page shell with placeholders, header and nav, the five view containers, static "Spot a fake" content, footer |
| `src/css/base.css` | builder 1 | design tokens, light and dark themes, layout, header and nav, directory cards, filters, utilities |
| `src/css/features.css` | builder 2 | My info, tracker, guided-run styles (uses the tokens from base.css) |
| `src/js/logic.js` | builder 1 | pure functions, also loadable by Node tests (see below) |
| `src/js/store.js` | builder 2 | localStorage wrapper and data access |
| `src/js/directory.js` | builder 1 | directory view: search, filters, sort, cards |
| `src/js/profile.js` | builder 2 | "My info" view |
| `src/js/tracker.js` | builder 2 | tracker API and tracker view |
| `src/js/guided.js` | builder 2 | "Do it for me" guided run |
| `src/js/app.js` | builder 1 | boot, theme toggle, hash router; runs last |
| `tools/autofill/*` | builder 3 | optional local Playwright helper |

### Build placeholders in `src/index.html`
- `<!-- @inline-css -->` is replaced by one `<style>` holding `base.css` then `features.css`.
- `<!-- @inline-data -->` is replaced by `<script id="programs-data" type="application/json">…</script>`, the data JSON with every `<` escaped as `<`.
- `<!-- @inline-js -->` is replaced by one `<script>` holding, in this order: `logic.js`, `store.js`, `tracker.js`, `profile.js`, `directory.js`, `guided.js`, `app.js`.

## Runtime conventions
- No modules and no frameworks. Each file is an IIFE that attaches to `window.BFF` (`window.BFF = window.BFF || {}`). Use `'use strict'`.
- `BFF.programs` is the parsed data array, set by `store.js` from `#programs-data`.
- Render with DOM APIs or `textContent`. Never put data or user input through `innerHTML` unescaped. Use `BFF.logic.escapeHtml` if you build markup strings.
- Cross-view updates go through a `document` CustomEvent: `bff:tracker-changed` (detail `{id}`) and `bff:profile-changed`.

### `BFF.logic` (`src/js/logic.js`)
Written as `(function (root) { … if (typeof module === 'object' && module.exports) module.exports = api; else { root.BFF = root.BFF || {}; root.BFF.logic = api; } })(typeof window !== 'undefined' ? window : globalThis);`
- `CATEGORIES`: ordered list of `{id, label}` for formula, diapers-wipes, registry-box, feeding, baby-care, rewards, health-benefits, assistance, product-testing
- `COST_LABELS`: free → "Free", shipping-fee → "Shipping fee", purchase-required → "Purchase needed", membership-required → "Membership needed"
- `REQUIREMENT_LABELS` for: email, address, phone, due-date, registry, app, purchase, membership, insurance, eligibility
- `isTrulyFree(p)`: `costToClaim === 'free'` and requirements include neither `purchase` nor `membership`
- `isEmailOnly(p)`: requirements include `email` and every requirement is `email` or `due-date`
- `needsRegistry(p)`: requirements include `registry`
- `isEligibilityBased(p)`: category is `health-benefits` or `assistance`, or requirements include `eligibility` or `insurance`
- `guidedDefault(p)`: `isTrulyFree(p) && !isEligibilityBased(p)`
- `filterPrograms(list, {query, category, trulyFree, emailOnly, needsRegistry})`: case-insensitive query over name, brand, whatYouGet, notes and eligibility; `category` '' means all
- `sortPrograms(list, key)`: key is `recommended` (the directory default: `guidedDefault` first, then email-only first, then confidence high/medium/low, then CATEGORIES order, then name), `name` (A-Z), `verified` (newest `verifiedOn` first), `category` (CATEGORIES order, then name) or `confidence` (high, medium, low, then name). Returns a new array.
- `domainOf(url)`: hostname without `www.`
- `escapeHtml(s)`

### `BFF.store` (`src/js/store.js`)
- `get(key, fallback)`, `set(key, value)`, `remove(key)`: JSON in localStorage under the prefix `bff.`, wrapped in try/catch with an in-memory fallback. `BFF.store.persistent` is a boolean.
- Keys: `profile.v1`, `tracker.v1`, `prefs.v1` (theme, last filters), `guided.v1` (current run).

### `BFF.tracker` (`src/js/tracker.js`)
- Statuses: `todo` (default), `signed-up`, `received`, `skipped`, with labels To do, Signed up, Received, Skipped.
- `getStatus(id)`, `setStatus(id, status)`, `getNote(id)`, `setNote(id, text)`, `all()`, `counts()`, `exportJSON({includeProfile})`, `importJSON(text)` (validates, then merges).
- Each setter dispatches `bff:tracker-changed`.
- Directory cards show a status `<select>` wired to `getStatus` and `setStatus` (builder 1 builds the control; builder 2 provides the API).

### Views and routing (`#hash`)
| Hash | Container | Owner |
|---|---|---|
| `#directory` (default) | `<section id="view-directory">` | builder 1 |
| `#info` | `<section id="view-info">` | builder 2 |
| `#tracker` | `<section id="view-tracker">` | builder 2 |
| `#guided` | `<section id="view-guided">` | builder 2 |
| `#safety` | `<section id="view-safety">` | builder 1 (static) |

Each owner's script exposes `BFF.views.<name> = { init(el), show(el) }`. `app.js` calls `init` once at boot and `show` on each route change. It also moves focus to the view's `h2` and updates `aria-current` on the nav.

## Data
`data/programs.json` is an array of objects with the schema in `CLAUDE.md`. `requirements` values come only from the list in `BFF.logic.REQUIREMENT_LABELS`.

## Tests
`node --test` runs `tests/*.test.mjs`. They cover the data schema, https official links and dates, `index.html` matching a fresh build, no external URLs, `logic.js` behaviour, and the autofill field matcher, which must run without Playwright installed.

## Phase E: button and email automation (contract)
Everything here still runs offline in the browser. The app makes no network requests and never submits a form on another site. Email features hand off to the person's own mail app or Gmail by link or by a downloaded file.

### `BFF.email` (`src/js/email.js`, loaded after `store.js`)
UMD like `logic.js`, so Node tests and `tools/autofill` can `require` it. Pure functions:
- `tagFor(program, allPrograms, existing?)` returns a deterministic, unique, readable plus tag (`[a-z0-9-]`, at most 24 characters). The base comes from the brand with parenthetical text removed: lowercase words of `[a-z0-9]`, dropping the stopwords the, a, an, of, for, and, us, usa and pure numbers. The base is the first remaining word, or the first two joined if the first is under 4 characters. It falls back to the same rule on the id, then `program`. Programs are handled in `id` order. A program whose base is taken gets `base-<first id word that isn't the base>`, plus `-2`, `-3` and so on if that still collides. `existing` is `{id: tag}`: those tags are kept as they are, and a tag in `existing` is never given to another program.
- `tagMap(allPrograms, existing?)` returns `{id: tag}`.
- `plusAddress(email, tag)` returns `local+tag@domain`. If the local part already has a `+`, the old suffix is replaced. Invalid or empty email gives `''`.
- `supportsPlus(email)` is true for gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, icloud.com, me.com, fastmail.com, proton.me and protonmail.com. It returns false for yahoo.com (Yahoo uses `-`; the UI says so) and null otherwise, meaning unknown: the UI says "check your provider". `plusAddress` itself does not check this; callers do, and `gmailFiltersXml` ignores `usePlus` for Yahoo.
- `registrableDomain(host)` (register.gerber.com becomes gerber.com) and `isBroadDomain(domain)` (any .gov or .mil, plus a denylist of retailers and big senders such as amazon.com, target.com, walmart.com).
- `gmailSearchUrl({email, tag, domain, account})` builds `https://mail.google.com/mail/u/<account>/#search/` (account 0 to 9, default 0) + an encoded query: `to:(plus address)` OR `from:(registrable domain)`, or just one of them. Broad domains are never searched by `from:`; with nothing to search it returns ''. Only used when the email is Gmail.
- `gmailFiltersXml(programs, {email, usePlus, archive, tagMap, allPrograms})` returns Gmail's filter-import Atom XML. With plus tags on (and a valid, non-Yahoo email) there is one `to:(plus address)` filter per program, and `archive` adds `shouldArchive`. Otherwise there is one `from:(registrable domain)` filter per distinct domain, skipping broad domains, and it never archives. `label` is `Baby Freebies/<program name>` (with `/` in names replaced). Values are XML-escaped.
- `mailtoChecklist({to, programs, statusOf})` returns a `mailto:` URL with the subject "Baby freebies checklist" and a body listing each program's name, status and signupUrl. It keeps the URL under 1,900 characters by truncating the list and adding "…and N more (see the app)". Lines are separated by CRLF. It also returns `{url, truncated, fullText}`.
- `icsReminders(entries, {days})` returns iCalendar text. One all-day VEVENT per entry `{id, name, date}` at `date + days` (default 28), titled "Check for <name> mail or box". It has a stable UID `<id>@baby-freebies-finder`, CRLF line endings and lines folded at 75 octets. It has no network-dependent fields. With no valid entries it returns ''.

### Profile additions (`profile.v1`)
- `usePlusTags` (boolean, default false): "Give each program its own plus address". When on, My info previews e.g. `jane+similac@gmail.com` (updated on blur and on toggling, not per keystroke), the guided run offers both "Email for this program" and "Email (plain)", and the tracker shows each program's address.
- `plusTagMap` (`{id: tag}`): assigned for every program when plus tags are first turned on, and for new programs on later loads. A stored tag is never changed or reused. `BFF.plusTags.map()` and `forProgram(p)` (in `profile.js`) read it; `tools/autofill` reads `profile.plusTagMap[id]` first, then falls back to `BFF.email.tagMap`.
- Backups (`exportJSON({includeProfile:true})`) include `usePlusTags` and `plusTagMap`; import accepts both (map entries only fill ids that have none, and never reuse a tag).
- Tracker entries gain an optional `signedUpAt` ISO string, set when the status changes to `signed-up`. It is exported and accepted on import. Reminders count from `signedUpAt`, falling back to `updatedAt` for older data. `BFF.tracker.getEntry(id)` and `restoreEntry(id, entry)` support the guided run's Undo.
- Prefs: `prefs.v1.gmailAccount` (0 to 9, default 0).

### Button automation
- **Guided run:**
  - The toggle "When I tap Done or Skip, open the next sign-up page", saved in `guided.v1` as `autoOpenNext` (default true), opens the next page inside the click handler, so it counts as a user gesture. The run records `opened` ids and never opens the same program twice in a run. It calls `window.open(url, '_blank')` and cuts `opener` right after, because the `noopener` feature makes `window.open` return null always and would hide blocked popups. When it returns null, the live region says "Popup blocked, use the Open button". The page sends no referrer (meta policy).
  - Single-key shortcuts are off by default (WCAG 2.1.4). A checkbox "Enable single-key shortcuts" inside the "Shortcuts" `<details>`, saved in `guided.v1` as `shortcuts`, turns them on: O open, C copy all, D done, S skip, P problem, B back, N next. They are ignored while typing in a text field, with modifier keys held, while composing, and for non-ASCII keys.
  - After Done or Skip an "Undo" button restores that program's previous status and note and returns to it. It stays until the next action.
  - `BFF.guided.preselect(ids)` sets the setup selection and replaces any run in progress; `BFF.guided.runInfo()` reports `{index, total}` of a run in progress or null.
- **Directory:** a "Start a guided run with these N" button that sets the guided selection to the currently filtered ids (via `BFF.guided.preselect(ids)`) and routes to `#guided`. If a run is in progress it first asks "Replace your current run?" with the inline `BFF.ui.confirm` panel.
- **Tracker:**
  - "Email me my checklist" (mailto, to the profile email) lists Signed up and Received programs, or all non-skipped ones if none are started. If the list was truncated, the full text is also copied, or shown in a text box if copying fails;
  - "Download Gmail filters" (shown for any email, with import steps: Gmail Settings > See all settings > Filters and Blocked Addresses > Import filters). "Skip the inbox" is enabled only with plus tags on; the UI says "For tidy, safe filters, turn on plus addresses in My info.";
  - "Download reminders (.ics)" for programs marked Signed up, 28 days after `signedUpAt`;
  - a per-row "Search my Gmail" link (Gmail only), with a "Gmail account number" setting.

### Allowed outbound links (updated)
Program `signupUrl` and `sourceUrls`, plus `mailto:` links to the person's own address and `https://mail.google.com/mail/u/<n>/#search/…` links, which open the person's own Gmail. The build test allowlist covers these and the two Gmail filter XML namespace URIs (`http://www.w3.org/2005/Atom`, `http://schemas.google.com/apps/2006`), which are never fetched.

### Repo automation (GitHub Actions)
- `.github/workflows/ci.yml` runs on every push and pull request: build, `git diff --exit-code`, then `node --test`.
- `.github/workflows/link-check.yml` runs weekly and from a "Run workflow" button. It runs `node scripts/check-links.mjs`, uploads the report, and opens or updates a `link-check` issue when a link is NOT-FOUND or OFF-DOMAIN; GitHub emails the repo owner. When all links are fine it closes the issue. Blocked sites (403, bot challenges) are reported but never fail the check, and are never retried with other user agents.

## Phase F: Gmail connection, iPhone fill script, links that always work (contract)
Goal: the app is fully usable on an iPhone, either as the Claude artifact or as the standalone page, with one optional connection (the person's own Gmail) and one optional helper (a fill script for Safari).

Hard rules, unchanged: the app never submits a sign-up form, never clicks through a bot check, never ticks consent boxes, never sends mail, never deletes or archives mail, and makes no network request of its own (`fetch`, XHR, beacons and the rest stay banned by the build test). Gmail is reached only through the Claude viewer's connector runtime, only after a tap.

### Two build outputs
`node scripts/build.mjs` writes both, deterministically:
- `index.html`: the standalone page, as before (full document, CSP meta).
- `artifact.html`: the same app as a Claude artifact fragment. No doctype, `<html>`, `<head>`, `<body>` or CSP meta (the Artifact tool adds its own skeleton and CSP). It starts with `<title>Baby Freebies Finder</title>`, then `<meta name="claude:viewport-fit-sides" content="cover">`, then the `<style>`, then the body markup, the data block and the script. It is built from the same `src/index.html` shell by taking the title and the body's inner HTML.

Artifact frame facts the code must respect (from the Artifact page contract):
- `<a download>` and script-started downloads are inert. Files go through the `downloads` capability.
- `window.open` returns null for most viewers. Every outbound link must be a real `<a href target="_blank" rel="noopener noreferrer">` the person taps.
- `mailto:` and other app links may do nothing, and the page cannot tell. Always show the text with a Copy button beside any mailto link, and never say a message was sent.
- `alert`, `confirm`, `prompt` and `window.print` do nothing.
- Only plain `#name` hashes work. Route names stay `directory`, `info`, `tracker`, `guided`, `safety` (never `settings`, `sidebar`, `customize`, `upgrade`, `downloads`, `comment-*`).
- Side gutter: `padding-left: max(16px, env(safe-area-inset-left, 0px))` and the same on the right, on one outer wrapper. A sticky header uses `top: env(safe-area-inset-top, 0px)`. The fixed bottom nav adds the bottom inset. Keep the skeleton's `:root` padding.

### New files, load order and owners
JS order in both outputs: `logic.js`, `store.js`, `email.js`, `zip.js`, `host.js`, `fieldmatch.js`, `fillscript.js`, `inbox.js`, `tracker.js`, `profile.js`, `directory.js`, `guided.js`, `inboxview.js`, `phone.js`, `app.js`. CSS order: `base.css`, `features.css`, `phase-f.css`.

| File | Owner | Purpose |
|---|---|---|
| `scripts/build.mjs`, `src/index.html`, `src/css/base.css`, `src/js/app.js` | F1 | two outputs, safe-area gutter, apple-touch-icon, routing |
| `src/js/zip.js` | F1 | `BFF.zip.store(files)`: stored (no compression) ZIP with CRC-32, UMD, Node-testable |
| `src/js/host.js` | F1 | `BFF.host`: where the page runs and how files, copying and links behave there |
| `src/js/tracker.js` | F1 | uses `BFF.host` for every file and mailto; mounts the inbox panel |
| `src/js/guided.js`, `src/js/directory.js` | F1 | links that work without `window.open` |
| `scripts/check-links.mjs`, `.github/workflows/*`, `tests/check-links.test.mjs` | F1 | link check covers `signupUrl` and every `sourceUrls` entry |
| `tests/build.test.mjs`, `tests/host.test.mjs` | F1 | both outputs, zip, host helpers |
| `src/js/inbox.js` | F2 | `BFF.inbox`: pure Gmail logic, UMD, Node-testable |
| `src/js/inboxview.js` | F2 | `BFF.inboxView.mount(el)`: the "Gmail connection" panel |
| `src/css/phase-f.css` (section `/* inbox */`) | F2 | panel styles, tokens from `base.css` only |
| `tests/inbox.test.mjs` | F2 | |
| `src/js/fieldmatch.js` | F3 | the field matcher moved from `tools/autofill/field-matcher.mjs`, UMD |
| `tools/autofill/field-matcher.mjs` | F3 | thin wrapper re-exporting `src/js/fieldmatch.js`; existing tests keep passing unchanged |
| `src/js/fillscript.js` | F3 | `BFF.fill`: builds the fill script and bookmarklet, UMD |
| `src/js/phone.js` | F3 | `BFF.phoneView.mount(el)`: "Fill forms on your phone" panel |
| `src/js/profile.js` | F3 | mounts the phone panel at the end of My info |
| `src/css/phase-f.css` (section `/* phone */`) | F3 | |
| `tests/fillscript.test.mjs` | F3 | |

Mount points (so builders do not edit each other's files): `tracker.js` calls `BFF.inboxView && BFF.inboxView.mount(node)` with an empty `<div id="trk-inbox">` placed right after the "Email and calendar" card. `profile.js` calls `BFF.phoneView && BFF.phoneView.mount(node)` with `<div id="info-phone">` at the end of the view. `guided.js` shows a one-line hint ("Filling on your phone? Set up the fill script in My info.") linking to `#info`. Both `mount` functions must tolerate being called before or after their script loads (views init at boot, after all scripts).

### `BFF.host` (`src/js/host.js`)
- `inArtifact`: `!!(window.claude && typeof window.claude.use === 'function')`. There is no other `window.claude` member to read.
- `use(name)`: `Promise` of the capability namespace or `null`. Without a runtime it resolves `null` at once. Never throws. The first call happens on a user gesture or after first paint, never during the first synchronous run.
- `saveFile({name, text, mime})`: `Promise<{status, name}>` with status `saved`, `declined`, `shown` or `failed`.
  - Standalone: Blob plus `a[download]`, as today, status `saved`.
  - Artifact: `downloads.save({filename, data})`. Allowed extensions are gif png jpg jpeg webp mp4 webm mov txt json md docx pptx epub csv ttf html svg pdf xlsx zip fig. A file with another extension (`.xml`, `.ics`, `.vcf`) is wrapped in `<name>.zip` with `BFF.zip.store`. Branch on the rejection `code`: `declined` gives status `declined` with no retry; `rate_limited` tells the person to wait a moment; anything else falls through to `shown`.
  - `shown`: the caller gets the text shown in a read-only `<textarea>` with a Copy button (helper `BFF.host.showText({after, label, text})`), so nothing is ever a dead end.
- `copyText(text)`: `Promise<boolean>`; `navigator.clipboard.writeText` inside the click handler, falling back to selecting a temporary textarea with `document.execCommand('copy')`, then `false`.
- `canPopup`: false in the artifact. The guided run's "open the next page automatically" option is hidden there; Done and Skip move focus to the next program's "Open sign-up page" link instead, which is a real anchor.
- `mailtoNote`: in the artifact, mailto links are labelled "May not open from here" and the Copy path is the primary button.

### `BFF.zip` (`src/js/zip.js`)
`store([{name, text}])` returns a `Uint8Array`: local headers, stored data, central directory, end record, UTF-8 names (flag bit 11), fixed DOS date 1980-01-01 so output is deterministic, CRC-32 computed with a table. `crc32(bytes)` is exported for tests (compare with `node:zlib` `crc32`).

### `BFF.inbox` (`src/js/inbox.js`), pure
The connector is the viewer's own Gmail, declared at publish as `mcp: {servers: [{server: "Gmail", tools: ["search_threads", "list_labels", "create_label", "label_thread", "create_draft"]}]}`. Nothing else is declared, so the page cannot send, delete, trash or archive.

Observed shapes (field names only; never put real values in code, tests or docs):
- `search_threads` input `{query, pageSize (max 50), pageToken?, view: "SUMMARY"}`. Result payload is `{}` when nothing matches, else `{threads: [{id, messageCount, viewUrl, messages: [{id, threadId, date (ISO 8601), internalDate (ms as a string), labelIds[], sender (email string), addressDisplayNames: [{displayName, emailAddress}], snippet (HTML-entity-encoded text), subject, toRecipients[], viewUrl}]}], nextPageToken?, resultCountEstimate (string)}`. `viewUrl` looks like `https://mail.google.com/mail/?authuser=<address>#all/thread-f:<id>`.
- `list_labels` input `{}`; payload `{labels: [{labelId, name, labelType: "SYSTEM"|"USER", ...}]}`.
- `create_label` input `{displayName}`; `label_thread` input `{threadId, labelIds: [labelId]}`.
- `create_draft` input `{to: [address], subject, body (plain text), attachments?: [{content (base64), filename, mimeType}]}`; the result has `id` and may have `viewUrl`.
Treat every field as optional and every payload as untrusted text: render with `textContent`, decode entities with a small pure decoder (never `innerHTML`), and open only `viewUrl` values that pass `safeViewUrl` (must start with `https://mail.google.com/mail/`).

Functions:
- `buildQueries({programs, email, tagMap, usePlus, days})`: Gmail search strings, each under 1,500 characters, that together cover every program: `to:(plus address)` terms when plus tags are on, and `from:(registrable domain)` terms for domains that are not broad (`BFF.email.isBroadDomain`). Terms are OR-ed in braces, with `newer_than:<days>d` (default 120). Returns `[{query, programIds}]`.
- `matchThreads(threads, {programs, email, tagMap})`: `[{programId, threadId, subject, snippet, from, date, viewUrl, certainty, kind}]`, newest first, one per thread. `certainty` is `exact` when a recipient equals the program's plus address, `likely` when the sender's registrable domain equals the program's domain and that domain belongs to exactly one program and is not broad. Anything else is dropped.
- `classify({subject, snippet})`: `confirm` (asks the person to confirm or verify an address), `shipped` (shipped, on its way, out for delivery, delivered), `welcome` (welcome, thanks for signing up or joining, you're in), or `other`.
- `suggest(matches, statusOf)`: at most one suggestion per program: `welcome` or `confirm` on a `todo` program suggests `signed-up`; `shipped` suggests `received` only when the text says delivered, otherwise keeps `signed-up` with a note. Never suggests moving a status backwards and never touches `skipped`.
- `accountFromViewUrl(url)`: the `authuser` address, or `''`.
- `safeViewUrl(url)`, `decodeEntities(text)`.
- `checklistDraft({email, programs, statusOf})` and `kitDraft({email, files})`: `create_draft` inputs. `to` is always exactly the person's own address. Attachments are base64 of text the app generated (reminders `.ics`, Gmail filters `.xml`).
- `errorCopy(code)`: one short sentence per `McpError` code. Groups: `consent_required`, `approval_required`, `not_granted` (the person said no: explain, offer no retry button this page load); `needs_reauth`, `server_not_connected`, `server_not_found`, `selection_required` (Gmail is not connected in Claude: say where to connect it); `rate_limited`, `server_unavailable`, `upstream_error` (try again later; one automatic retry only when `retryable` is true and only for reads); `blocked_by_policy`, `not_in_manifest`, `capability_disabled`, `capability_removed`, `self_only`, `user_changed` (not available here: hide the feature and drop any mail data on screen); `tool_error`, `bad_request`, `cancelled`, `transform_error` (plain failure message). Unknown codes read as unavailable.

### `BFF.inboxView` (`src/js/inboxview.js`)
A card titled "Gmail connection" in the tracker.
- Standalone page, or `use("mcp")` resolves `null`: the card says the connection works when the app is opened as a Claude artifact with Gmail connected, and points to the existing "Search my Gmail" links. No buttons that cannot work.
- With `mcp`: buttons, each calling the connector only inside its click handler:
  1. **Check my Gmail**: runs the `buildQueries` searches one at a time, read-only, and lists matches grouped by program with subject, sender, date, a "needs you to confirm" badge for `confirm`, and an "Open in Gmail" link. Suggestions appear as "Mark Similac as Signed up" buttons plus one "Apply all N"; statuses change only when tapped, through `BFF.tracker.setStatus`, with the tracker's normal Undo-free flow (a line says what changed).
  2. **Use this address**: when My info has no email and a result reveals the account address, offer to fill it in. Only on tap.
  3. **Label these in Gmail**: `list_labels`, then `create_label` "Baby Freebies" if it is missing, then `label_thread` for each exact or likely match. Shows a count first and asks with the inline `BFF.ui.confirm` panel. A write is never retried automatically.
  4. **Draft my checklist** and **Draft my setup kit**: `create_draft` to the person's own address. The message says "Draft created in your Gmail. Nothing was sent." with a link when `viewUrl` is safe.
- Nothing from the mailbox is stored. Only `prefs.v1.inboxCheckedAt` (ISO time) is saved. Results live in memory and are cleared on any authorization-type error.
- A live region announces progress and results. Buttons are disabled while a call runs.

### `BFF.fieldmatch` and `BFF.fill` (fill script for Safari on iPhone, and any desktop browser)
- `src/js/fieldmatch.js` exposes the same API the autofill helper already has: `cleanText`, `registrableDomain`, `sameSite`, `isGuidedDefault`, `classifyField`, `valueFor`. One source of truth for the app, the fill script and `tools/autofill`.
- `BFF.fill.build({profile, programs, tagMap})` returns a self-contained script string. It holds the matcher (via `Function.prototype.toString()` of its factory), a JSON blob with the person's details, and a list of `{domain, id, name, email}` for programs (email is the plus address when plus tags are on).
- What the script does when run on a page:
  1. Works out the page's registrable domain. If it is not the domain of a program in the list, it changes nothing and reports "This is not one of the official sign-up sites in your list", showing the domain.
  2. Otherwise it scans visible, enabled `input`, `select` and `textarea` elements in the top document (same-origin iframes included), classifies each with `classifyField`, and fills the ones that are empty, using the native value setter and dispatching `input` and `change` so frameworks notice.
  3. It never clicks anything, never submits, never ticks a checkbox or radio, never fills password, card, SSN, security-question or one-time-code fields (the matcher's skip rules), and never overwrites a field that already has text.
  4. It shows a small banner at the top of the page: "Filled N fields. Check them, tick any boxes yourself, and submit when you are ready." with a Close button. The banner uses `textContent` only.
  5. It returns a plain result `{ok, filled, skipped, domain, message}`, and calls `completion(result)` when that function exists (the Shortcuts "Run JavaScript on Web Page" action requires it).
- `BFF.fill.bookmarklet(script)` returns a `javascript:` URL.
- The script is plain ES5-compatible code with no network calls, no `eval`, no storage access.
- `BFF.phoneView` ("Fill forms on your phone", in My info): explains the three ways in order of effort: (a) Safari AutoFill from your contact card, (b) the Shortcut with one "Run JavaScript on Web Page" action, (c) a bookmarklet. Buttons: "Copy fill script", "Copy bookmarklet", "Save fill script as a file". A warning says the script contains your details, so keep it private and make a new one after changing My info. Exact steps come from `research/phase-f/` and are filled in after the research lands.

### Links
- Every outbound anchor has `target="_blank" rel="noopener noreferrer"` and an `https:` href taken from the data or built by `BFF.email.gmailSearchUrl`, or it is a `viewUrl` that passed `safeViewUrl`.
- `scripts/check-links.mjs` checks `signupUrl` and every `sourceUrls` entry (deduplicated). The report lists each URL with the program ids that use it. BLOCKED (403, bot challenge) still never fails the run and is never retried with another user agent.
- Allowed URL prefixes in the build test: the Phase E list, plus `https://mail.google.com/mail/` (the `safeViewUrl` prefix).

### Tests
- `node --test` (CI): all existing tests, plus `host`, `inbox`, `fillscript`, and build tests for both outputs (fresh-build match, no external resources, no network APIs, URL allowlist; `artifact.html` has no doctype, `<html>`, `<head>`, `<body>` or CSP meta and starts with `<title>`).
- `node tests/e2e/run.mjs` (local, needs the preinstalled Playwright; not part of CI): phone-size checks of both outputs, every link and route, the mocked `window.claude` flows for downloads and Gmail (mock built from the type files and the shapes above, synthetic values only), and the fill script against fixture forms served by request interception for official program URLs.
