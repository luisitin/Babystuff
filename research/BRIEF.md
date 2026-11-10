# Shared research brief (Phase A)

You are one of seven research subagents for the Baby Freebies Finder, a web app listing legitimate US programs where someone expecting a baby can sign up (usually with just an email, sometimes an address or a registry) for free formula, diapers, wipes, feeding gear, baby-care samples, registry welcome boxes, rewards, and eligibility-based benefits.

Do not spawn subagents.

## Safety
- Only read pages. Never sign up, create an account, fill in or submit any form, or type personal information anywhere.
- **How to fetch pages.** WebFetch can't reach brand sites in this container. Its local DNS still follows the network allowlist from before the user approved Full network access, so it fails with `getaddrinfo ENOTFOUND`. The session's policy-enforcing HTTPS proxy does follow the approved policy, so use this helper, which goes through that proxy:
  `node /tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/tools/fetch-page.mjs <https-url> [maxChars=12000] [offset=0]`
  It identifies itself honestly (`BabyFreebiesFinder-research/1.0`) and prints the HTTP status, final URL, title, meta description and readable text, with link targets in [brackets]. Pass `offset` to read further down a long page. Try WebFetch first only if you want; when it fails with ENOTFOUND, use the helper.
- **Respect refusals.** If a site answers 403/429, shows a CAPTCHA or bot challenge, or returns only an empty JavaScript shell, accept that. Don't retry with other user agents, headers, curl flags or tools. Back the entry with WebSearch results restricted to that official domain (`allowed_domains`), cap confidence at medium, and list the site as blocked in your notes.
- Be polite: fetch only the pages you need, one at a time. Never use mirrors, caches, archive.org or other proxies.

## Research rules
- Use WebSearch to find programs and WebFetch to verify them. Confirm every program on the brand's or retailer's own site; `signupUrl` must be on that official domain. Blog roundups and coupon sites are leads, never proof.
- Record only what the official page says today. If a detail isn't there, leave it blank and lower the confidence. Never guess. If one official site blocks fetching, official-domain search results (WebSearch with `allowed_domains` set to the brand's domain) can back up the entry, but cap its confidence at medium.
- Leave out survey or "free box" lead-gen sites, anything asking for card details for a free item (a disclosed shipping fee is fine if labeled), unlabeled auto-renewing trials, look-alike sites, expired offers and non-US programs.
- If most WebFetch calls come back 403 or blocked, the network is probably restricted. Stop, write what you have, and say so in your reply. Don't use mirrors or caches.

## Output
Write two files, updating the JSON after each program you verify so nothing is lost:
1. `research/<slug>.json`: a JSON array of program objects (schema below). Validate it at the end with `node -e "JSON.parse(require('fs').readFileSync('research/<slug>.json','utf8'))"`.
2. `research/<slug>-notes.md`: what you verified, what you left out and why (with the URL that showed it), anything unconfirmed, and any sites that blocked fetching.

## Schema (every field present; use "" or [] when unknown)
| Field | Type | Rules |
|---|---|---|
| `id` | string | kebab-case, unique, brand first, e.g. `similac-mysimilac-rewards` |
| `name` | string | program name as the brand writes it |
| `brand` | string | |
| `category` | string | one of: `formula`, `diapers-wipes`, `registry-box`, `feeding`, `baby-care`, `rewards`, `health-benefits`, `assistance`, `product-testing` |
| `whatYouGet` | string | 1-2 plain sentences, only what the official page says (e.g. "Welcome kit that may include formula samples, plus coupons and points on purchases") |
| `costToClaim` | string | one of: `free`, `shipping-fee`, `purchase-required`, `membership-required` |
| `costDetail` | string | e.g. "Free to join", "Must spend $10 on registry items", "Requires Amazon Prime or a $10 purchase" |
| `requirements` | string[] | only from: `email`, `address`, `phone`, `due-date`, `registry`, `app`, `purchase`, `membership`, `insurance`, `eligibility` (`due-date` = due date or baby's birth date; `eligibility` = income, state or other qualifying rules) |
| `eligibility` | string | who qualifies, e.g. "US residents 18+, expecting or with a baby under 12 months" |
| `region` | string | e.g. "US", "US (contiguous states only)", "Varies by state" |
| `signupUrl` | string | https, on the official domain, the page where you actually sign up or apply |
| `sourceUrls` | string[] | official https pages you read to verify the entry (include terms/FAQ pages) |
| `verifiedOn` | string | today's date from `date +%F`, only for entries you confirmed on an official page today |
| `confidence` | string | `high` = official page fetched today confirms the offer, what you get and how to claim; `medium` = official page confirms the program but some details are missing, or the site blocked fetching and official-domain search results back it up; `low` = official page exists but barely describes the offer |
| `catches` | string | auto-renewing trials, heavy marketing email, SMS, data sharing with partners, purchase thresholds, "while supplies last", samples not guaranteed. "" if none found |
| `notes` | string | short useful tips from the official page, e.g. "Sample availability varies"; never invented |

Keep strings short and neutral. Don't copy marketing hype.

## Final reply (under 400 words)
Counts, each `id` with its confidence, a one-line reason for each exclusion, and any blocked sites. Full detail belongs in the notes file.

## Who covers what (stay in your lane; skip leads assigned to others)
1. **formula**: MySimilac Rewards, Enfamil Family Beginnings, MyGerber / Gerber Good Start, Bobbie, Kendamil, ByHeart, Earth's Best, store-brand formula (Target, Walmart, Costco, Amazon, etc.), other formula brands
2. **diapers-wipes**: Pampers Club/Rewards, Huggies Rewards and newborn offers, Honest Company, Hello Bello, Coterie, WaterWipes, Luvs, Seventh Generation, other diaper and wipe brands
3. **registry-box**: Amazon, Target, Walmart (and its postpartum box), Babylist, MacroBaby, buybuy BABY, Pottery Barn Kids, Crate & Kids, other registry welcome boxes or completion discounts
4. **feeding-baby-care**: Dr. Brown's, Philips Avent, MAM, NUK, Lansinoh, Medela, Dove Baby, Aveeno Baby, baby-food brands (not Gerber or Earth's Best, which formula covers), other bottle, pump-accessory and baby-skincare brands
5. **health-assistance**: insurance-covered breast pumps and how to claim one, WIC, Medicaid and CHIP pregnancy coverage, diaper banks, hospital take-home kits, other government or nonprofit help
6. **rewards-testing**: P&G Good Everyday, What to Expect, BabyCenter, The Bump, Moms Meet, BzzAgent, Influenster, other parenting rewards and product-testing panels
7. **open-sweep**: legitimate US programs not covered by any list above
