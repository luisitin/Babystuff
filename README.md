# Baby Freebies Finder

Baby Freebies Finder is a page you can use on a phone or computer to find legitimate US programs for someone expecting a baby. It lists places that offer free formula, diapers, samples, registry welcome boxes, rewards and benefits, and it includes a helper that gets you through the sign-up forms faster. Every link goes to an official program page. The page never submits anything for you, has no ads or trackers, and works offline. It is not affiliated with any brand. Offers change, so always read the official page before you sign up.

## Screenshots

<p align="center">
  <img src="docs/screenshots/programs.png" alt="The Programs view on a phone, listing free baby programs with search and filters" width="240">
  <img src="docs/screenshots/guided.png" alt="The Do it for me view on a phone, showing an open sign-up page button and a set of details to copy" width="240">
  <img src="docs/screenshots/programs-dark.png" alt="The Programs view in dark mode on a phone" width="240">
  <img src="docs/screenshots/tracker-email.png" alt="The Tracker's Email and calendar panel on a phone, with buttons for the checklist email, Gmail filters and calendar reminders" width="240">
</p>

## What's inside

- **Programs:** the full directory. Search it, filter by category, or tick "Truly free", "Email only" or "Needs a registry". You can sort the list too.
- **My info:** your name, email, address and due date. It is stored only in your browser. Tip: use a dedicated inbox or a plus address like `yourname+baby@gmail.com`, so sign-up mail is easy to filter. At the end of My info, the **Fill forms on your phone** card shows three ways to fill sign-up forms on an iPhone. See [On an iPhone](#on-an-iphone).
- **Tracker:** mark each program as To do, Signed up, Received or Skipped, and add notes. You can download a JSON backup and restore it later. Inside Claude, the **Gmail connection** card under the Email and calendar card is optional. See [Connect Gmail (inside Claude)](#connect-gmail-inside-claude).
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

## Automation: buttons and email

These buttons save typing and inbox clutter. Each one either hands off to your own mail app, your Gmail, your calendar or your browser, or downloads a file to your device. **Nothing here submits sign-up forms for you or gets past CAPTCHAs; you press Submit yourself.**

- **One plus address per program.** In My info, turn on "Give each program its own plus address". Each program then gets an address like `jane+similac@gmail.com`, built from your own email. Mail still arrives in your normal inbox, but you can see which program shared your address and filter out any program that sends too much. Yahoo does not support plus addresses, so the app leaves Yahoo addresses plain. For other providers, send yourself a test message first.
- **Gmail filters.** In the Tracker, under **Email and calendar**, press **Download Gmail filters**. Then in Gmail, go to **Settings > See all settings > Filters and Blocked Addresses > Import filters**, choose the downloaded file, tick the filters you want and press **Create filters**. Each filter adds a label such as `Baby Freebies/Program name`. With plus addresses on, the filters match each tagged address exactly, which makes **Skip the inbox (archive)** safe to use. Without them, filters match each program's sender domain and never archive anything.
- **Search my Gmail.** If your email is Gmail, each program in the Tracker has a **Search my Gmail** link. It opens your own Gmail in a new tab with a search for that program. If you use a different Google account, set its number under **Gmail account number** in the Tracker.
- **Email me my checklist.** Opens your mail app with a draft to your own address. The draft lists each program with its status and sign-up link. You can edit it; the app sends nothing. If the list is too long for an email link, it is cut short there and the full text is copied for you to paste.
- **Calendar reminders.** Press **Download reminders (.ics)** to get a calendar file with one all-day reminder for each program marked Signed up, 28 days after you marked it. Open the file to add the reminders to your calendar.
- **Guided run.** "When I tap Done or Skip, open the next sign-up page" is on by default, so the next program's page opens in a new tab. If your browser blocks the new tab, the page tells you to use the Open button. Single-key shortcuts (O, C, D, S, P, B, N) are optional: tick "Enable single-key shortcuts" under **Shortcuts** to turn them on. After Done or Skip, **Undo** puts that program back the way it was, until you take another action.
- **Start a guided run with these N.** In Programs, after you filter the list, press this button to start a guided run with just the programs shown. If a run is already in progress, the app asks before it replaces that run.
- **Autofill helper.** The optional helper on your computer can work from a backup you download from the Tracker. It writes your statuses into a new `-updated.json` file, which you restore in the Tracker. See [tools/autofill/README.md](tools/autofill/README.md).

## On an iPhone

Three short options, from the least effort to the most. Each one fills empty boxes from My info. You check everything and press the final button yourself.

1. **Safari AutoFill:** no script at all. In Settings, turn on **Use Contact Info** and choose your own contact card.
2. **A Shortcut:** copy the fill script from My info, then run it from Safari's Share menu on an official sign-up page.
3. **A bookmark:** copy the bookmark code from My info and paste it as the address of a Safari bookmark.

The steps, the Home Screen note and the troubleshooting list are in [docs/iphone.md](docs/iphone.md). None of this has been tried on a real iPhone yet.

## Connect Gmail (inside Claude)

This is optional. It works only when the app is opened as a Claude artifact (`artifact.html`) with your Gmail connected in Claude. Nothing happens until you tap a button.

After a tap, the **Gmail connection** card can:

- **Check my Gmail:** search your mail for sign-up and shipping emails from the programs in your list, then list what it finds. Suggested tracker updates change only when you tap them.
- **Label these in Gmail:** add one label, "Baby Freebies", to the conversations it found. It asks you to confirm first.
- **Draft my checklist** and **Draft my setup kit:** save a draft addressed to your own email address. Nothing is sent.

It never sends, deletes, trashes or archives mail, and it never opens or changes anything without a tap. Claude asks you to allow the connector first, and you can decline. Results disappear when you leave the page.

The card can also offer **Use** followed by your Gmail address and "as my email". That copies the address into My info, but only when you tap it.

**Availability:** Anthropic's help pages say that artifacts using connected apps are available on Pro, Max, Ultra, Team and Enterprise plans on Claude on web and desktop, and that connector tools needing approval for each action are not available to artifacts. The help pages do not say whether this works in the Claude iPhone app. If the Connect button does nothing or says the connection is not available, everything else still works; use the Search my Gmail links instead. Labels and drafts may not be offered in every setup, and the card hides any button that is not offered.

Connecting Gmail in Claude, step by step, is on the card itself. The privacy details are in [PRIVACY.md](PRIVACY.md#gmail-connection-inside-claude-only).

## Use it

- **Easiest:** download this repository, then double-click `index.html` to open it in any browser. You can also download just that one file.
- **Online:** use the GitHub Pages link once it is set up (see below). It serves `index.html`.
- **In Claude:** paste the contents of `artifact.html` into a Claude artifact. It is the same app, packaged for Claude. The Gmail connection works only there.

The build writes both files: `index.html` for the standalone page, and `artifact.html` for Claude.

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
3. Run `node scripts/build.mjs` to rebuild `index.html` and `artifact.html`, then run `node --test` to check the data and the build.
4. Commit `data/programs.json`, `index.html` and `artifact.html`.

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

## Automatic checks on GitHub

GitHub runs three automatic checks for this repository. You do not need to install anything. The full guide is in [docs/automation.md](docs/automation.md).

- **CI** runs on every push and pull request. It rebuilds `index.html` and `artifact.html`, fails if either committed file is out of date, and runs the tests.
- **Link check** runs every Monday. You can also start it by hand: open the **Actions** tab, choose **Link check**, tap **Run workflow**, then the green **Run workflow** button. It visits each program's sign-up page and reports pages that are gone or that redirect to another site. Pages that block automated visits are listed but never fail the check. When a run passes and closes an open link-check issue, its closing comment says how many links answered OK and how many could not be checked. The unchecked links, and what to do about them, are in [docs/link-status.md](docs/link-status.md). The checker never pretends to be a person and never retries a site that refuses it.
- **Email:** GitHub emails the repository owner when a `link-check` issue opens or a scheduled run fails. These are GitHub issue and Actions notifications, not messages from the app.

## For developers

- **Layout:**
  - `src/`: the HTML, CSS and JavaScript source.
  - `data/programs.json`: the program data.
  - `scripts/build.mjs`: builds two self-contained files with the data and code inlined: `index.html` (the standalone page) and `artifact.html` (the same app for a Claude artifact).
  - `tests/`: the unit tests, run with `node --test`.
  - `tests/e2e/`: the browser test, run by hand with Playwright. It is not part of CI.
  - `tools/autofill/`: the optional local helper.
  - `research/`: raw research and notes.
  - `docs/`: guides, including [docs/iphone.md](docs/iphone.md) and [docs/link-status.md](docs/link-status.md).
- **Commands:**
  - `npm test` (same as `node --test`) runs the unit tests.
  - `npm run build` (same as `node scripts/build.mjs`) rebuilds `index.html` and `artifact.html`.
  - `node tests/e2e/run.mjs` runs the browser test. It needs Playwright, is not part of CI, and is run on your own computer.
- **No dependencies:** the app has no frameworks and no runtime packages. Only the optional autofill helper and the browser test use Playwright, and the helper has its own `package.json`.
- **Build check:** a test confirms that both committed files, `index.html` and `artifact.html`, match a fresh build, so edit `src/` or the data, then rebuild.
- **More reading:** [ARCHITECTURE.md](ARCHITECTURE.md) (the build contract), [PRIVACY.md](PRIVACY.md) (what is stored and where) and [CLAUDE.md](CLAUDE.md) (working rules and the data schema).
