# Link status

This page says what the automatic link check found, and which links you should open by hand.

## The last run

Checked on 2026-11-10 by the Link check workflow on GitHub.

- **85 unique links** were checked: 36 sign-up links and 80 source links, with some shared between programs.
- **71 answered OK.**
- **0 broken, 0 off-domain, 0 suspect.**
- **14 could not be checked by a robot.** The site refuses automated visits, or it timed out. Each of these was seen the same day in search results on the official domain, and their programs are marked medium confidence. The Safe Kids entry is high confidence from an earlier direct read.

Open the 14 links below by hand before you rely on them. The checker never pretends to be a person and never retries a site that refuses it.

## Links that could not be checked by a robot

"Used as" says whether the link is a sign-up page, a source page, or both.

| Link | Used as | Why it could not be checked |
|---|---|---|
| https://cert.safekids.org/get-car-seat-checked | sign-up and source | refused robots (403) |
| https://www.headstart.gov/how-apply | sign-up and source | refused robots |
| https://headstart.gov/about-us/article/head-start-faqs | source | refused robots |
| https://help.babylist.com/hc/en-us/articles/360053264354-What-is-a-Hello-Baby-Box | source | refused robots |
| https://help.babylist.com/hc/en-us/articles/360054057353-How-do-I-get-a-Hello-Baby-Box | source | refused robots |
| https://www.hrsa.gov/services/healthy-start | sign-up and source | refused robots |
| https://mchb.hrsa.gov/programs-impact/healthy-start | source | refused robots |
| https://www.buybuybaby.com/store/page/BabyRegistry | sign-up and source | timed out |
| https://www.edgepark.com/faqs_breastpumps | sign-up and source | timed out |
| https://www.gerber.com/about-mygerber | sign-up and source | refused robots (403) |
| https://www.gerber.com/gerberr-good-startr-soothepro-powder-infant-formula | source | refused robots (403) |
| https://www.huggies.com/en-us/rewards/rewardsapp | sign-up and source | refused robots (403) |
| https://www.influenster.com/registration | sign-up | refused robots |
| https://www.influenster.com/article/how-do-i-get-a-voxbox-from-influenster | source | refused robots |

## Links replaced in this round

These links were changed after the checker or a search showed a problem. Each change is in the program data in `data/programs.json`.

- **Huggies Rewards, sign-up link:** `https://www.huggies.com/en-us/rewards` changed to `https://www.huggies.com/en-us/rewards/rewardsapp`. The exact old address appeared only on other Huggies hostnames. The new page was picked from search results on the official domain, and was not read.
- **Huggies Rewards, source link removed:** `https://www1.huggies.com/en-us/offers-and-rewards/rewards` was removed from the sources, because the `www1` host does not resolve.
- **Edge Park breast pump insurance, sign-up and source links:** `https://edgepark.com/faqs_breastpumps` changed to `https://www.edgepark.com/faqs_breastpumps`. Search results list the page under the `www` host, and the bare host timed out.
- **MyGerber, sign-up link:** `https://register.gerber.com/` changed to `https://www.gerber.com/about-mygerber`. The `register` host did not resolve. The new page was picked from search results and was not read.
- **MyGerber, source link:** `https://www.gerber.com/mygerber` changed to `https://www.gerber.com/about-mygerber`. The old address was not seen in three searches on gerber.com. Confidence on this source is low.
- **MyGerber, source link removed:** `https://register.gerber.com/` was removed from the sources, because that host did not resolve.
- **Babylist Hello Baby Box, sign-up link:** `https://www.babylist.com/hello-baby/box` changed to `https://www.babylist.com/registry/new`. The old address was not seen in search results and redirects to the help centre. A registry is needed first.

## Running the check again

1. On GitHub, open the **Actions** tab.
2. Choose **Link check**.
3. Tap **Run workflow**, then the green **Run workflow** button.

The check also runs every Monday. Its report is written to the run log, and to a file named `link-report` attached to the run.

When a run passes and closes an open `link-check` issue, its closing comment says how many links answered OK and how many could not be checked.

See also [docs/automation.md](automation.md) for the full guide to the GitHub checks.
