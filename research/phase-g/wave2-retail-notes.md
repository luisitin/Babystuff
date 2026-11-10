# wave2-retail notes (2026-11-10)

Method: WebSearch with allowed_domains per retailer. One WebFetch (target.com) failed: host not in the session's allowed network, so nothing was fetched. The session's web search budget ran out after about 47 searches, so the leads marked NOT SEARCHED below were never looked at. They are not "nothing found"; they need a follow-up run.

## Part A (existing entries)
- buybuy-baby-registry-welcome-bag: CHANGED to low confidence. Older registry page and store pages (Los Angeles, New York) still say "bag with free samples, coupons and a Registry Guide", store pickup or ask at an in-store personal shop. The newer registry page lists group gifting, a percentage off, price match and 365-day returns, and no bag. A buybuy BABY FAQ says the old stores and site were liquidated and a relaunch with a registry program was planned. No purchase condition seen. Kept in, flagged.
- kohls-babies-r-us-welcome-box: CHANGED to medium. Kohl's product page, FAQ 4278 and registry page all describe a $20 box made free by a digital-wallet coupon, primary owner only, one per year, 365-day coupon, not returnable, while supplies last. A stale mobile page says the registry may be discontinued. Shipping on the box not stated (standard rates $8.95 or free at $49 appear on the page), so costToClaim stays free with a caveat.
- macrobaby-gift-box: terms unchanged (20 items, first qualifying purchase $15+, one per registry, random contents, $80 fee if items returned without the box). Online; purchase required. Only notes/costDetail text edited; confidence and verifiedOn left as they were.
- target-registry-welcome-kit: CONFIRMED purchase-required. Help article: join Circle, registry, 10 unique items, over $10 purchased from it, accept the bonus, 24 to 48 hours, one per year, shipping and handling fees apply (amount not stated). Not an in-store pickup. Confidence medium (search only).

## Part B outcomes
Included: meijer-free-prenatal-vitamins (low; newsroom page undated, details from a 2011 release), price-chopper-free-prenatal-vitamins (low; one blog post), bloomingdales-baby-registry-completion-discount (medium).

Leave out / nothing found:
- Kroger banners (incl. Fred Meyer): no free prenatal program; BOGO shelf promos only. No baby club (general free rewards membership only).
- Publix: no free prenatal vitamins. Club Baby not found; only Club Publix digital coupons for baby items.
- H-E-B: no free prenatal; prenatal tablets $4.97. No baby club (Baby Club results are club-pack diapers).
- Hy-Vee: nothing for prenatal or baby; PERKS and Fuel Saver only.
- Giant Eagle: nothing; free prescription delivery only.
- Schnucks: nothing (pharmacy is CVS-run).
- ShopRite: nothing.
- Wegmans: no free prenatal, no Baby Club.
- Walmart: no free prenatal at retail; a plan document lists $0 prenatal vitamins only under an employer health plan (not a retail offer). Registry boxes already covered in registry.json.
- Sam's Club: no baby club; Huggies Parenting Club page is product listings.
- Costco: nothing free.
- CVS: no free program; BOGO and HSA/FSA only.
- Walgreens: no baby program beyond free myWalgreens (1% cash back) and Kimberly-Clark spend offers.
- Rite Aid: nothing free (20% promo code, BOGO).
- Stop & Shop / Giant: no baby club found.
- Safeway / Albertsons: "Baby Club" is buy-2-save-$10 / spend-$25-save-$5, listings dated 2025 and a purchase, so left out.
- Meijer Baby: no welcome gift or registry gift (the free-prescription program is the entry above).
- BJ's: only spend $100 on baby items for a $20 coupon, expires 11/15/2026; purchase offer, left out.
- IKEA Family: free kids' meals and a Lingokids trial; nothing for expecting parents or a baby product. Left out.
- Walmart registry completion discount: not found in results (registry boxes and cleaning only); nothing new.
- Pottery Barn Kids: no welcome gift; 15% completion discount already in registry.json.
- Crate & Kids: no welcome gift; completion discount already covered (older FAQ says 3 months after, registry page says 3 before and 6 after).
- West Elm: no welcome gift; free nursery design service only (not a product).
- Nordstrom: no registry perks found.
- Albee Baby: no welcome gift; free registry, up to 20% back in rewards and an automatic completion discount for nine months, but the percent was not stated, so not entered. Giveaways are sweepstakes.
- Bloomingdale's: included (20% completion).
- Dillard's: no registry perks found.
- Macy's: welcome gift ended (help says the Baby Box was discontinued February 2026); completion discount already covered.
- Babylist showrooms: no gift; Hello Baby Box already covered.
- MyRegistry: no own gift; lists partner perks already covered.

NOT SEARCHED (budget exhausted): Amazon registry free gift beyond the welcome box, Carter's/OshKosh, The Children's Place, Gymboree, Old Navy/Gap, Janie and Jack, Hanna Andersson, Primary, Shutterfly, Snapfish, Mixbook, Minted, Amazon Family / Walmart+ / Target Circle 360 baby perks, Mothers Lounge "pay shipping" offers, buybuy BABY online (partly seen under Part A). Target Circle registry offers: already in rewards-testing.json.

## Unconfirmed
- Meijer current covered-drug list and limits; Price Chopper program details.
- buybuy BABY bag status under the new owner.
- Whether the Kohl's box adds shipping.
- Rite Aid pharmacies may be closed; not checked.
