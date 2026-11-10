# Link status

This page describes the latest automatic link check: run 7 of the repository's Link check workflow, on 2026-11-10. It checks every `signupUrl` and every `sourceUrls` entry in `data/programs.json`. The repository's own workflow runs `scripts/check-links.mjs`. The checker sends an honest User-Agent, makes one request at a time per host, and retries once only after a network error or a server error (5xx). It never retries with other headers or a browser.

## Result

- **309 unique addresses** were checked: **251 OK**, 0 not found, 0 off-domain, 0 dead, 0 suspect, **58 blocked**.
- **Sign-up links:** 141 unique addresses; 112 OK, 29 blocked, 0 broken.
- **Source links:** 297 addresses; 242 OK, 55 blocked, 0 broken.
- Of the 58 blocked addresses, 26 are used as both a sign-up link and a source link. The 29 blocked sign-up links and 55 blocked source links therefore cover 58 addresses.

## What blocked means

A blocked link is one the site refused to the robot. The checker got an HTTP 403 (often a bot challenge page), a timeout, a dropped connection or a redirect loop. The link may work fine in a person's browser. The checker does not retry these another way. Programs that depend on a blocked link stay at medium confidence or lower, unless an official page was read directly in an earlier phase.

Blocked is not the same as broken. None of the 58 blocked addresses was reported as not found, off-domain or dead.

## Blocked links to open by hand

Open each address in a normal browser before you rely on its program. The table has one row per address, sorted by program id. "Role" says whether the address is used as a sign-up link, a source link or both. The table has 58 rows.

| Program id(s) | Address | Role | What the robot got |
|---|---|---|---|
| aetna-better-health-pregnancy-rewards | `https://www.aetnabetterhealth.com/illinois-medicaid/pregnancy-care.html` | source | 403, bot challenge |
| aetna-better-health-pregnancy-rewards | `https://www.aetnabetterhealth.com/kentucky/pregnancy-care.html` | both | 403, bot challenge |
| aetna-better-health-pregnancy-rewards | `https://www.aetnabetterhealth.com/oklahoma/extra-benefits.html` | source | 403, bot challenge |
| babylist-hello-baby-box | `https://help.babylist.com/hc/en-us/articles/360053264354-What-is-a-Hello-Baby-Box` | source | 403, bot challenge |
| babylist-hello-baby-box | `https://help.babylist.com/hc/en-us/articles/360054057353-How-do-I-get-a-Hello-Baby-Box` | source | 403, bot challenge |
| babylist-registry-completion-discount | `https://help.babylist.com/hc/en-us/articles/115006102688-How-do-I-use-my-Babylist-registry-discount` | source | 403, bot challenge |
| bloomingdales-baby-registry-completion-discount | `https://www.bloomingdales.com/c/editorial/registry/baby-bonus-gifts/` | source | 403, bot challenge |
| bloomingdales-baby-registry-completion-discount | `https://www.bloomingdales.com/customer-service/articles/general-baby-gift-registry-information` | source | 403, bot challenge |
| bloomingdales-baby-registry-completion-discount | `https://www.bloomingdales.com/registry/baby` | both | 403, bot challenge |
| buybuy-baby-registry-welcome-bag | `https://www.buybuybaby.com/store/page/BabyRegistry` | both | timeout |
| co-famli-paid-leave | `https://famli.colorado.gov/individuals-and-families/how-famli-works/premium-and-benefits-calculator` | source | 403, bot challenge |
| co-famli-paid-leave | `https://famli.colorado.gov/individuals-and-families/reasons-to-take-famli-leave/neonatal-care-leave` | source | 403, bot challenge |
| co-famli-paid-leave | `https://famli.colorado.gov/individuals-and-families/reasons-to-take-famli-leave/parental-bonding-leave` | both | 403, bot challenge |
| crate-and-kids-registry-completion-discount | `https://www.crateandbarrel.com/customer-service/baby-registry-faq` | source | 403, bot challenge |
| crate-and-kids-registry-completion-discount | `https://www.crateandbarrel.com/gift-registry/terms-and-conditions` | both | 403, bot challenge |
| early-head-start-pregnant-women | `https://headstart.gov/about-us/article/head-start-faqs` | source | 403, bot challenge |
| early-head-start-pregnant-women | `https://www.headstart.gov/how-apply` | both | 403, bot challenge |
| edgepark-breast-pump-insurance | `https://www.edgepark.com/faqs_breastpumps` | both | timeout |
| gerber-mygerber-baby | `https://www.gerber.com/about-mygerber` | both | 403 |
| gerber-mygerber-baby | `https://www.gerber.com/gerberr-good-startr-soothepro-powder-infant-formula` | source | 403 |
| hrsa-healthy-start | `https://mchb.hrsa.gov/programs-impact/healthy-start` | source | 403, bot challenge |
| hrsa-healthy-start | `https://www.hrsa.gov/services/healthy-start` | both | 403, bot challenge |
| hrsa-national-maternal-mental-health-hotline | `https://mchb.hrsa.gov/national-maternal-mental-health-hotline/faq` | source | 403, bot challenge |
| hrsa-national-maternal-mental-health-hotline | `https://mchb.hrsa.gov/programs-impact/national-maternal-mental-health-hotline` | both | 403, bot challenge |
| huggies-free-newborn-diapers-wipes-signup | `https://www.huggies.com/en-us/safesleep` | both | 403, bot challenge |
| huggies-rewards | `https://www.huggies.com/en-us/rewards/rewardsapp` | both | 403, bot challenge |
| il-first-steps | `https://www.brightstartsavings.com/` | sign-up | connection reset |
| influenster-voxbox | `https://www.influenster.com/article/how-do-i-get-a-voxbox-from-influenster` | source | 403, bot challenge |
| influenster-voxbox | `https://www.influenster.com/registration` | sign-up | 403, bot challenge |
| kaiser-permanente-prenatal-classes | `https://healthy.kaiserpermanente.org/northern-california/health-wellness/maternity/find-hospital/san-jose/classes-resources` | both | redirect loop (more than 8 redirects) |
| kohls-babies-r-us-welcome-box | `https://www.kohls.com/babyregistry` | both | 403, bot challenge |
| kohls-babies-r-us-welcome-box | `https://www.kohls.com/product/prd-7344513/babies-r-us-welcome-box.jsp` | source | 403, bot challenge |
| macys-baby-registry-completion-discount | `https://www.macys.com/registry/baby` | source | 403, bot challenge |
| macys-baby-registry-completion-discount | `https://www.macys.com/s/promotional-details/baby-registry-completion/` | both | 403, bot challenge |
| me-dependent-exemption-tax-credit | `https://legislature.maine.gov/statutes/36/title36sec5219-SS.html` | source | timeout |
| me-dependent-exemption-tax-credit | `https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_dependent_exemption_tx_cr_fillable.pdf` | both | 403, bot challenge |
| me-paid-family-medical-leave | `https://www.maine.gov/paidleave/` | source | 403, bot challenge |
| me-paid-family-medical-leave | `https://www.maine.gov/paidleave/workers/index.shtml` | both | 403, bot challenge |
| meijer-free-prenatal-vitamins | `https://www.meijer.com/shopping/services/pharmacy/pharmacy-services` | both | 403, bot challenge |
| mn-paid-leave | `https://pl.mn.gov/sites/default/files/2026-04/2026_04_Factsheet_PaidLeaveOverview_IndFam_Final_ACC.pdf` | source | 403, bot challenge |
| moms-meet-sampling-programs | `https://momsmeet.com/current-programs/` | both | 403, bot challenge |
| moms-meet-sampling-programs | `https://momsmeet.com/faq/` | source | 403, bot challenge |
| ny-empire-state-child-credit | `https://otda.ny.gov/programs/empire-state-child-credit/` | source | connection reset |
| ny-free-portable-crib-safe-sleep | `https://www.health.ny.gov/diseases/conditions/safesleep/` | both | 403, bot challenge |
| pottery-barn-kids-registry-completion-discount | `https://www.potterybarnkids.com/customer-service/registry-faq.html` | source | 403 |
| pottery-barn-kids-registry-completion-discount | `https://www.potterybarnkids.com/pages/registry/registry-completion/` | both | 403 |
| ri-temporary-caregiver-insurance | `https://dlt.ri.gov/individuals/temporary-disability-caregiver-insurance` | both | 403, bot challenge |
| ri-temporary-caregiver-insurance | `https://dlt.ri.gov/individuals/temporary-disability-caregiver-insurance/claimants/tditci-frequently-asked-questions` | source | 403, bot challenge |
| safe-kids-car-seat-check | `https://cert.safekids.org/get-car-seat-checked` | both | 403, bot challenge |
| safe-kids-good-neighbor-car-seat-events | `https://events.safekids.org/events/good-neighbor-car-seat-checkup` | both | 403, bot challenge |
| safe-kids-good-neighbor-car-seat-events | `https://www.safekids.org/buckle` | source | 403, bot challenge |
| ssa-newborn-social-security-number | `https://www.ssa.gov/news/en/press/releases/2026-07-01.html` | source | 403, bot challenge |
| ssa-newborn-social-security-number | `https://www.ssa.gov/pubs/EN-05-10023.pdf` | source | 403, bot challenge |
| ssa-newborn-social-security-number | `https://www.ssa.gov/ssnumber/` | sign-up | 403, bot challenge |
| tenncare-diaper-benefit | `https://www.tn.gov/tenncare/members-applicants/benefits-services/diapers.html` | both | 403 |
| tenncare-diaper-benefit | `https://www.tn.gov/tenncare/members-applicants/benefits-services/tenncare-healthy-moms-babies.html` | source | 403 |
| uhc-healthy-first-steps | `https://www.uhc.com/health-and-wellness/health-topics/pregnancy` | both | 403, bot challenge |
| wic-breastfeeding-support-food-package | `https://www.fns.usda.gov/wic/breastfeeding-promotion-wic-current-federal-requirements` | source | 403, after redirect to www.fna.usda.gov |

## Fixed in this round

The full list is in `research/phase-g/link-fixes.md`. The same workflow read 328 addresses in run 6, earlier on the same day. The fixes file counts 20 dead or moved addresses across 14 programs. Each change below is in `data/programs.json`.

- **Removed 4 programs:** text4baby (the old page forwards to a closing page); Ohio Every Baby Sleeps Safe (both official pages return 404); WellCare NC (the domain now forwards to carolinacompletehealth.com); Medela Mom's Room (the link forwards to a newsletter sign-up page). The national Cribs for Kids entry stays.
- **Re-pointed 5 programs** to live official pages: Meijer free prenatal vitamins (confidence low), March of Dimes Mom and Baby Mobile Health Centers, Molina pregnancy rewards (confidence low, value estimate cleared), CT Baby Bonds, and Nurse-Family Partnership home visits.
- **Dropped 5 dead source links:** from Baby's Only free sample shipping, WIC Farmers Market Nutrition Program, Massachusetts Baby Steps savings plan, Minnesota child tax credit, and IRS HSA/FSA breast pump lactation.

## Earlier rounds

From the previous version of this page, Phase F:

- **Huggies Rewards:** the sign-up link moved to `https://www.huggies.com/en-us/rewards/rewardsapp`. The `www1` source host was removed because it does not resolve. The new page was not read.
- **MyGerber:** the sign-up link moved to `https://www.gerber.com/about-mygerber`. The `register` host was removed because it does not resolve.
- **Edgepark breast pump insurance:** the links moved to `https://www.edgepark.com/faqs_breastpumps`, because the bare host timed out.

## How to run it again

1. On GitHub, open the **Actions** tab.
2. Choose **Link check**.
3. Tap **Run workflow**. You can pick which links to check (all, sign-up or source) and enter program ids separated by commas. Leave the ids empty to check every program.
4. Tap the green **Run workflow** button.

The check also runs every Monday, at 14:17 UTC. Its report appears in the run log, in the run summary, and in an artifact named `link-report` (`link-report.md` and `link-report.json`).

When the checker finds a not-found, off-domain or dead link, the run fails. The workflow then opens an issue labelled `link-check`, or adds a comment to the one already open. Blocked and suspect links do not fail the run. When a run comes back clean, the workflow closes the open `link-check` issue with a comment that says how many links answered OK and how many could not be checked. If the checker itself crashes, the issue is left alone and the run fails.

See also [docs/automation.md](automation.md) for the full guide to the GitHub checks.
