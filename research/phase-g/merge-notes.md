# Phase G merge notes (2026-11-10)

Inputs: 7 lane files, 88 objects, 87 unique ids. Output: `data/programs.json`, 86 entries (was 37). All 37 existing ids kept. No URL was changed and no web access was used.

## Duplicates resolved
- `amazon-baby-registry-completion-discount` (registry and rewards-testing lanes): kept the registry lane's object. Folded in from the rewards lane: the "capped at a combined $2,000" and "some pages over a year old" catches, and its more modest value ($30 to $100, with its basis text). The registry lane's $60 to $300 was dropped because its notes call the range its own estimate (only the $300 cap is official).
- `target-circle-registry-completion-offer` (rewards-testing) dropped; `target-registry-completion-discount` kept. Folded in: "one offer per Target Circle member", "a discount, not a free item", the rewards lane's source URLs, and its more modest value ($15 to $45, with its basis text). Registry lane kept `guaranteed` and `free`.
- Checked and left separate (different offers): welcome boxes vs completion discounts for the same brand, Amazon Family diaper savings, Similac Alimentum vs MySimilac (separate specialty track, same pattern as Nutramigen), Safe Kids check vs Safe Kids seat events, Cribs for Kids vs Ohio Every Baby Sleeps Safe, the pump suppliers, the three lactation services.

## Edits (all consistency or shape fixes; no new facts)
1. Field order and array order set to the contract (category order from `CATEGORIES`, then name). Strings trimmed.
2. Names: the five completion discounts all shared the name "Registry Completion Discount (15%)"; each now starts with its brand (for example "Target baby registry completion discount (15%)").
3. `imagination-library-free-books`: dropped `due-date` from requirements (diapers-babycare notes say the real field is a birth date, registration is blocked before birth).
4. `aeroflow-maternity-compression`: costToClaim was `purchase-required` but requirements lacked `purchase`; added it (the lane notes say a copay or deductible applies).
5. `nd-college-save-new-baby-match`: same fix; added `purchase` (the $200 contribution the notes describe).
6. `irs-hsa-fsa-breast-pump-lactation`: costToClaim `free` -> `purchase-required` and added `purchase`, because its own costDetail says you still pay for the item. offers[0] stays `coupons` (verdict "conditional").
7. `region` said "US" while `states` was set, for `molina-pregnancy-rewards`, `humana-humanabeginnings` and `state-paid-family-leave-programs`. Region now says "Only some states (...)" using the lane's own state list; Molina and Humana add "list may be incomplete" from the health-benefits notes.
8. Confidence: six existing entries had a lane change to text fields but kept `high`: `mam-club`, `pg-brandsaver-rewards`, `home-tester-club-us-product-tests`, `pinchme-samples`, `amazon-baby-registry-welcome-box`, `walmart-baby-registry-welcome-box`. Set to `medium`; `verifiedOn` left as the lanes had it. Untouched existing entries keep their old confidence.

## Checked, no change needed
- No entry has `product` first with an empty `freeStuff` and a free, no-purchase claim. Five welcome boxes (Amazon, Walmart, Babylist, MacroBaby, Target) have `product` first, empty `freeStuff`, and a stated purchase or membership requirement, so they are not "truly free" (verdict "conditional").
- No sweepstakes or testing entry lacks `certainty: chance`. valueSource, valueBasis, value order and integer rules all pass. States are valid USPS codes. Requirements are from the allowed list. All URLs are https. No U+2028, U+2029, U+FFFD or non-ASCII character anywhere.
- No new entry or lane-changed entry is `high` after edit 8.

## Left in, but worth a second look
- `medela-moms-room` (low): "free gift, contents not stated" passes the Truly free filter with no value.
- `kohls-babies-r-us-welcome-box` (low): a Kohl's page says the registry may be discontinued.
- `safe-kids-good-neighbor-car-seat-events` (low) and `national-diaper-bank-network-get-help` pass Truly free with no value.
- `irs-child-dependent-care-credit-fsa` ranks 4th (value $600 to $1,500) although the credit needs childcare costs; the lane rated it `if-eligible`.
- `molina-pregnancy-rewards` and `humana-humanabeginnings` hide for users outside the listed states although the lists are partial.
- `il-first-steps` signs up on brightstartsavings.com while the sources are on illinoistreasurer.gov; `tests/data.test.mjs` has a one-id exception for it.
- Completion-discount values are not on one scale (Babylist $45 to $225 vs Target $15 to $45) because the modest-figure rule was applied only where two lanes disagreed.
- Pampers/Huggies are `purchase-required` (points come from buying) although joining is free; kept as the lane set them.
