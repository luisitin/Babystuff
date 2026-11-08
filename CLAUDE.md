# Baby Freebies Finder: working rules

A mobile-first, offline web app listing legitimate US programs where someone expecting a baby can sign up for free formula, diapers, wipes, feeding gear, baby-care samples, registry welcome boxes and rewards. See `PROGRESS.md` for where the build stands.

Layout: `src/` (HTML, CSS, vanilla JS), `data/programs.json`, `scripts/build.mjs` (builds the self-contained root `index.html` with the data inlined), `tests/` (`node --test`), `tools/autofill/` (optional local Playwright helper), `research/` (raw research and notes).

## 1. Models and subagents
- The orchestrator runs Claude Opus 5.5. Its job is to plan, delegate, review and integrate. All research, coding and checking goes to subagents through the Agent tool, with `model` passed on every call:
  - `sonnet` (Sonnet 5.5) for research, fact-checking, merging data, writing code and code review
  - `haiku` (Haiku 5.5) for mechanical work: link checks, running tests, formatting, docs
- Never spawn a subagent with `opus` or with no `model`, and don't use forks, because they run on the orchestrator's model.
- 500K context cap per subagent. The environment should set `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000`, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, `CLAUDE_CODE_FORK_SUBAGENT=0`, `ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-5-5` and `ANTHROPIC_DEFAULT_HAIKU_MODEL=claude-haiku-5-5`. Check with `env | grep -E 'CLAUDE_CODE|ANTHROPIC_DEFAULT'`; if any are missing, say so and carry on. Either way, size every task to finish well under 500K: one narrow job per subagent, results written to files as it goes, and a reply under 1,500 words.
- Subagents must not spawn their own subagents. Put that line in every brief.
- Run independent subagents in parallel, at most 8 at a time.
- Reusable definitions live in `.claude/agents/` (`researcher.md`, `builder.md`, `checker.md`) with `model: claude-sonnet-5-5` or `model: claude-haiku-5-5`, `autoCompactWindow: 500000` and `disallowedTools: Agent`. Still pass `model` on every call.
- Keep `CLAUDE.md` (sections 1, 2 and 4 of the brief) and update `PROGRESS.md` after each phase so a later session can pick up where the last one left off.

## 2. Repo rules (hard limits)
- Work only in the repository attached to the session (`luisitin/Babystuff`).
- Never push to, open pull requests on, or call the API for any other repository.
- Do all work on a branch, never on main: the session's `claude/...` branch, or `claude/baby-freebies-v1`.
- Commit in small steps. When everything is done, push the branch and open a pull request into main with the built-in GitHub tools or `gh api repos/OWNER/REPO/pulls` (REST; `gh pr` doesn't work in cloud sessions). If that fails, tell the user so they can tap Create PR.
- If pushing fails, finish the build in the cloud VM anyway and say so. Never fall back to another repository.

## 4. Research rules (copy into every research brief)
- Use WebSearch to find programs and WebFetch to verify them. Confirm every program on the brand's or retailer's own site; `signupUrl` must be on that official domain. Blog roundups and coupon sites are leads, never proof.
- Record only what the official page says today. If a detail isn't there, leave it blank and lower the confidence. Never guess. If one official site blocks fetching, official-domain search results can back up the entry, but cap its confidence at medium.
- Leave out survey or "free box" lead-gen sites, anything asking for card details for a free item (a disclosed shipping fee is fine if labeled), unlabeled auto-renewing trials, look-alike sites, expired offers and non-US programs.
- If most WebFetch calls come back 403 or blocked, the environment's network is probably restricted. Stop and ask the user to switch network access to Full, then retry when they say go. Don't use mirrors or caches.
- Each research subagent writes `research/<category>.json` in the schema below and `research/<category>-notes.md` listing what it left out and why.

### Program schema (`data/programs.json` is an array of these)
`id` (kebab-case, unique), `name`, `brand`, `category` (formula, diapers-wipes, registry-box, feeding, baby-care, rewards, health-benefits, assistance, product-testing), `whatYouGet`, `costToClaim` (free, shipping-fee, purchase-required, membership-required), `costDetail`, `requirements` (list from: email, address, phone, due-date, registry, app, purchase, membership, insurance, eligibility; `membership` means a paid membership, a free store account counts as `email`), `eligibility`, `region`, `signupUrl` (https, official domain), `sourceUrls` (list of official https pages), `verifiedOn` (YYYY-MM-DD), `confidence` (high, medium, low), `catches`, `notes`.

## Product rules
- The app never submits forms itself, has no ads, analytics, trackers or third-party scripts, and makes no network calls. It links out only to official program pages, plus the person's own email (`mailto:` to their own address and Gmail search links, added at the user's request for email automation).
- No frameworks and no runtime dependencies. `node scripts/build.mjs` builds one self-contained `index.html` that works offline, on GitHub Pages, or pasted into a Claude artifact.
- Personal details live only in the browser's localStorage.
- The autofill helper never submits, never bypasses CAPTCHAs or bot checks, and does one site at a time.
- Automation (Phase E) means one-tap buttons, downloads (Gmail filters, .ics reminders, backups) and GitHub Actions. It never means submitting sign-up forms or clicking through bot checks.
