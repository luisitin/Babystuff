# registry-box notes (round 2, verified 2026-11-08)

Round 1 used only domain-restricted search because WebFetch could not resolve hosts. Round 2 used the approved helper (fetch-page.mjs) through the proxy, one page at a time.

## Fetched and confirmed (high)
- amazon-baby-registry-welcome-box: https://www.amazon.com/baby-reg/welcomebox says Prime members get a free gift box with sample and full-size items; needs Prime, 10 unique items, over $10 registry purchases. Also shows a 15% completion discount (up to $300 savings). The help page (nodeId=GBLXVKVYG5SBG8HF) returned an unreadable compressed body, so the $35-until-promo-applied, contiguous-US-only and 8-month-wait details come from official-domain search snippets and are labeled that way in catches.
- target-registry-welcome-kit: https://www.target.com/help/article/000062588 is live: join Circle, create registry, 10 unique items, purchase over $10, bonus within 24-48 h, one kit per year, $100 value, shipping and handling fees, registries created after 08/15/2023. The registry sign-up page and product page showed no kit text (JS-rendered), so the help article is the only confirmation.
- walmart-baby-registry-welcome-box and walmart-baby-registry-free-home-cleaning: fetched the registry page, gift box help article and Terms of Use. Box: Feb 1 2025 start, 7 days, 20 items, $25 via registry link, while supplies last, first come first served, 10-12 weeks. Cleaning: Tier 2, $300, 20 items, 48 contiguous states, start Feb 9 2026, redeem within 90 days after event date, unaffiliated provider.

## Included at medium
- babylist-hello-baby-box: help.babylist.com returned a Cloudflare "Just a moment" challenge (403); accepted, not retried. www.babylist.com page fetched but didn't describe the box. Terms from search snippets of help.babylist.com: 3 outside items, 40% checklist, $30 shop purchase, $8.95 shipping.
- macrobaby-gift-box: page fetched but body not readable; meta description on /pages/baby-registry confirms "free $80+ welcome box". 20 items + $15 from search snippets.
- buybuy-baby-registry-welcome-bag: buybuybaby.com fetch errored (curl HTTP/2 error) and a store page returned a 502 tunnel failure; not retried further. Search snippets of buybuy BABY pages still describe the in-store goody bag. Kept at medium; the snippet is not dated.

## Completion discounts only (no free item, so not separate entries)
- Pottery Barn Kids: 15%, 60 days before to 180 days after event (search snippet); page returned 403. No welcome gift found in results.
- Crate & Kids: two 15% codes; crateandbarrel.com terms page returned 403. No welcome gift found.
- West Elm / Pottery Barn / Williams Sonoma: 10% completion discount per FAQ snippet; no welcome gift found.
- Bloomingdale's: 20% completion discount, from 2 months before to 6 months after arrival (snippet); bonus-gift page returned 403; brand bonus gifts need spend thresholds (e.g. $1,200), not a general freebie.
- Albee Baby: completion discount ~9 months (snippet).

## Excluded
- Kohl's welcome box: kohls.com returned 403 (Access Denied). Snippets conflict: landing page and product page ($20 box made free by coupon, supplies last) vs a Kohl's baby shower page saying the registry may be discontinued. Status unconfirmable, so left out. URL: https://www.kohls.com/babyregistry
- Walmart postpartum/"mom" box: the registry page and terms show no separate free mom box; only the Baby Box (samples and full-size items for "you and your baby") and the cleaning reward.
- Nordstrom: nordstrom.com/registry returned 404; search found only gift sets for sale, no registry gift.
- Costco: no registry welcome gift; only gift baskets for sale.

## Blocked / unreadable
Kohl's, Bloomingdale's, Pottery Barn Kids, Crate & Barrel (403); help.babylist.com (bot challenge); buybuybaby.com (fetch errors); Amazon help page (unreadable body); MacroBaby and Target registry pages (JS shells).
