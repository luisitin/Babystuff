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

## Second merge (2026-11-10)

Inputs: `wave2-samples.json` (3 objects), `wave2-retail.json` (7), `wave2-health.json` (32), `wave2-money.json` (29): 71 objects. No web access was used. Output: `data/programs.json`, 146 entries (was 86). Counts by category: formula 6, diapers-wipes 7, registry-box 15, feeding 4, baby-care 7, rewards 1, health-benefits 40, assistance 17, money 42, product-testing 7. 62 entries are limited to some states.

New field `sameAs` is on every entry (key order: it comes last, after `notes`; the key list in `tests/data.test.mjs` was updated).

### Added (61)
- samples: `huggies-free-newborn-diapers-wipes-signup`, `babys-only-free-sample-shipping`.
- retail: `meijer-free-prenatal-vitamins`, `price-chopper-free-prenatal-vitamins`, `bloomingdales-baby-registry-completion-discount`.
- health (30): `tenncare-diaper-benefit`, `delaware-medicaid-postpartum-diapers-meals`, `aetna-better-health-pregnancy-rewards`, `amerihealth-caritas-bright-start`, `caresource-babies-first-rewards`, `my-health-pays-prenatal-rewards`, `wellcare-nc-better-beginnings`, `blue-cross-special-beginnings`, `highmark-mom-options-mom-matters`, `wellpoint-medicaid-baby-essentials`, `upmc-for-you-baby-steps-gift`, `kaiser-permanente-prenatal-classes`, `pampers-free-online-childbirth-classes`, `aeroflow-prenatal-breastfeeding-classes`, `aeroflow-breast-pump-resupply-insurance`, `wic-farmers-market-nutrition-program`, `wic-breastfeeding-support-food-package`, `count-the-kicks-app`, `postpartum-support-international-online-groups`, `march-of-dimes-mom-baby-mobile-health-centers`, `ny-free-portable-crib-safe-sleep`, `al-dhr-baby-box-initiative`, `virginia-low-income-car-seat-program`, `texas-safe-riders-car-seats`, `mississippi-safe-riders-magnolia`, `family-connects-nurse-home-visit`, `cdc-vaccines-for-children`, `healthcare-gov-preventive-care-women`, `masshealth-free-prenatal-vitamins`, `text4baby-free-text-messages`.
- money (26): the 13 paid leave entries (`ca-paid-family-leave-sdi`, `nj-family-leave-insurance`, `ny-paid-family-leave`, `ri-temporary-caregiver-insurance`, `wa-paid-family-medical-leave`, `ma-paid-family-medical-leave`, `ct-paid-leave`, `or-paid-leave-oregon`, `co-famli-paid-leave`, `dc-paid-family-leave`, `de-paid-leave`, `mn-paid-leave`, `me-paid-family-medical-leave`), `mi-rx-kids`, `or-bridge-project-multnomah`, and the state credits and accounts `ca-young-child-tax-credit`, `ny-empire-state-child-credit`, `nj-child-tax-credit`, `mn-child-tax-credit`, `vt-child-tax-credit`, `ma-child-family-tax-credit`, `or-kids-credit`, `me-dependent-exemption-tax-credit`, `il-child-tax-credit`, `nm-child-tax-credit`, `ct-chet-baby-scholars`.

### Replaced (7, same id, wave-2 object used)
`buybuy-baby-registry-welcome-bag` (now low confidence), `kohls-babies-r-us-welcome-box`, `macrobaby-gift-box`, `target-registry-welcome-kit`, `irs-child-tax-credit` ($2,200 for tax year 2026), `irs-earned-income-tax-credit`, `treasury-trump-account-pilot-deposit` (election on Form 4547, not automatic).

### Removed (1)
`state-paid-family-leave-programs`: replaced by the 13 per-state entries.

### Left out (3)
- `healthcare-gov-pregnancy-coverage` and `medicaid-chip-pregnancy-coverage` rewrites: skipped by decision; the existing entries stay as they were (values null).
- `baby-dove-newsletter-samples`: only a chance of coupons.

### Decisions applied
- `caresource-babies-first-rewards`: `GA` removed from `states`; `region` now "IN, KY, OH"; `eligibility` names only the three states seen; a sentence in `notes` says why. Confidence stays low.
- `irs-child-dependent-care-credit-fsa`: `costToClaim` `purchase-required`, requirements `purchase` and `eligibility`, `costDetail` says it only pays back part of the child care you pay for.
- Completion discounts restated on one scale (percent times $200 to $600, under any official cap; `valueSource` `estimate`; `valueBasis` "N% off about $200 to $600 of registry items you would buy anyway"; a sentence added to `notes`). All seven are single-offer (`coupons`), so the whole value was the discount. Amazon (cap $300) and Babylist (stated $600 on $4,000) caps do not bind. Results: Amazon $30 to $90 (was $30 to $100), Macy's 10% $20 to $60 (was $10 to $50), Babylist $30 to $90 (was $45 to $225), Crate and Kids $30 to $90 (was $20 to $100), Pottery Barn Kids $30 to $90 (was $20 to $100), Target $30 to $90 (was $15 to $45), Bloomingdale's 20% $40 to $120 (was $20 to $100). Amazon Family diaper savings is a subscription discount, not a registry completion discount, so it was left as is.
- `sameAs` set to `healthcare-gov-insurance-covered-breast-pump` on `edgepark-breast-pump-insurance`, `byram-healthcare-breast-pumps-insurance`, `1-natural-way-breast-pump-insurance`, `aeroflow-breastpumps-insurance`, `tricare-breast-pump-and-supplies`. Nothing else set. Considered and not set: lactation services (three separate providers), `aeroflow-breast-pump-resupply-insurance` (parts, not the pump), `wic-breastfeeding-support-food-package` and `wic-farmers-market-nutrition-program` versus `usda-wic` (extra benefits, not the same one), state credits versus the federal credit (separate benefits).

### Consistency checks run on all 146 entries
Schema keys and order, enums, `valueLow <= valueHigh`, `valueSource` and `valueBasis` against the values, USPS state codes, unique kebab-case ids, `costToClaim` versus `requirements`, paid entries have empty `freeStuff`, sweepstakes and testing entries are `chance`, ASCII only, all URLs https. The only failures were the ones fixed above. No other fix was needed; nothing was invented. Kept as researched:
- `gerber-mygerber-baby` and `similac-alimentum-rewards` list `coupons` before `product`: the lanes say the sample is only "if available" or "may", so a product is not confirmed.
- `or-bridge-project-multnomah` has `chance` with a first offer of `cash` (a lottery); the test rule only ties sweepstakes and testing to `chance`.
- `babys-only-free-sample-shipping`: first offer `product`, `freeStuff` empty because a shipping fee is paid; it is not truly free.
- Most service, coverage and cash entries have empty `freeStuff` (as in the first merge); this does not affect the Truly free filter, which needs `product` first.
- No new entry has `high` confidence. Confidence was not raised anywhere.

### Addresses I was unsure about (read by eye only, all https and on an official domain)
- `price-chopper-free-prenatal-vitamins`: signup is a Price Chopper blog tag page (`pricechopper.com/blog/tag/flu-shot/`), the only page found.
- `meijer-free-prenatal-vitamins`: Meijer newsroom page (undated, from a 2011 release).
- `babys-only-free-sample-shipping`: source `naturesone.com` is the maker's sister domain (Nature's One owns Baby's Only); signup is on `babysonly.com`.
- `mississippi-safe-riders-magnolia`: `msdh.ms.gov/page/43,0,98,1074.html` is an old-style page address.
- `ma-child-family-tax-credit` and `me-dependent-exemption-tax-credit` sign up on a flyer download and a PDF.
- `de-paid-leave`: signup is a PDF FAQ on `laborfiles.delaware.gov`.
- `mn-paid-leave`: signup `paidleave.mn.gov`, sources `pl.mn.gov` and `mn.gov` (all state domains).
- `ct-chet-baby-scholars`: `aboutchet.com` is the Connecticut Treasurer's CHET site (sources also on `portal.ct.gov`).
- Insurer sites (`sunshinehealth.com`, `superiorhealthplan.com`, `coordinatedcarehealth.com`, `wellpoint.com`, `upmchealthplan.com`) are the plans' own domains.
No signup URL needed replacing and no entry was left out for its address.

### For the orchestrator to look at again
- Large values: `ca-paid-family-leave-sdi` $7,060, `nj-family-leave-insurance` $6,714, `ny-paid-family-leave` $7,371, `wa-paid-family-medical-leave` $9,882, `ma-paid-family-medical-leave` $7,382, `or-paid-leave-oregon` $10,153, `co-famli-paid-leave` $8,688, `mn-paid-leave` $8,538, `ct-paid-leave` $6,098, `mi-rx-kids` $3,000 to $4,500, `irs-child-tax-credit` $1,700 to $2,200. All are `if-eligible` and rely on the researcher's weeks times half the weekly maximum, so they will rank at the top for people who qualify.
- Low-confidence entries that carry a value: `amerihealth-caritas-bright-start`, `caresource-babies-first-rewards`, `blue-cross-special-beginnings`, `highmark-mom-options-mom-matters`, `delaware-medicaid-postpartum-diapers-meals`, `mississippi-safe-riders-magnolia`, `ri-temporary-caregiver-insurance`, `dc-paid-family-leave`, `ct-chet-baby-scholars`, `nm-child-tax-credit`, `meijer-free-prenatal-vitamins`, `price-chopper-free-prenatal-vitamins`, `huggies-free-newborn-diapers-wipes-signup`, `buybuy-baby-registry-welcome-bag`.
- `irs-earned-income-tax-credit` has `valueLow` 0, as do several state credits (`ca-young-child-tax-credit`, `ny-empire-state-child-credit`, `mn-child-tax-credit`, `vt-child-tax-credit`, `or-kids-credit`, `me-dependent-exemption-tax-credit`, `nm-child-tax-credit`), because income limits can bring the credit to zero.
- Email tags (`tests/email.test.mjs` SNAPSHOT regenerated; all unique, lowercase, at most 24 characters). Tags that read badly: `healthy` (count-the-kicks-app), `baby` (babys-only-free-sample-shipping), `bank` (nd-college-save-new-baby-match), `state` (medicaid-doula-coverage), `first` (first5california-kit-for-new-parents), `us` (treasury-trump-account-pilot-deposit), `sunshine` (my-health-pays-prenatal-rewards), `blue` (blue-cross-special-beginnings), `family`, `march`, `price`, `head`, `social`, `united`, `bridge`, and the numbered `-ct`/`-2` state tags (for example `connecticut-ct-2` for ct-paid-leave). `src/js/email.js` was not changed.
