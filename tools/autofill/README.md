# Autofill helper (optional)

A small Node + Playwright script you run on your own computer. It opens a sign-up page from this repo's list in a visible browser, fills the obvious fields (name, email, address, due date) from a file on your computer, then stops so **you** can check everything, solve any CAPTCHA and press Submit yourself.

## What it will never do

- **It never submits.** It does not click Submit, Sign up or Continue buttons, never presses Enter in a field, and never calls `form.submit()` or `requestSubmit()`.
- **It never bypasses CAPTCHAs or bot checks.** No solving, no stealth plugins, no user-agent spoofing, no fingerprint tricks. It is plain, visible Playwright Chromium.
- **One site at a time.** It waits for you to press Enter in the terminal before opening the next site.
- **Only official sign-up links.** It opens only `signupUrl` values from `data/programs.json`, and refuses anything that is not `https`.
- **No sensitive fields.** It skips password, payment, card, CVV, SSN, insurance and member-ID fields, and never touches checkboxes (so marketing consent is always your choice).

## Setup

```
cd tools/autofill
npm install
npx playwright install chromium
cp profile.example.json profile.json
```

Edit `profile.json` with your own details. Keys: `firstName`, `lastName`, `email`, `phone`, `address1`, `address2`, `city`, `state` (two letters), `zip`, `dueDate` (`YYYY-MM-DD`).

## Run

```
node autofill.mjs --list                  # ids, names, domains
node autofill.mjs enfamil-family-beginnings
node autofill.mjs id-one id-two id-three  # one after another, you press Enter between
node autofill.mjs --all-free              # free programs, except health-benefits and assistance
```

(`npm start -- <id>` and `npm run list` also work.) For each site it prints what it filled (and outlines those fields in green in the browser), what it left alone, and a reminder. Then review, handle any CAPTCHA, submit by hand, and press Enter in the terminal to move on. Type `q` and Enter to quit; the browser closes at the end.

## Privacy

`profile.json` stays on your computer and is gitignored (`tools/autofill/profile.json`). Never commit it. The script sends nothing anywhere; the only network traffic is the browser loading the sign-up pages themselves.

## Troubleshooting

- Sites change their forms often. If a field was not filled, fill it by hand.
- Forms inside iframes from the same site are handled; forms inside iframes from other domains (some embedded sign-up widgets) are not. Fill those by hand.
- Fields that already have a value are never overwritten.
- Multi-step forms: only the visible step is filled. Press the page's own buttons yourself, then re-run for that program if you want another pass.
- Some sites forbid automated access in their terms. Check the site's terms, and if they forbid it, fill the form by hand.

## Testing (developers only)

`node autofill.mjs --fixture /absolute/path/form.html --headless` runs the filler against a local `file://` test page and prints the final field values and whether the page's submit handler fired. It accepts only local files and is for local testing, not for real sites. The pure matching logic is covered by `node --test tests/autofill-matcher.test.mjs` from the repo root, no Playwright needed.
