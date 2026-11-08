# Link check: signupUrl for every entry in data/programs.json

Checked 2026-11-08 with scratchpad/tools/fetch-page.mjs (one URL at a time, no retries with other tools).

**Summary: 37 entries. OK 27, REDIRECTED-OFFICIAL 0, NOT-FOUND 0, OFF-DOMAIN 0, BLOCKED 10.**

| id | signupUrl | HTTP | final URL | class | note |
|---|---|---|---|---|---|
| enfamil-family-beginnings | https://www.enfamil.com/baby-formula-coupons-samples/ | 200 | https://www.enfamil.com/baby-formula-coupons-samples/ | OK | Title "Free Baby Formula Samples & Coupons \| Enfamil" |
| gerber-mygerber-baby | https://register.gerber.com/ | - | - | BLOCKED | Proxy CONNECT tunnel failed (502) |
| similac-mysimilac-rewards | https://www.similac.com/rewards.html | 200 | https://www.similac.com/rewards.html | OK | Title "MySimilac Rewards 2026" |
| enfamil-nutramigen-support-program | https://www.enfamil.com/nutramigen-savings-and-support-program/ | 200 | https://www.enfamil.com/nutramigen-savings-and-support-program/ | OK | Title "Nutramigen Support Program \| Enfamil" |
| amazon-baby-registry-welcome-box | https://www.amazon.com/baby-reg/welcomebox | 200 | https://www.amazon.com/baby-reg/welcomebox | OK | Page has no <title>; body text is the Welcome Box page, no challenge markers |
| walmart-baby-registry-welcome-box | https://www.walmart.com/cp/baby-registry/1229485 | 200 | https://www.walmart.com/cp/baby-registry/1229485 | OK | Title "Free Baby Boxes & Baby Registry \| Walmart" |
| walmart-baby-registry-free-home-cleaning | https://www.walmart.com/cp/baby-registry/1229485 | 200 | https://www.walmart.com/cp/baby-registry/1229485 | OK | Same URL as the entry above |
| babylist-hello-baby-box | https://www.babylist.com/hello-baby/box | 403 | https://help.babylist.com/hc/en-us/sections/115004098188-Hello-Baby-Box | BLOCKED | Bot challenge ("Just a moment..."); redirected within babylist.com's help center, so the domain is consistent |
| macrobaby-gift-box | https://www.macrobaby.com/pages/macrobaby-gift-box | 200 | https://www.macrobaby.com/pages/macrobaby-gift-box | OK | Title "MacroBaby Gift Box \| Baby Registry Sample Box" |
| buybuy-baby-registry-welcome-bag | https://www.buybuybaby.com/store/page/BabyRegistry | - | - | BLOCKED | HTTP/2 stream error (INTERNAL_ERROR) |
| target-registry-welcome-kit | https://www.target.com/gift-registry/create-baby-registry | 200 | https://www.target.com/gift-registry/create-baby-registry | OK | Weak check: no <title>, body is mostly site navigation (likely JS-rendered). Domain correct; worth a manual look |
| mam-club | https://www.mambaby.com/en-us/mam-club/ | 200 | https://www.mambaby.com/en-us/mam-club/ | OK | Title "MAM Club" |
| imagination-library-free-books | https://imaginationlibrary.com/check-availability/ | 200 | https://imaginationlibrary.com/check-availability/ | OK | Title "Check Availability - Dolly Parton's Imagination Library" |
| huggies-rewards | https://www.huggies.com/en-us/rewards | 403 | https://www.huggies.com/en-us/rewards | BLOCKED | Bot challenge ("Just a moment...") |
| pg-brandsaver-rewards | https://pgbrandsaver.com/rewards/ | 200 | https://pgbrandsaver.com/rewards/ | OK | Title "Earn Points & Unlock Rewards \| P&G brandSAVER" |
| pampers-rewards | https://www.pampers.com/en-us/rewards | 200 | https://www.pampers.com/en-us/rewards | OK | Title "Pampers Rewards: Earn Pampers Cash on Diapers" |
| edgepark-breast-pump-insurance | https://edgepark.com/faqs_breastpumps | - | - | BLOCKED | Connection reset by peer |
| healthcare-gov-insurance-covered-breast-pump | https://www.healthcare.gov/coverage/breast-feeding-benefits/ | 200 | https://www.healthcare.gov/coverage/breast-feeding-benefits/ | OK | Title "Breastfeeding benefits \| HealthCare.gov" |
| byram-healthcare-breast-pumps-insurance | https://www.byrambaby.com/how-it-works | 200 | https://www.byrambaby.com/how-it-works | OK | Title "How it Works" (generic, but the page is on the Byram domain) |
| healthcare-gov-pregnancy-coverage | https://www.healthcare.gov/what-if-im-pregnant-or-plan-to-get-pregnant/ | 200 | https://www.healthcare.gov/what-if-im-pregnant-or-plan-to-get-pregnant/ | OK | Title "Health Coverage Options for Pregnant or Soon to Be Pregnant Women" |
| 1-natural-way-breast-pump-insurance | https://www.1naturalway.com/resources/how-it-works | 200 | https://www.1naturalway.com/resources/how-it-works | OK | Title "How It Works \| Get Your Insurance-Covered Pump in 3 Steps" |
| lactation-network-insurance-covered-lactation-support | https://lactationnetwork.com/ | 200 | https://lactationnetwork.com/ | OK | Title "Breastfeeding & lactation support \| The Lactation Network" |
| medicaid-chip-pregnancy-coverage | https://www.healthcare.gov/medicaid-chip/getting-medicaid-chip/ | 200 | https://www.healthcare.gov/medicaid-chip/getting-medicaid-chip/ | OK | Title "Medicaid & CHIP coverage \| HealthCare.gov" |
| aeroflow-breastpumps-insurance | https://aeroflowbreastpumps.com/qualify-through-insurance | 200 | https://aeroflowbreastpumps.com/qualify-through-insurance | OK | Title "Qualify for a Free Breast Pump Through Insurance \| Aeroflow" |
| 211-org-community-help | https://211.org/ | 200 | https://211.org/ | OK | Title "Call 211 for Essential Community Services \| United Way 211" |
| early-head-start-pregnant-women | https://www.headstart.gov/how-apply | 403 | https://www.headstart.gov/how-apply | BLOCKED | 403 "ERROR: The request could not be satisfied" |
| cribs-for-kids-find-a-crib | https://cribsforkids.org/find-a-crib/ | 403 | https://cribsforkids.org/find-a-crib/ | BLOCKED | 403, no <title> |
| safe-kids-car-seat-check | https://cert.safekids.org/get-car-seat-checked | 200 | https://cert.safekids.org/get-car-seat-checked | OK | Title "Get a Car Seat Checked \| National CPS Certification" |
| national-diaper-bank-network-get-help | https://nationaldiaperbanknetwork.org/get-help-now/ | 200 | https://nationaldiaperbanknetwork.org/get-help-now/ | OK | Title "Get Help Now - National Diaper Bank Network" |
| hrsa-healthy-start | https://www.hrsa.gov/services/healthy-start | 403 | https://www.hrsa.gov/services/healthy-start | BLOCKED | 403 "Access Denied" |
| postpartum-support-international-helpline | https://postpartum.net/get-help/psi-helpline/ | 403 | https://postpartum.net/get-help/psi-helpline/ | BLOCKED | 403, no <title> |
| usda-wic | https://www.fna.usda.gov/wic/apply | 200 | https://www.fna.usda.gov/wic/apply | OK | Title "How to Apply for WIC \| Food and Nutrition Administration" |
| bzzagent-campaigns | https://bzzagent.com/how-it-works/ | 200 | https://bzzagent.com/how-it-works/ | OK | Title "How It Works \| Bzzagent" |
| home-tester-club-us-product-tests | https://www.hometesterclub.com/us/en/account/join | 200 | https://www.hometesterclub.com/us/en/account/join | OK | Title "Home Tester Club" |
| influenster-voxbox | https://www.influenster.com/registration | 403 | https://www.influenster.com/registration | BLOCKED | Bot challenge ("Just a moment...") |
| pinchme-samples | https://www.pinchme.com/ | 200 | https://www.pinchme.com/ | OK | Title "Free Product Samples by Mail \| PINCHme" |
| tryazon-tryabox-parties | https://www.tryazon.com/host-sign-up-form/ | 200 | https://www.tryazon.com/host-sign-up-form/ | OK | Title "Tryazon Sign-Up" |

## Needs attention

No NOT-FOUND, OFF-DOMAIN or wrong-page entries.

Blocked (not proven broken; recheck from a normal browser):
- gerber-mygerber-baby (proxy connection failed)
- babylist-hello-baby-box (bot challenge)
- buybuy-baby-registry-welcome-bag (HTTP/2 error)
- huggies-rewards (bot challenge)
- edgepark-breast-pump-insurance (connection reset)
- early-head-start-pregnant-women (403)
- cribs-for-kids-find-a-crib (403)
- hrsa-healthy-start (403)
- postpartum-support-international-helpline (403)
- influenster-voxbox (bot challenge)

Weak OK (page loaded but content could not be confirmed):
- target-registry-welcome-kit (no title, nav-only body)
- amazon-baby-registry-welcome-box (no title; body matches the page)
