# Fact-check, 2026-11-08

Pages fetched with the proxy helper; blocked sites (403 / bot challenge / reset) were checked through official-domain search results only and capped at medium. No forms were submitted.

| id | verdict | what changed | evidence |
|---|---|---|---|
| gerber-mygerber-baby | unverifiable (kept, medium) | gerber.com/register.gerber.com not fetchable; search results confirm free account, optional sample opt-in "if they become available" (address required if ticked). Added mygerber URL, tightened catches. | https://www.gerber.com/mygerber (search) |
| enfamil-nutramigen-support-program | fixed, now high | Fetched. Removed unverified "insurance support"; page says free samples, tips, offers, sweepstakes entry; Mead Johnson affiliates share data. | https://www.enfamil.com/nutramigen-savings-and-support-program/ |
| babylist-hello-baby-box | unverifiable (kept, medium) | signupUrl /hello-baby-box returns 404; switched to /hello-baby/box (official footer link, redirects to blocked help center). Terms from search results. Caveat added. | https://www.babylist.com/hello-baby/box ; help.babylist.com (bot challenge) |
| macrobaby-gift-box | confirmed, now high | Page now renders: 20 registry items + first $15 purchase, $80+ random seasonal box, return rule and $80 fee. Updated whatYouGet and notes. | https://www.macrobaby.com/pages/macrobaby-gift-box |
| buybuy-baby-registry-welcome-bag | unverifiable (kept, medium) | Fetch failed (HTTP/2 stream error). Search results still describe the in-store free bag. Caveat added. | https://www.buybuybaby.com/store/page/BabyRegistry (search) |
| huggies-rewards | unverifiable (kept, medium) | Category moved rewards -> diapers-wipes. huggies.com 403 (Cloudflare); search results show conflicting sign-up bonuses (older app) vs Fetch-based Rewards+. Caveat added. | https://www.huggies.com/en-us/rewards (search) |
| edgepark-breast-pump-insurance | fixed (medium) | Blocked (connection reset). Invalid requirement "insurance" removed; added free shipping, prescription handled by Edgepark, order window, restricted models. | https://www.edgepark.com/faqs_breastpumps (search) |
| lactation-network-insurance-covered-lactation-support | fixed, now high | Fetched home page and FAQ. Requirements now email, phone, eligibility (invalid "insurance" removed); region 50 states + DC; cost-sharing not stated, noted honestly. | https://lactationnetwork.com/ ; /frequently-asked-questions/ |
| 211-org-community-help | fixed (medium) | Real and actionable (call 2-1-1 / local lookup). Removed unverified "24/7" and "anonymous"; costDetail says page states no cost; clarified it is a referral line. | https://211.org/ |
| early-head-start-pregnant-women | unverifiable (kept, medium) | headstart.gov 403. Search results confirm income rule, local application via locator or 1-866-763-6481, waitlists. Added FAQ source URL. | https://www.headstart.gov/how-apply (search) |
| cribs-for-kids-find-a-crib | unverifiable (kept, medium) | 403. Search results confirm free crib via partners, criteria set per partner. Added crib limits. | https://cribsforkids.org/find-a-crib/ (search) |
| hrsa-healthy-start | unverifiable (kept, medium) | 403. Search results confirm funded-area projects, varying enrollment rules. | https://www.hrsa.gov/services/healthy-start (search) |
| postpartum-support-international-helpline | unverifiable (kept, medium) | 403. signupUrl moved to the PSI HelpLine page found in search; added Spanish text line; response-time wording now notes conflicting sources. | https://postpartum.net/get-help/psi-helpline/ (search) |
| bzzagent-campaigns | confirmed (medium) | Fetched how-it-works and terms: apply by email invite, limited samples, review required, 18+. Join link is off-domain (sampling.powerreviews.com), so medium. Removed unverified UK/Canada eligibility claim. | https://bzzagent.com/how-it-works/ ; /terms-and-conditions/ |
| influenster-voxbox | fixed (medium) | Site is behind a Cloudflare challenge. Official guide (search result) says you must sign up and download the app to be eligible for a VoxBox, so `app` stays; requirements now email, account, app. Caveat added. | https://www.influenster.com/article/how-do-i-get-a-voxbox-from-influenster (search) |
| tryazon-tryabox-parties | confirmed (medium) | Fetched. 18+ per terms, US and Canada accepted. Today the sign-up form says it is under maintenance and no TryaBox is open; added to catches. | https://www.tryazon.com/faq/ ; /tryabox/ ; /host-sign-up-form/ |
| safe-kids-car-seat-check | confirmed (high) | Page says 8,000+ free inspection events; fees at individual technicians/stations not stated, noted. | https://cert.safekids.org/get-car-seat-checked |
| national-diaper-bank-network-get-help | confirmed (high) | Removed unverified "240+ diaper banks". | https://nationaldiaperbanknetwork.org/get-help-now/ |
| similac-mysimilac-rewards | fixed (high) | Free Shutterfly photo book removed: page footnote says the offer expired July 31, 2026. Rest (coupons, 5 points per redeemed coupon, 35-point special coupon, 18+, 9-month coupon period, per-child account) confirmed. | https://www.similac.com/rewards.html ; /rewards/admin/terms-conditions.html |
| pampers-rewards | fixed (high) | Page states $10 Pampers Cash per 10 diaper scans (most boxes have 2 scans), so the rate is correct but clarified. No sign-up gift found, so stays purchase-required with explanatory costDetail. Category -> diapers-wipes. | https://www.pampers.com/en-us/rewards |
| 1-natural-way-breast-pump-insurance | fixed (high) | Invalid "insurance" requirement removed; added no-returns and 20% off retail fallback. | https://www.1naturalway.com/resources/how-it-works |
| target-registry-welcome-kit | fixed (high) | Target Circle is free (target.com Circle page "Join free"; Target help says free), so `membership` replaced by `account`; costDetail mentions free Circle account. Shipping fee, 10 items, $10 purchase confirmed. | https://www.target.com/help/article/000062588 |
| byram-healthcare-breast-pumps-insurance | confirmed (high) | Steps, account requirement, prescription and shipping confirmed; "insurance" requirement removed. | https://www.byrambaby.com/how-it-works |
| healthcare-gov-pregnancy-coverage | fixed (high) | Real and actionable (create account / apply, report pregnancy or birth). costDetail now says Medicaid/CHIP free or low-cost, Marketplace plans may have premiums; "insurance" requirement removed. 60-day and Nov 1 - Jan 15 windows confirmed. | https://www.healthcare.gov/what-if-im-pregnant-or-plan-to-get-pregnant/ |

No entries dropped.

## Outside scope, flagged
`healthcare-gov-insurance-covered-breast-pump` and `aeroflow-breastpumps-insurance` still use the invalid requirement value `insurance`.
