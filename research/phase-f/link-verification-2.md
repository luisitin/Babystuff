# Link verification 2, 2026-11-10
Method: WebSearch only, results on the program's own domain. Every claim is "from search result, page not read". Confidence capped at medium. Pages not fetched (proxy refuses).

## A. Gerber (gerber-mygerber-baby)
- Query "MyGerber join create account" (gerber.com): "Join MyGerber Membership" https://www.gerber.com/about-mygerber (summary: free sign-up, name, child's birthday or due date, email, password). Also "MyGerber Signup" https://register.gerber.com/ (indexed, but DNS failed for the checker twice; unresolved from our side), "MyGerber Experts Have Your Back, 24/7" https://www.gerber.com/mygerber-baby-expert, https://membersweek.gerber.com/register (promo).
- Query "Gerber sign up baby due date MyGerber Baby": same set; about-mygerber again.
- Query "gerber.com mygerber": https://www.gerber.com/mygerber NOT seen in three queries (not proof it is gone; host answered 403 so it is alive).
- Recommendation: signupUrl -> https://www.gerber.com/about-mygerber (on the live www.gerber.com host, title says join). Medium. register.gerber.com: remove from sourceUrls (cannot be resolved by the checker, and its content is covered by about-mygerber). Weak: it may be a DNS blip; low risk either way.
- Query "Gerber Good Start SoothePro powder infant formula": https://www.gerber.com/gerberr-good-startr-soothepro-powder-infant-formula seen today. Summary: official page says "currently out of stock", and says NAN EXPERTpro SENSIPRO is equivalent. Verdict KEEP (medium). It does not mention free samples, so it supports only the formula-availability context.

## B. Huggies (huggies-rewards)
- Query "Huggies Rewards join app": https://www.huggies.com/en-us/rewards/rewardsapp titled "Huggies Rewards Mobile App for Apple & Google Play" is indexed on www. www1 page /en-us/offers-and-rewards/rewards seen only as www1/www2 variants titled "Sign Up To Earn & Redeem Rewards Points" (www1 host failed to resolve in checker).
- Query "Huggies Rewards+ Fetch": Huggies FAQ (www7 host) says launched with Fetch; enroll by tapping the Huggies logo in Fetch's baby section; 25 points per receipt scan. A page about the earlier Rewards+ says it ended 2024-03-31.
- Query "Huggies Rewards earn redeem points sign up" (www.huggies.com): https://www.huggies.com/en-us/register "Register" (create account for offers and tips). An FAQ says the old Huggies Rewards was sunset 2020-11-30 (conflict with the current "Rewards+" through Fetch). https://www.huggies.com/en-us/rewards not seen on www host (only www7).
- Verdict: program exists as Huggies Rewards+ via Fetch (medium, low on details). Name conflict: "Huggies Rewards" (app page title still used) vs "Rewards+ (Fetch)" vs 2020 sunset FAQ. Bonus amounts conflict (500, 100, 25 per scan).
- Proposed: signupUrl -> https://www.huggies.com/en-us/rewards/rewardsapp; drop www1 source.

## C. Source pages
- headstart.gov/about-us/article/head-start-faqs: KEEP. Seen with title "Head Start FAQs" (query "Head Start FAQs pregnant women Early Head Start").
- help.babylist.com 360053264354 "What is a Hello Baby Box?": KEEP (seen). 360054057353 "How do I get a Hello Baby Box?": KEEP (seen).
- mchb.hrsa.gov/programs-impact/healthy-start: KEEP. Seen titled "Healthy Start".
- influenster.com/article/how-do-i-get-a-voxbox-from-influenster: KEEP. Seen titled "How Do I Get a VoxBox From Influenster?" (article reported as about 7.5 years old; catches already cite it).
- babylist.com/hello-baby/box: NOT seen in results. Seen: https://www.babylist.com/registry/new "Create a Baby Registry" (on-domain), and help article https://help.babylist.com/hc/en-us/articles/360054057353 (claim steps: For You tile on dashboard, web or app). Help-centre section URL (sections/115004098188) NOT seen as a result. Recommendation: signupUrl -> https://www.babylist.com/registry/new (a registry is required first; medium). Alternative, keep /hello-baby/box (redirect seen by checker). Prefer registry/new as it is seen today and the box requires a registry.
