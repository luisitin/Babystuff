# health-assistance notes (verified 2026-11-08)

WebFetch fails with ENOTFOUND here, so pages were read with the fetch-page.mjs helper (through the proxy).

## Verified high (fetched today)
healthcare-gov-insurance-covered-breast-pump; aeroflow-breastpumps-insurance; byram-healthcare-breast-pumps-insurance (byramhealthcare.com redirects to byrambaby.com); 1-natural-way-breast-pump-insurance; pumping-essentials-breast-pump-insurance (site is Aeroflow-run, "part of the Aeroflow family"; duplicate-ish); usda-wic (fns.usda.gov redirects to fna.usda.gov; /wic/how-apply is 404, correct page is /wic/apply); healthcare-gov-pregnancy-coverage; medicaid-chip-pregnancy-coverage; national-diaper-bank-network-get-help (/find-a-diaper-bank/ is 404; /member-directory/ is the directory); safe-kids-car-seat-check.

## Medium
- edgepark-breast-pump-insurance: edgepark.com resets connections (empty reply); search results only, verifiedOn blank, coverage-check page unconfirmed.
- lactation-network-insurance-covered-lactation-support: lactationnetwork.com fetched; it offers insurance-covered lactation consults, not clearly pumps.
- cribs-for-kids-find-a-crib (403), postpartum-support-international-helpline (postpartum.net 403), early-head-start-pregnant-women (headstart.gov 403), hrsa-healthy-start (hrsa.gov / mchb.hrsa.gov 403): search-backed only, verifiedOn blank.
- 211-org-community-help: fetched, but the page does not say "free", so medium.

## Breast pump claim steps
Written into the notes field of the HealthCare.gov entry and each supplier entry, from healthcare.gov and the suppliers' own how-it-works pages.

## Excluded
- Text4baby: acf.gov/text4baby (redirect from acf.hhs.gov) returned an empty 202 response; text4baby.org returned nothing; only old partner pages show up in search. Current status unconfirmed.
- Hospital take-home kits: no official US source documents a program; official-domain results (CDC, AAP, NIH) only cover studies of formula discharge packs and recommend against them. Blogs only; no entry.
- NHTSA (nhtsa.gov): 403 (Access Denied); car seat checks covered via Safe Kids instead.

## Blocked
cribsforkids.org, postpartum.net, headstart.gov, hrsa.gov, mchb.hrsa.gov, nhtsa.gov (403); edgepark.com (connection reset); text4baby.org (empty).
