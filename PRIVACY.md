# Privacy

Baby Freebies Finder is built to keep your information on your device.

- **No server, no accounts, no analytics, no ads, no third-party code.** The page has no login and no sign-up of its own. It loads no scripts, fonts or images from other sites.
- **The page blocks network requests.** A Content-Security-Policy in the page sets `default-src 'none'` and `connect-src 'none'`, so the page cannot send data anywhere. The tests check this policy. The page also sends no referrer.

## What is stored, and where

Everything is stored only in your browser's localStorage, under keys that start with `bff.`:

| Key | What it holds |
|---|---|
| `bff.profile.v1` | My info: your name, email, phone, address and due date |
| `bff.tracker.v1` | Your tracker statuses and notes |
| `bff.prefs.v1` | Preferences such as theme and directory filters |
| `bff.guided.v1` | The current guided run, until you finish or stop it |

Nothing is sent anywhere.

## How to delete it

- Press **Clear my info** in My info to remove your details.
- Press **Reset tracker** in the Tracker to remove statuses and notes.
- To remove everything, including preferences and the guided run, clear the site data for this page in your browser settings.

## Backups

- The tracker backup is a JSON file created on your device when you press **Download backup**. It is never uploaded.
- It includes My info only if you tick **Include My info in the backup**.
- With My info included, the backup also holds your plus-tag map (the plus address tag for each program).
- Keep the file private. Anyone who has it can read your details if you included them.

## Email and calendar buttons

- Plus addresses and Gmail filters are generated on your device. Nothing is sent to make them.
- **Search my Gmail** opens your own Gmail in a new tab with a search for that program. Google sees that search, because it is your Gmail.
- **Email me my checklist** opens your mail app with a draft you can edit. The app sends nothing.
- The reminder (.ics) and Gmail filter files are downloaded to your device. They are never uploaded.

## Links to other sites

- Sign-up links open the official program site in a new tab, with no referrer.
- Those sites have their own privacy policies. Many share data with partners or send a lot of marketing email. Each program card's "Catches" notes say so where it applies.
- Consider using a dedicated inbox or a plus address (such as `yourname+baby@gmail.com`) for these sign-ups.

## Hosting

- Opening `index.html` from your computer sends nothing.
- If you use the GitHub Pages copy, GitHub serves the page, and GitHub may log standard request data under its own privacy statement. The app itself still sends nothing.
- The GitHub link check runs on GitHub's servers. It fetches only the public sign-up pages listed in the program data, and holds none of your personal data. See [docs/automation.md](docs/automation.md).

## Autofill helper (optional)

- The helper runs on your own computer.
- Your `profile.json` stays on your computer and is listed in `.gitignore`, so it is not committed.
- The script loads only the official sign-up pages you choose, and it sends nothing else.
