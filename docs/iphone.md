# Fill sign-up forms on an iPhone

This guide shows how to use the Baby Freebies Finder on an iPhone to fill in sign-up forms from the details in My info. It covers three ways to fill a form, how to save the page to your Home Screen, backups, and what needs a computer.

> These steps come from Apple's, WebKit's and MDN's help pages as shown in search results. The pages themselves could not be opened from the build environment, and nothing here was tried on a real iPhone, so menu names may differ slightly on your iOS version.

## Before you start

- Fill in **My info** first: at least your name, email and address. The copy buttons stay off until there is something to fill.
- Use the sign-up page that the app links to. Open it from the app, so you are on the official site.
- Every way below only fills empty boxes. You check every field, tick any boxes yourself, and press the site's own submit button.

## Option 1: Safari AutoFill (no script)

Use this if you want no script at all. It uses your own contact card.

1. Open **Settings**, then **Apps**, then **Safari**, then **AutoFill**. On iOS 18 and older, go to **Settings**, then **Safari**, then **AutoFill**.
2. Turn on **Use Contact Info**.
3. Tap **My Info** and choose your own contact card. In Contacts, check that the card has your name, address, phone and email.
4. On a sign-up page, tap an empty field, then tap **AutoFill Contact** above the keyboard. Check every field before you submit. Which fields it fills is Apple's choice.

## Option 2: Fill with a Shortcut (recommended, not tested on a phone yet)

The Shortcut runs the fill script on the page you are looking at, from Safari's Share menu. The app gives you the script to paste. A ready-made shortcut file is not included, because shortcut files must be signed by Apple's app.

1. In My info, under **Fill forms on your phone**, tap **Copy fill script**. If copying does not work, tap **Save fill script as a file**, or select the text that appears.
2. Open **Settings**, tap **Shortcuts**, then **Advanced**, and turn on **Allow Running Scripts**.
3. Open the **Shortcuts** app and tap **+** to start a new shortcut.
4. Search the actions for "Run JavaScript" and add **Run JavaScript on Web Page**.
5. Tap the script box in that action, clear what is there, and paste the script you copied.
6. Open the shortcut's details (the info button) and turn on **Show in Share Sheet**. Then untick every accepted type except **Safari web pages**.
7. Name it, for example "Baby form fill", and tap **Done**.
8. In Safari, open the official sign-up page, tap **Share**, then tap "Baby form fill". iPhone may ask whether the shortcut can use that website. Allow it for the official site only.
9. Check every field, fill in anything it skipped, and press the site's own submit button yourself.

If you change My info, copy the script again and paste it over the old one in the shortcut. We have not confirmed how Apple lets you edit it.

## Option 3: Use a bookmark (Apple does not document this; test it once)

1. In My info, tap **Copy bookmark code**.
2. In Safari, open any page, tap **Share**, then **Add Bookmark**. Name it "Baby fill" and save it.
3. Open **Bookmarks**, tap **Edit**, then tap "Baby fill".
4. Delete the address and paste the code you copied. It starts with `javascript:`.
5. Tap **Done**. On a sign-up page, open **Bookmarks** and tap "Baby fill".

If nothing happens, the site may block bookmark scripts, or a Safari update may have changed how bookmarks are saved. Use the Shortcut or AutoFill instead.

## Add the app to your Home Screen

1. Open the app in Safari.
2. Tap **Share**, then **Add to Home Screen**. If you do not see it, scroll to the end of the list and tap **Edit Actions** to add it.
3. Leave **Open as Web App** on and tap **Add**.

**Warning:** the Home Screen app keeps its own copy of your data, separate from Safari. If you already saved details in Safari, save a backup there first (see Backups below) and load it in the Home Screen app.

## Backups

Your data is stored only in the browser. Save a backup now and then:

1. In the **Tracker**, tap **Download backup**.
2. Keep the file private. It holds your tracker statuses and notes. It includes My info only if you tick **Include My info in the backup** first, and then anyone who has the file can read your details.

Safari can clear a website's saved data after about a week of Safari use without a visit to it. Having a recent backup means you can load your statuses back in.

## What needs a computer

Some features are not offered on a phone:

- **Gmail filters:** on a computer, open Gmail, go to **Settings** (gear), then **See all settings**, then **Filters and Blocked Addresses**, and use **Import filters**. The phone apps do not offer this.
- **Calendar reminders:** the reminder file is a `.ics` file. On an iPhone, Apple Calendar can open an `.ics` file. Google Calendar's import needs a computer browser.
- **Inside Claude, the files arrive in a zip.** Claude only allows certain file types to be saved, so calendar and Gmail-filter files arrive inside a small `.zip`. Unzip it first, then use the file inside.

## Troubleshooting

1. **Nothing fills.** The site may block scripts, or the page is not one of the official sign-up sites in your list. Use AutoFill or type the details.
2. **The message says "This is not one of the official sign-up sites in your list."** The script stopped and filled nothing. Check the address at the top of Safari. Go back to the official page from the app.
3. **The copy buttons are greyed out.** Fill in My info first. The buttons turn on once there is something to fill.
4. **The Shortcut does not appear in the Share Sheet.** Open the shortcut's details and check that **Show in Share Sheet** is on and that **Safari web pages** is the only type ticked.
5. **Save fill script as a file does not work.** Use **Copy fill script** instead, or select the text that appears and copy it.
6. **The Home Screen app has no data.** It has its own separate storage. Load your backup in the Home Screen app.
7. **The fill script is out of date.** You changed My info. Copy the script again and replace the old one.

Keep the script private. It contains the details you saved in My info.
