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
- `tagFor(program, allPrograms)` returns a deterministic, unique, readable plus tag (`[a-z0-9-]`, at most 24 characters). The base is the first word of `brand` with parenthetical text removed, lowercased and stripped to `[a-z0-9]`, falling back to the first id segment. Programs that share a base are sorted by `id`. The first keeps the base, and each later one gets `base-<first id segment that isn't the base>`, plus `-2`, `-3` and so on if that still collides.
- `tagMap(allPrograms)` returns `{id: tag}`.
- `plusAddress(email, tag)` returns `local+tag@domain`. If the local part already has a `+`, the old suffix is replaced. Invalid or empty email gives `''`.
- `supportsPlus(email)` is true for gmail.com, googlemail.com, outlook.com, hotmail.com, live.com, icloud.com, me.com, fastmail.com, proton.me, protonmail.com and yahoo.com (Yahoo uses `-`; return false for yahoo and say so in the UI). Otherwise it returns null, meaning unknown: the UI says "check your provider".
- `gmailSearchUrl({email, tag, domain})` builds `https://mail.google.com/mail/u/0/#search/` + an encoded query: `to:(plus address)` OR `from:(domain)`, or just `from:(domain)` when there's no tag. Only used when the email is Gmail.
- `gmailFiltersXml(programs, {email, usePlus, archive})` returns Gmail's filter-import Atom XML: one entry per program with `to` (plus address, when usePlus) or `from` (signup domain), `label` = `Baby Freebies/<program name>` (with `/` in names replaced), and `shouldArchive` when `archive`. Values are XML-escaped.
- `mailtoChecklist({to, programs, statusOf})` returns a `mailto:` URL with the subject "Baby freebies checklist" and a body listing each program's name, status and signupUrl. It keeps the URL under 1,900 characters by truncating the list and adding "…and N more (see the app)". It also returns `{url, truncated, fullText}`.
- `icsReminders(entries, {days})` returns iCalendar text. One all-day VEVENT per entry `{id, name, date}` at `date + days` (default 28), titled "Check for <name> mail or box". It has a stable UID `<id>@baby-freebies-finder`, CRLF line endings and lines folded at 75 octets. It has no network-dependent fields.

### Profile additions (`profile.v1`)
- `usePlusTags` (boolean, default false): "Give each program its own plus address". When on, My info previews e.g. `jane+similac@gmail.com`, the guided run's Email copy uses the tagged address, and the tracker shows each program's address.
- Backups (`exportJSON({includeProfile:true})`) include `usePlusTags`.

### Button automation
- **Guided run:**
  - The toggle "When I tap Done, open the next sign-up page", saved in `guided.v1` as `autoOpenNext` (default true), calls `window.open` inside the Done click handler, so it counts as a user gesture.
  - Keyboard shortcuts while the run step is shown and focus isn't in a text field: O open, C copy all, D done, S skip, P problem, B back, N next. They're listed in a small "Shortcuts" `<details>`.
- **Directory:** a "Start a guided run with these N" button that sets the guided selection to the currently filtered ids (via `BFF.guided.preselect(ids)`) and routes to `#guided`.
- **Tracker:**
  - "Email me my checklist" (mailto, to the profile email; if the list was truncated, the full text is also copied);
  - "Download Gmail filters" (shown for any email, with import steps: Gmail Settings > See all settings > Filters and Blocked Addresses > Import filters), with an option to skip the inbox;
  - "Download reminders (.ics)" for programs marked Signed up, dated from their `updatedAt`;
  - a per-row "Search my Gmail" link (Gmail only).

### Allowed outbound links (updated)
Program `signupUrl` and `sourceUrls`, plus `mailto:` links to the person's own address and `https://mail.google.com/mail/u/0/#search/…` links, which open the person's own Gmail. The build test allowlist covers these and the two Gmail filter XML namespace URIs (`http://www.w3.org/2005/Atom`, `http://schemas.google.com/apps/2006`), which are never fetched.

### Repo automation (GitHub Actions)
- `.github/workflows/ci.yml` runs on every push and pull request: build, `git diff --exit-code`, then `node --test`.
- `.github/workflows/link-check.yml` runs weekly and from a "Run workflow" button. It runs `node scripts/check-links.mjs`, uploads the report, and opens or updates a `link-check` issue when a link is NOT-FOUND or OFF-DOMAIN; GitHub emails the repo owner. When all links are fine it closes the issue. Blocked sites (403, bot challenges) are reported but never fail the check, and are never retried with other user agents.
