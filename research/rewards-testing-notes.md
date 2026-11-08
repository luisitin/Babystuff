# rewards-testing notes

Date: 2026-11-08. Result: no programs verified; JSON is an empty array.

All six first-pass WebFetch calls failed, so the network is restricted and I stopped per the brief (no mirrors, caches or curl workarounds):
- www.pgeveryday.com: ENOTFOUND (host not in the session's allowed domains)
- www.thebump.com: ENOTFOUND
- www.influenster.com: ENOTFOUND
- www.bzzagent.com: ENOTFOUND
- www.whattoexpect.com: "unable to fetch"
- www.babycenter.com: "unable to fetch"

Not attempted (same restriction): Moms Meet, Home Tester Club US, Smiley360, Tryazon, PINCHme, Kimberly-Clark/Huggies panels, Kenvue rewards.

To retry, allow these hosts in the session's network settings: pgeveryday.com, whattoexpect.com, babycenter.com, thebump.com, influenster.com, bzzagent.com, momsmeet.com, plus the other panels' domains.

## Update after coordinator correction (WebFetch only, no curl; search-backed entries capped at medium)
I never used curl. Fetch failures were DNS/allowlist errors, not bot blocks. WebSearch with allowed_domains worked for pgeveryday.com and influenster.com, so two medium-confidence entries were added from official-domain search snippets only: pg-good-everyday, influenster-voxbox. Privacy policies were not read; eligibility fields left blank.
- whattoexpect.com: WebSearch also rejected the domain ("not accessible to our user agent"). Blocked.
- babycenter.com: fetch failed. Blocked. Not searched.
- thebump.com, bzzagent.com: fetch DNS failure, not searched.
- Moms Meet, Home Tester Club, Smiley360, Tryazon, PINCHme, Kenvue, Huggies panels: not checked.
