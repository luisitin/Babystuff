# Baby Freebies Finder

Baby Freebies Finder is a page you can use on a phone or computer to find legitimate US programs for someone expecting a baby. It lists places that offer free formula, diapers, samples, registry welcome boxes, rewards and benefits, and it includes a helper that gets you through the sign-up forms faster. Every link goes to an official program page. The page never submits anything for you, has no ads or trackers, and works offline. It is not affiliated with any brand. Offers change, so always read the official page before you sign up.

## Screenshots

<p align="center">
  <img src="docs/screenshots/programs.png" alt="The Programs view on a phone, listing free baby programs with search and filters" width="240">
  <img src="docs/screenshots/guided.png" alt="The Do it for me view on a phone, showing an open sign-up page button and a set of details to copy" width="240">
  <img src="docs/screenshots/programs-dark.png" alt="The Programs view in dark mode on a phone" width="240">
</p>

## What's inside

- **Programs:** the full directory. Search it, filter by category, or tick "Truly free", "Email only" or "Needs a registry". You can sort the list too.
- **My info:** your name, email, address and due date. It is stored only in your browser. Tip: use a dedicated inbox or a plus address like `yourname+baby@gmail.com`, so sign-up mail is easy to filter.
- **Tracker:** mark each program as To do, Signed up, Received or Skipped, and add notes. You can download a JSON backup and restore it later.
- **Do it for me:** pick the programs you want, then go through them one at a time. Each step opens the official sign-up page and gives you Copy buttons for your details. You press the buttons yourself.
- **Spot a fake:** short tips for telling real freebie offers from scams.

### What's in the directory (37 programs)

| Category | Programs |
|---|---|
| Formula | 4 |
| Diapers & wipes | 2 |
| Registry welcome boxes | 7 |
| Feeding gear | 1 |
| Baby care | 1 |
| Rewards | 1 |
| Health benefits | 8 |
| Assistance programs | 8 |
| Product testing | 5 |

## Use it

- **Easiest:** download this repository, then double-click `index.html` to open it in any browser. You can also download just that one file.
- **Online:** use the GitHub Pages link once it is set up (see below).
- **In Claude:** paste the contents of `index.html` into a Claude artifact.

## Host it free on GitHub Pages

1. Merge the pull request into `main`.
2. In GitHub, go to **Settings > Pages > Build and deployment**. Under **Source**, choose **Deploy from a branch**. Under **Branch**, choose `main` and the folder `/ (root)`. Click **Save**.
3. Wait a minute or two. The site appears at https://luisitin.github.io/Babystuff/

If GitHub shows another branch as the default, switch it to `main` first in **Settings > Branches**.

## Update the program data

1. Edit `data/programs.json`. Each program is one entry with these fields:
   - **id:** a short unique name in lowercase with dashes, such as `enfamil-family-beginnings`.
   - **name** and **brand:** the program name and the company behind it.
   - **category:** one of the nine categories listed above.
   - **whatYouGet:** what the family receives, in plain words.
   - **costToClaim:** free, shipping-fee, purchase-required or membership-required.
   - **costDetail:** the cost in a sentence.
   - **requirements:** a list from email, address, phone, due-date, registry, app, purchase, membership, insurance and eligibility.
   - **eligibility:** who qualifies.
   - **region:** for example, US.
   - **signupUrl:** the official sign-up page (https, on the brand's own domain).
   - **sourceUrls:** official https pages that back up the entry.
   - **verifiedOn:** the date you checked the page, as YYYY-MM-DD.
   - **confidence:** high, medium or low.
   - **catches:** the fine print, such as marketing email or a shipping fee.
   - **notes:** anything else useful.
2. Follow these rules:
   - Use official pages only. Blog roundups and coupon sites are leads, not proof.
   - Record only what the official page says today. If a detail is not there, leave it blank and lower the confidence. Do not guess.
   - Set `verifiedOn` and `confidence` honestly.
3. Run `node scripts/build.mjs` to rebuild `index.html`, then run `node --test` to check the data and the build.
4. Commit both `data/programs.json` and `index.html`.

The `research/` folder shows how the current data was gathered. `research/excluded.md` lists what was left out and why, and `research/factcheck.md` records the fact-check.

## Optional: autofill helper

The autofill helper lives in `tools/autofill` and runs on your own computer. It opens one sign-up page at a time in a visible browser and fills the obvious fields from a `profile.json` file on your computer. It never submits a form, never gets past a CAPTCHA, and you check everything and press Submit yourself. See [tools/autofill/README.md](tools/autofill/README.md) for the full details.

Quick start:

```
cd tools/autofill
npm install
npx playwright install chromium
cp profile.example.json profile.json
node autofill.mjs --list
node autofill.mjs enfamil-family-beginnings
```

Edit `profile.json` with your own details before you run it.

## For developers

- **Layout:**
  - `src/`: the HTML, CSS and JavaScript source.
  - `data/programs.json`: the program data.
  - `scripts/build.mjs`: builds the single self-contained `index.html` with the data and code inlined.
  - `tests/`: the tests.
  - `tools/autofill/`: the optional local helper.
  - `research/`: raw research and notes.
- **Commands:** `npm test` (same as `node --test`) runs the tests. `npm run build` (same as `node scripts/build.mjs`) rebuilds `index.html`.
- **No dependencies:** the app has no frameworks and no runtime packages. Only the optional autofill helper uses Playwright, and it has its own `package.json`.
- **Build check:** a test confirms that the committed `index.html` matches a fresh build, so edit `src/` or the data, then rebuild.
- **More reading:** [ARCHITECTURE.md](ARCHITECTURE.md) (the build contract), [PRIVACY.md](PRIVACY.md) (what is stored and where) and [CLAUDE.md](CLAUDE.md) (working rules and the data schema).
