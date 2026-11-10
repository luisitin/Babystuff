# Phase F research brief (shared by every Phase F researcher)

You are a researcher for Baby Freebies Finder (see `CLAUDE.md`). **Do not spawn subagents.** Write your findings to your own file in `research/phase-f/` as you go, so nothing is lost if you run out of room. Reply in under 800 words.

## What the app is about to add
A small web app (a single HTML page, also published as a Claude artifact) that helps a person on an iPhone sign up for legitimate free baby programs. Phase F adds (1) a fill script the person can run on a sign-up page in Safari, through an Apple Shortcut ("Run JavaScript on Web Page") or a bookmarklet, which fills their own details and never submits; (2) a connection to the person's own Gmail; (3) phone-friendly ways to get reminders and files. We need facts from primary sources so the in-app steps are correct.

## Rules
- Primary sources only for claims: the vendor's own documentation (Apple Support, Apple Developer, WebKit blog and bug tracker, Google Help and developer docs, Microsoft Support, Yahoo Help, MDN for web platform behaviour, RFCs). Blogs, forums and Q&A sites are leads, never proof. If only a secondary source supports a claim, say so and mark it "unconfirmed".
- Record only what the page says today. Quote the key sentence (under 25 words) and give the URL and the date you read it. Never guess. If you cannot confirm something, write "not confirmed" and what you tried.
- Use WebSearch to find pages. To read a page, run the helper (WebFetch does not work in this container):
  `node /tmp/claude-0/-home-user-Babystuff/0a6e8396-c58b-57c8-b204-8e2febc15c73/scratchpad/tools/fetch-page.mjs <https-url> [maxChars=12000] [offset=0]`
  It sends an honest user agent through the session proxy.
- Respect refusals. If a fetch returns a proxy 403 ("CONNECT tunnel failed"), HTTP 403 or 429, a CAPTCHA or a bot challenge, do not retry with other user agents, headers, curl flags, tools, mirrors or caches. Fall back to what WebSearch shows from that official domain and mark the claim "from search result, page not read".
- Never sign in anywhere, create accounts or submit forms.
- Do not edit any file outside `research/phase-f/`.

## Output format (`research/phase-f/<lane>.md`)
1. **Answers**: one short section per question in your lane: the answer, confidence (high, medium, low), sources.
2. **Steps for the app**: exact, numbered, user-facing steps we can show in the app (menu names as Apple or Google spell them today, with the OS or app version they apply to).
3. **Limits and risks**: anything that would make a feature unreliable, and what to say to the user about it.
4. **Not confirmed**: open questions.
