# open-sweep notes (2026-11-08)

## Blocked network
WebFetch failed with getaddrinfo ENOTFOUND for imaginationlibrary.com, amazon.com, target.com and costco.com. The session's allowed network domains do not include them. Per the brief, I stopped fetching rather than using mirrors or caches. WebSearch with allowed_domains still works.

## Included
- imagination-library-free-books (medium): backed only by official-domain search results from imaginationlibrary.com (check-availability, terms pages). verifiedOn left blank because no page was fetched directly. Re-verify once the domain is allowed.

## Not checked (no verification possible)
Amazon Family, Target Circle baby offers, Costco, Sam's Club, CVS, Walgreens, Kroger, H-E-B, Meijer, Burlington, Kohl's, Ollie's, Dollar General, Kenvue/Johnson's, Boppy, Ergobaby, Graco/Chicco/Evenflo, Hatch, Owlet, Nanit, Shutterfly, state baby box programs, library programs, bank/credit-union kits. No candidates were rejected on the merits.

## Follow-up after coordinator correction (no curl or user-agent spoofing; WebFetch only, else allowed_domains search capped at medium)
I never used curl or a spoofed user agent. Extra allowed_domains searches run:
- Amazon (amazon.com): registry welcome box and 15% completion discount; belongs to the registry-box researcher. Not added. Amazon Family terms could not be confirmed (search result about 1,500 days old).
- Target (target.com/help/article/000062588): registry welcome kit; belongs to registry-box researcher. Not added.
- Hatch (hatch.co): 3 months Hatch+ included with a purchased Hatch Baby, then $6.99/month. Rejected: purchase-required product, not a freebie, plus a trial that renews.
- State baby boxes (.gov): Alabama DHR page (dhr.alabama.gov/child-protective-services/baby-box-initiative/) sends signup to babyboxuniversity.com, which is not an official government domain, and the detail is from 2017. New Jersey info is from a 2018 bill. NYC and NY programs are hospital or Medicaid distributed with no public signup. All rejected as unconfirmed. Safe Haven baby boxes are surrender devices, unrelated.
Still blocked for WebFetch (DNS not allowed): imaginationlibrary.com, www.amazon.com, www.target.com, www.costco.com.
