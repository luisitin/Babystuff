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
JS order in both outputs: `logic.js`, `store.js`, `email.js`, `zip.js`, `host.js`, `fieldmatch.js`, `fillscript.js`, `inbox.js`, `tracker.js`, `profile.js`, `directory.js`, `guided.js`, `inboxview.js`, `phone.js`, `app.js`. CSS order: `base.css`, `features.css`, `inbox.css`, `phone.css` (plus `artifact.css`, appended only in `artifact.html`).

| File | Owner | Purpose |
|---|---|---|
| `scripts/build.mjs`, `src/index.html`, `src/css/base.css`, `src/css/features.css`, `src/css/artifact.css`, `src/js/app.js` | F1 | two outputs, safe-area gutter, routing; `artifact.css` holds the few rules only the artifact needs (the skeleton already pads `:root` by the top and bottom safe-area insets) |
| `src/js/zip.js` | F1 | `BFF.zip.store(files)`: stored (no compression) ZIP with CRC-32, UMD, Node-testable |
| `src/js/host.js` | F1 | `BFF.host`: where the page runs and how files, copying and links behave there |
| `src/js/tracker.js` | F1 | uses `BFF.host` for every file and mailto; mounts the inbox panel |
| `src/js/guided.js`, `src/js/directory.js` | F1 | links that work without `window.open` |
| `scripts/check-links.mjs`, `.github/workflows/*`, `tests/check-links.test.mjs` | F4 | link check covers `signupUrl` and every `sourceUrls` entry |
| `tests/build.test.mjs`, `tests/host.test.mjs` | F1 | both outputs, zip, host helpers |
| `src/js/inbox.js` | F2 | `BFF.inbox`: pure Gmail logic, UMD, Node-testable |
| `src/js/inboxview.js` | F2 | `BFF.inboxView.mount(el)`: the "Gmail connection" panel |
| `src/css/inbox.css` | F2 | panel styles, tokens from `base.css` only |
| `tests/inbox.test.mjs` | F2 | |
| `src/js/fieldmatch.js` | F3 | the field matcher moved from `tools/autofill/field-matcher.mjs`, UMD |
| `tools/autofill/field-matcher.mjs` | F3 | thin wrapper re-exporting `src/js/fieldmatch.js`; existing tests keep passing unchanged |
| `src/js/fillscript.js` | F3 | `BFF.fill`: builds the fill script and bookmarklet, UMD |
| `src/js/phone.js` | F3 | `BFF.phoneView.mount(el)`: "Fill forms on your phone" panel |
| `src/js/profile.js` | F3 | mounts the phone panel at the end of My info |
| `src/css/phone.css` | F3 | panel styles, tokens from `base.css` only |
| `tests/fillscript.test.mjs` | F3 | |

Mount points (so builders do not edit each other's files): `tracker.js` calls `BFF.inboxView && BFF.inboxView.mount(node)` with an empty `<div id="trk-inbox">` placed right after the "Email and calendar" card. `profile.js` calls `BFF.phoneView && BFF.phoneView.mount(node)` with `<div id="info-fill">` at the end of the view (not `info-phone`: that id already belongs to the Phone input in My info). `guided.js` shows a one-line hint ("Filling on your phone? Set up the fill script in My info.") linking to `#info`. Both `mount` functions must tolerate being called before or after their script loads (views init at boot, after all scripts).

### Parallel build protocol
Builders F1 to F4 work in the same tree at the same time. Each edits only the files it owns, runs only its own test files, and does not run git commands that change the tree or the index (`add`, `commit`, `stash`, `checkout`, `reset`, `restore`). Only F1 runs `node scripts/build.mjs` in the repo root; everyone else copies the repo to a scratch directory to build or to try the page in a browser. The orchestrator integrates, builds, runs the full test suite and commits. Code against the contract below when another owner's file is still a stub, and guard optional globals (`BFF.host && ...`).

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
  4. **Draft my checklist** and **Draft my setup kit**: `create_draft` to the person's own address. The message says "Draft saved in your Gmail. Nothing was sent." (only after the connector confirmed the draft) with a link when `viewUrl` is safe.
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

## Phase G: what is really free, ranking, and a plan by due date (contract)

Why: the person using the app is expecting a baby and wants to claim every offer worth claiming. Their feedback on the live app: the "Truly free" filter showed sweepstakes, coupons and points instead of things where real free samples arrive, and there was no way to see which offers are the good ones. Phase G fixes the filter, ranks every program by what it is worth, and widens the research to money and benefit programs.

Nothing in the product rules changes: no network calls, no form submission, personal details only in localStorage.

### New program fields (all required on every entry in `data/programs.json`)
| Field | Type | Rules |
|---|---|---|
| `offers` | string[] | Not empty. What the program gives, most important first. Only from: `product`, `coupons`, `points`, `sweepstakes`, `service`, `coverage`, `cash`, `testing` |
| `certainty` | string | How sure the first `offers` entry is: `guaranteed`, `likely`, `if-eligible`, `chance` |
| `freeStuff` | string | One short sentence: what arrives at no cost and with no purchase. `""` when nothing does |
| `valueLow`, `valueHigh` | integer or null | Rough US dollar value to one family in the baby's first year. Both null when no fair figure exists. `valueLow <= valueHigh` |
| `valueSource` | string | `official` (the official page states a dollar figure), `estimate` (worked out from what the official page lists), `none` (both values null) |
| `valueBasis` | string | How the figure was reached, in a few words. `""` only when `valueSource` is `none` |
| `effort` | string | `quick` (a short form, about 5 minutes), `some` (a registry, an app, a phone call), `involved` (an application, documents or an appointment) |
| `when` | string | Best time to do it: `pregnancy` (now, while pregnant), `late-pregnancy` (the last 4 to 8 weeks), `after-birth`, `anytime` |
| `whenNote` | string | The official reason for the timing, or `""` |
| `states` | string[] | USPS codes when the program is only for some states (include `DC`). `[]` when it is nationwide or varies by local office |

Meaning of `offers` values:
- `product`: physical things you keep. Samples, full-size items, welcome boxes, gear (pump, crib, car seat), books, food packages.
- `coupons`: coupons, formula checks, percent-off or completion discounts, free-with-purchase offers.
- `points`: reward points earned by buying or scanning receipts.
- `sweepstakes`: prize draws.
- `service`: free help from a person (lactation visit, car seat check, helpline, home visits, classes).
- `coverage`: health coverage or a benefit that pays bills (Medicaid, CHIP, marketplace plans).
- `cash`: money for the family or the child (account deposits, tax credits, paid leave).
- `testing`: product-testing panels where you may be picked.

Rule for the order: if a real product is sent with no purchase, `product` comes first, even when the brand talks more about its coupons or its sweepstakes.

Meaning of `certainty` values:
- `guaranteed`: everyone who signs up and meets the plain conditions gets it.
- `likely`: most people get it, but the official page says "while supplies last", "may include" or "varies".
- `if-eligible`: certain once you meet income, insurance, state or similar rules.
- `chance`: a draw or a selection. Most people get nothing.

Value rules: count only what a family gets without buying something just to get it. For coupons and points, count the saving on things they would buy anyway. Use `official` only when the official page gives the figure. An `estimate` uses ordinary US shelf prices, and `valueBasis` shows the sum (for example "2 sample cans at about $20 each"). Never present an estimate as the brand's own figure. For `coverage` and `cash`, estimate the bills paid or the money received and say what the figure rests on; a free service with no usual price keeps null values.

New category: `money` ("Money and savings"), for cash programs such as account deposits for newborns, tax credits and paid leave. It goes after `assistance` in `CATEGORIES`.

### `BFF.logic` additions and changes
- `OFFER_LABELS`: product → "Free product", coupons → "Coupons and discounts", points → "Reward points", sweepstakes → "Prize draw", service → "Free service", coverage → "Health coverage", cash → "Cash", testing → "Product testing".
- `CERTAINTY_LABELS`: guaranteed → "Everyone who signs up gets it", likely → "Most people get it, supplies vary", if-eligible → "Only if you qualify", chance → "Only if you are picked or win".
- `EFFORT_LABELS`: quick → "About 5 minutes", some → "Takes some setup", involved → "Application or appointment".
- `WHEN_LABELS`: pregnancy → "Now, while pregnant", late-pregnancy → "In the last weeks before the due date", after-birth → "After the baby arrives", anytime → "Any time". `WHEN_ORDER` is that order.
- `VERDICTS`: ordered list of `{id, label}`: top → "Top pick", good → "Worth doing", small → "Also free", conditional → "Only if you would buy anyway", longshot → "Long shot".
- `isTrulyFree(p)` (changed): `costToClaim === 'free'`, requirements include neither `purchase` nor `membership`, `offers[0] === 'product'`, and `certainty` is not `chance`. A program with no `offers` is not truly free.
- `isOpenToAll(p)`: `certainty !== 'if-eligible'` and `!isEligibilityBased(p)`.
- `guidedDefault(p)` keeps its formula (`isTrulyFree(p) && !isEligibilityBased(p)`), so it narrows with `isTrulyFree`.
- `valueMid(p)`: the mean of `valueLow` and `valueHigh`, or null.
- `expectedValue(p)`: `valueMid(p)` times a weight (guaranteed 1, if-eligible 1, likely 0.7, chance 0.1), or null.
- `verdict(p)`, first match wins:
  1. `longshot` when `certainty === 'chance'` or `offers[0]` is `sweepstakes` or `testing`
  2. `conditional` when `costToClaim !== 'free'`, or requirements include `purchase` or `membership`, or `offers[0]` is `coupons` or `points`
  3. `top` when `expectedValue(p) >= 100`
  4. `good` when `expectedValue(p) >= 20`
  5. `small` otherwise (including unknown value)
- `rankPrograms(list)`: a new array sorted by verdict order, then `expectedValue` high to low (null last), then effort (quick, some, involved), then confidence, then name. `rankMap(list)` returns `{id: position}` starting at 1.
- `sortPrograms(list, key)`: new key `best` (uses `rankPrograms`) and new key `when` (`WHEN_ORDER`, then rank). `recommended` stays as an alias of `best` so saved preferences keep working.
- `filterPrograms(list, opts)`: new options `offer` (keep programs whose `offers` include it), `openToAll` (keep `isOpenToAll`), `state` with `hideOtherStates` (drop programs whose `states` is not empty and does not include `state`). The text query also searches `freeStuff`.
- `valueText(p)`: "Worth about $40 to $60 (our estimate)", "Worth about $400 (the program's figure)", "Worth about $25 (our estimate)" when low equals high, or "Value not known".
- `totalValue(list)`: `{low, high, count}` over programs with a value.
- `weeksUntil(dueDate, today)`: whole weeks from `today` to an ISO `YYYY-MM-DD` date, negative after it, null when the date cannot be read.

### Directory (`src/js/directory.js`, `src/css/`)
- Sort options: "Best value first" (`best`, the default), "When to do it" (`when`), then the existing Name, Recently verified, Category, Confidence. A saved `recommended` loads as `best`.
- With `best`, the list is grouped under the verdict labels. With `when`, it is grouped under the `WHEN_LABELS`. Other sorts have no groups. Heading levels must not skip.
- New select "What you get": "Anything", then the eight `OFFER_LABELS`.
- Chips: "Truly free" (new meaning), "Open to everyone" (`openToAll`), "Email only", "Needs a registry". When "Truly free" is on, one line under the chips says: "Truly free: real products or samples at no cost. No purchase, no fee, not a prize draw."
- When My info has a state and some programs are for other states only, those are hidden and a line says "N programs for other states are hidden." with a "Show them" button (stored in prefs).
- Each card gains: its rank ("#3", from `rankMap` over all programs), the verdict badge, the offer kinds, a "Free with no purchase" line (`freeStuff`, or "Nothing arrives free without a purchase or a win."), the value line with `valueBasis`, the certainty label, the effort label, and "Best time" with `whenNote`.
- A summary above the list: how many truly free programs there are and their combined value (labelled as an estimate), and, when My info has a due date, the weeks left and how many programs are best done now, in the last weeks, and after the birth. Without a due date it says to add one in My info. The due date is read from `profile.v1` and never leaves the page.

### Guided run, tracker and helper
- `guided.js`: the default selection is still `guidedDefault`; the queue follows `rankPrograms`. The "Truly free only" button uses the new meaning.
- `tracker.js`: the summary shows the combined value of programs marked Signed up or Received, labelled as an estimate. No stored data changes shape.
- `tools/autofill`: `--all-free` still follows `guidedDefault`.

### Research (`research/phase-g/`)
Seven lanes, each owning the existing programs in its categories (adding the new fields and correcting anything that changed) and looking for programs the list lacks: `formula-feeding`, `diapers-babycare`, `registry`, `health-benefits`, `assistance`, `rewards-testing`, `money`. Each writes `<lane>.json` (full program objects) and `<lane>-notes.md`. The shared brief is `research/phase-g/BRIEF.md`. A merge step writes `data/programs.json`; a fact-check step re-reads the highest-ranked entries.

### Tests
- `tests/data.test.mjs`: the new fields, their enums, `valueLow <= valueHigh`, `valueSource` agreeing with the values, `states` as USPS codes, and the `money` category.
- `tests/logic.test.mjs`: the new truly-free rule (a sweepstakes-first or coupons-first program is not truly free), verdicts, ranking order, new filters, `valueText`, `totalValue`, `weeksUntil`.
- A data test pins the user's complaint: no program whose first offer is `sweepstakes`, `coupons`, `points` or `testing` passes `isTrulyFree`.
- `tests/e2e/run.mjs`: the new sort, groups, select, chips, card lines and summary in both outputs.

### Phase G, round 2 (after the second research wave)

The second wave added many programs for single states and many "if you qualify" benefits. Round 2 keeps them from crowding the list for people they do not apply to, and makes the totals honest.

New optional field `sameAs` (string, `""` when none): the `id` of the main program when this entry is only another door to the very same benefit, so one family can get it once (for example four suppliers of the one insurance-covered breast pump). It must name an existing program, not itself, and the main program's own `sameAs` is `""`.

`BFF.logic`:
- `money(n)`: whole dollars with thousands separators ("$3,200"). Exported. `valueText` uses it.
- `roundTotal(n)`: for combined figures only. Under 1,000 it rounds to the nearest 10, otherwise to the nearest 100.
- `hiddenByState(p, state)`: true when `p.states` is not empty and `state` is empty or not in the list. `filterPrograms` uses it for `hideOtherStates` (so with no state, every state-limited program is dropped). `otherStateCount(list, state)` counts by the same rule.
- `verdict(p)`: one change. A free program with unknown value whose first offer is `coverage` is `good`, not `small`.
- `totalValue(list)`: programs are grouped by `sameAs || id`; each group counts once, with its largest `valueHigh` (and that program's `valueLow`). `count` is the number of groups with a value.
- `needsQualifying(p)`: `!isOpenToAll(p)`.

Directory:
- State: programs hidden by state are left out unless the person taps "Show them" (`prefs.showOtherStates`). With no state in My info the line reads "N programs are only for some states. Add your state in My info to see the ones for you." (with a link to My info and the "Show them" button). With a state it reads "N programs for other states are hidden." Ranks (`rankMap`) and the summary are worked out over the programs left after this step, so the numbers have no gaps.
- Summary, first line: the count of programs that are truly free and open to everyone, with their combined value (through `roundTotal`, labelled as our estimate). Second line: "N more are free if you qualify (income, insurance or where you live)." with no sum, because several of them are alternatives. The due-date lines stay.
- Card: an "If you qualify" tag beside the verdict when `certainty` is `if-eligible`; an "In your state" tag when `states` includes the person's state; when `sameAs` is set, a line "Another way to get the same thing as <main program name>. You only need one."
- Card layout: always visible are rank, verdict, name, brand, the free line, the value line, the offer chips, How sure, Effort, Best time, Catches, the sign-up button and My status. Everything else (what you get in full, cost, what you need, who, where, notes, sources, verified date) sits in one "More details" disclosure.
- The filter chips wrap onto more lines at phone width. Nothing scrolls sideways.

Guided run and helper: programs hidden by state are not in the guided list or its default selection (same rule and same `showOtherStates` preference). `tools/autofill --all-free` skips them by the profile's state.

Tracker: the value line uses `totalValue`, so two doors to one benefit count once.

Data rules added in the second merge:
- A completion discount is valued on one scale: the discount percent times $200 (low) and times $600 (high) of registry items the family would buy anyway, under any official cap. `valueBasis` says so.
- Pregnancy coverage (Medicaid, CHIP, marketplace) keeps null values. No fair single figure exists.
- A tax credit that pays back part of a cost (dependent care) is `purchase-required` with `purchase` in `requirements`.

### Phase G, round 3 (Directory refinements)

- `freeNote(p)` (logic): the sentence on a card whose `freeStuff` is empty. Order: chance, sweepstakes or testing; purchase; membership; shipping fee; then by first offer (cash, coverage, service, coupons, points); else "What arrives is not stated."
- Same-thing groups: `groupKey(p)` = `sameAs || id`. `rankMap` gives every member of a group the same rank number (groups numbered in `rankPrograms` order, no gaps). `collapseGroups(sorted)` returns `[{ lead, others }]` in order of first appearance. The Directory shows the lead as a card and the others inside a native `<details class="same-group">` ("N more ways to get the same thing") right after it, in the same grid (it spans the full row). The section is decided by the lead. Section "(N)" counts leads; "Showing X of Y programs" still counts programs; the summary figures count distinct group keys. Open groups are remembered in memory only, and restored after a re-render.
- Summary: a "Show these" button turns on "Truly free" and "Open to everyone", then focuses the result count. Hidden when both are already on or the figure is 0.
- Guided and tracker use only `rankPrograms`, so they needed no change.

### Phase G, round 4 (review fixes)

- `totalValue(list)` also returns `missing`: the number of group keys (`sameAs || id`) where no member has a value. The tracker note "N programs with no known value are not counted" uses it, so doors to one benefit count once.
- `rankCmp` ends on `id`, so order never depends on data order. `isOtherState` is removed (`hiddenByState` is the one rule).
- Directory due-date buttons count the lead cards in the matching `when` section under the current filters, the state rule and `collapseGroups`. A button with a count of 0 is not shown, so the section it jumps to always exists. After the due date has passed only "after the birth" is offered. The accessible name starts with the visible text ("3 do now, show these programs").
- "Show these" also clears the search text, Category, "What you get", Email only and Needs a registry (the sort stays), so the list matches the summary figure.
- A saved `offer` and the label lookups use own-property checks.
- Plus-address tagging follows `BFF.email.inEmailFeatures(p)` everywhere: guided run, fill script (`programList`) and the phone view. Other programs get the plain address. When several listed programs share the page's domain and their addresses differ, the fill script still uses the plain address.
- `tools/autofill`: `hiddenByState(p, state)` lives in `field-matcher.mjs`. `--all-free` and `--from-backup` (`selectTodo`, option `state`) both use it. The backup's own profile state is used when the backup has My info, else `profile.json`.
