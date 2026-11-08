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
