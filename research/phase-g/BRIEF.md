# Shared research brief (Phase G)

You are one of seven research subagents for the Baby Freebies Finder, a web app listing legitimate US programs for a family expecting a baby. The family using it wants to claim every offer worth claiming, and told us the old list was weak in two ways: its "Truly free" filter showed sweepstakes, coupons and points instead of offers where real free samples arrive, and nothing said which offers are the good ones. Your job is to fix that for your lane: say exactly what each program gives, how sure it is, what it is worth and when to do it, and find good programs the list lacks.

Do not spawn subagents.

Read first: `CLAUDE.md` (research rules, product rules), the section "Phase G" at the end of `ARCHITECTURE.md` (the new fields and what each value means), and `data/programs.json` (the current list).

## Safety and privacy
- Only read. Never sign up, create an account, fill in or submit a form, or type personal information anywhere.
- Never put anything about the family in a search query. Use plain, general queries.
- This session's network is Limited. WebFetch and every other way of opening a page are refused by policy for brand and government sites. Do not try to get around that: no curl, no helper scripts, no mirrors, caches, archive sites or proxies. One WebFetch attempt on an official page is fine; when it is refused, move on.
- Use WebSearch, with `allowed_domains` set to the official domain, to see what the official site says. A blog, coupon site or forum is a lead only, never proof.
- Respect refusals. A 403, 429, CAPTCHA or bot challenge is an answer. Do not retry with other tools or settings.

## Research rules
- Use WebSearch to find programs and WebFetch to verify them. Confirm every program on the brand's or retailer's own site; `signupUrl` must be on that official domain. Blog roundups and coupon sites are leads, never proof.
- Record only what the official page says today. If a detail isn't there, leave it blank and lower the confidence. Never guess. If one official site blocks fetching, official-domain search results can back up the entry, but cap its confidence at medium.
- Leave out survey or "free box" lead-gen sites, anything asking for card details for a free item (a disclosed shipping fee is fine if labeled), unlabeled auto-renewing trials, look-alike sites, expired offers and non-US programs.
- Because nothing can be fetched in this session, every new entry is backed by official-domain search results and its `confidence` is `medium` at most (`low` when the results barely describe the offer).

## What to do
1. **Existing programs in your lane** (ids listed in your task). Copy each object from `data/programs.json` and add the new fields. Check with official-domain searches whether the offer still stands and what it really gives. Change an old field only when official-domain results show it is wrong or out of date, and write each change in your notes. Leave `verifiedOn` and `confidence` as they are unless you changed the entry on today's evidence (then set `verifiedOn` to today and `confidence` to `medium` at most). If a program has ended, do not delete it silently: leave it out of your JSON and say so in your notes with the evidence.
2. **New programs.** Find legitimate programs the list lacks, starting from the leads in your task. Quality over number: a program earns a place when a family really gets something from it. Prefer programs where a real product, service or money arrives with no purchase.
3. **Timing.** Fill `when` and `whenNote` from what the official source says (for example a window before the due date, or a deadline after the birth). The baby in question is due in early 2027, so check that each offer applies to a 2027 birth.

## Output
Write two files, saving the JSON after each program so nothing is lost:
1. `research/phase-g/<lane>.json`: a JSON array of full program objects, existing and new. Validate at the end with `node -e "JSON.parse(require('fs').readFileSync('research/phase-g/<lane>.json','utf8'))"`.
2. `research/phase-g/<lane>-notes.md`: what official-domain results showed for each entry, every change to an existing entry, what you left out and why, and anything unconfirmed.

## Schema (every field present; use "" or [] when unknown)
Old fields, unchanged: `id` (kebab-case, unique, brand first), `name`, `brand`, `category` (formula, diapers-wipes, registry-box, feeding, baby-care, rewards, health-benefits, assistance, money, product-testing), `whatYouGet` (1 or 2 plain sentences), `costToClaim` (free, shipping-fee, purchase-required, membership-required), `costDetail`, `requirements` (only from: email, address, phone, due-date, registry, app, purchase, membership, insurance, eligibility; `membership` means a paid membership, a free store account counts as `email`), `eligibility`, `region`, `signupUrl` (https, official domain, the page where you sign up or apply), `sourceUrls` (official https pages that back the entry), `verifiedOn` (YYYY-MM-DD), `confidence` (high, medium, low), `catches`, `notes`.

New fields:
| Field | Type | Rules |
|---|---|---|
| `offers` | string[] | Not empty, most important first, only from: `product`, `coupons`, `points`, `sweepstakes`, `service`, `coverage`, `cash`, `testing`. If a real product is sent with no purchase, `product` comes first, even when the brand talks more about coupons or a sweepstakes |
| `certainty` | string | Of the first offer: `guaranteed` (everyone who signs up and meets the plain conditions gets it), `likely` (most do, but "while supplies last", "may include", "varies"), `if-eligible` (certain once income, insurance, state or similar rules are met), `chance` (a draw or selection; most people get nothing) |
| `freeStuff` | string | One short plain sentence: what arrives at no cost and with no purchase. `""` when nothing does |
| `valueLow`, `valueHigh` | integer or null | Rough dollar value to one family in the baby's first year, counting only what they get without buying something just to get it. Coupons and points count as the saving on things they would buy anyway. Both null when no fair figure exists |
| `valueSource` | string | `official` (the official source states the dollar figure), `estimate` (you worked it out), `none` (both values null) |
| `valueBasis` | string | The sum in a few words, for example "2 sample cans at about $20 each" or "The program says up to $400 in gifts". `""` only with `none` |
| `effort` | string | `quick` (a short form, about 5 minutes), `some` (a registry, an app, a phone call), `involved` (an application, documents or an appointment) |
| `when` | string | `pregnancy` (now, while pregnant), `late-pregnancy` (the last 4 to 8 weeks), `after-birth`, `anytime` |
| `whenNote` | string | The official reason for the timing, or `""` |
| `states` | string[] | USPS codes (include `DC`) when only some states have it; `[]` when nationwide or decided by a local office |

Shelf prices to use for estimates, so the lanes agree: a full-size can of infant formula about $20, a small sample can or a few ready-to-feed bottles about $5, a formula check about $5 to $10, newborn diapers about $0.30 each, a pack of wipes about $3, a baby bottle about $6, a pacifier about $4, a board book about $5, a double electric breast pump about $150 to $300, an infant car seat about $100, a portable crib about $80, a lactation visit about $100 to $200. Be modest: when a kit "may include" items, take the low end. For `coverage` and `cash`, estimate the bills paid or money received and say what the figure rests on. A free service with no usual price keeps null values. Never present your estimate as the brand's own figure.

Keep strings short, plain and neutral. Don't copy marketing hype.

## Final reply (under 400 words)
Counts; each `id` with its first offer, certainty and value range; each change to an existing entry in one line; a one-line reason for each exclusion. Full detail belongs in the notes file.
