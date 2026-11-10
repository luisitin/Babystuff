# Privacy

Baby Freebies Finder is built to keep your information on your device.

- **No server, no accounts, no analytics, no ads, no third-party code.** The page has no login and no sign-up of its own. It loads no scripts, fonts or images from other sites.
- **The standalone page (`index.html`) blocks network requests.** Its Content-Security-Policy sets `default-src 'none'` and `connect-src 'none'`, so the page cannot send data anywhere. The tests check this policy. The page also sends no referrer.
- **The Claude artifact copy (`artifact.html`) makes no network calls of its own.** Claude wraps the page in its own frame and policy. The app's code makes no network request. The only contact with an outside service is through Claude's Gmail connector, and only after you tap a Gmail button. See [Gmail connection (inside Claude only)](#gmail-connection-inside-claude-only).

## What is stored, and where

Everything is stored only in your browser's localStorage, under keys that start with `bff.`:

| Key | What it holds |
|---|---|
| `bff.profile.v1` | My info: your name, email, phone, address, state and due date |
| `bff.tracker.v1` | Your tracker statuses and notes |
| `bff.prefs.v1` | Preferences such as theme and directory filters, whether programs for other states are shown, and the time of your last Gmail check |
| `bff.guided.v1` | The current guided run, until you finish or stop it |

Nothing is sent anywhere. Your state hides programs for other states, and your due date builds the plan by due date. Both happen on your device, in the page, and send nothing.

**Safari can clear saved data.** Safari can delete a website's stored data after about a week of Safari use without a visit to it. A copy of the app saved to your Home Screen is not affected by that, but it has its own separate storage. Save a backup from the Tracker now and then (see Backups below).

## How to delete it

- Press **Clear my info** in My info to remove your details.
- Press **Reset tracker** in the Tracker to remove statuses and notes.
- To remove everything, including preferences and the guided run, clear the site data for this page in your browser settings.
- A fill script, bookmark code, checklist or file you copied or saved to your device is a separate copy. Delete it yourself.

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

## Gmail connection (inside Claude only)

The Gmail connection works only when the app runs as a Claude artifact with your Gmail connected in Claude. It runs only after you tap a button.

- **What it reads:** search results from your own Gmail for conversations from the programs in your list. The card shows the subject, sender and date of each match. The app does not store these. They stay in the page's memory, and they disappear when you leave the page or when Claude reports a permission problem.
- **What it saves:** the time of your last check, in `bff.prefs.v1`. The button **Use [your Gmail address] as my email** copies the Gmail account's own address into My info, only when you tap it. It then stays in the browser like the rest of My info.
- **What it writes, after a tap:** **Label these in Gmail** adds a "Baby Freebies" label to the matching conversations, after you confirm. **Draft my checklist** and **Draft my setup kit** save drafts addressed to your own email address. The drafts hold your program list and statuses, or the reminder and filter files. Nothing is sent.
- **What it never does:** it never sends, deletes, trashes or archives mail, and it never opens or changes anything without a tap.

The search and the writes go through Claude's Gmail connector, so Claude and Google handle them under their own terms. To stop the connection, disconnect Gmail in Claude.

## iPhone fill script and bookmark

- The fill script and the bookmark code are built from My info each time you tap a copy or save button. The app does not store them.
- They contain your details: name, email, phone, address, city, state, ZIP and due date. Keep them private, and do not share them.
- A bookmark made from the bookmark code holds the same details. Delete the bookmark if you stop using it.
- A script or file you save to your device is a separate copy. Delete it when you no longer need it.

The fill script runs only on https pages from the official program sites in your list, fills only empty boxes that match, and never clicks, submits or sends anything. A compromised or hostile official page can still read whatever you type or have filled into it, just as it can for anything you type there, and a shortcut that runs JavaScript can access everything on the page, so run it only on the official sign-up page and keep the script private.

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
