# Merge log

## Dedupes
- safe-kids-car-seat-check: appeared in health-assistance (high) and open-sweep (medium); kept one entry at high, merged the two catches texts. sourceUrls were identical.
- pumping-essentials-breast-pump-insurance: dropped as separate entry; mention added to the notes of aeroflow-breastpumps-insurance.
- No other duplicates found (enfamil-nutramigen-support-program and enfamil-family-beginnings are distinct sign-ups; the two Walmart entries are distinct rewards).

## Drops
- munchkin-email-signup-15-off, tommee-tippee-newsletter-15-off, philips-avent-store-newsletter-15-off, carters-rewards: discount only, not a freebie.
- vroom-early-learning-tips, 1000-books-before-kindergarten: out of scope, information only.
- babycenter-app-rewards: no concrete benefit from the official site.

## Field changes
- pampers-rewards: whatYouGet had a corrupted amount "(0 per 10 diaper scans)"; changed to "$10 per 10 diaper scans" per the lane notes.
- pampers-rewards, huggies-rewards: costToClaim free -> purchase-required (only value is points earned on purchases); costDetail rewritten; purchase already in requirements.
- mam-club: whatYouGet reworded without the "Coupon:" prefix; catches now say the main perks are discounts and tests/giveaways are not guaranteed.
- bzzagent-campaigns: signupUrl sampling.powerreviews.com/join -> https://bzzagent.com/how-it-works/; off-domain join step added to catches; notes reworded.
- gerber-mygerber-baby, edgepark-breast-pump-insurance, cribs-for-kids-find-a-crib, postpartum-support-international-helpline, early-head-start-pregnant-women, hrsa-healthy-start: verifiedOn "" -> 2026-11-08; notes start with the search-results caveat; confidence already medium.
- aeroflow-breastpumps-insurance: notes extended with the Pumping Essentials fold-in.
- safe-kids-car-seat-check: catches merged (see Dedupes).
- All entries: keys reordered to schema order; sorted by category then name; missing optional strings left as "".
- Redirect targets already in the lane files were kept: fna.usda.gov (WIC), byrambaby.com (Byram), pgbrandsaver.com (P&G); no other signupUrl changes were needed.
