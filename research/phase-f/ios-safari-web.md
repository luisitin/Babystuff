# Phase F lane: iOS Safari web facts

Read 2026-11-10. Every fetch returned a proxy 403 ("CONNECT tunnel failed"), which is this container's network policy, not the site. So every claim below is "from search result, page not read": a search-engine summary of an official page, not a page I read. No exact quotes could be verified; short phrases are as the search summary rendered them. Retried once at end: still blocked.

Versions: WebKit's blog lists Safari 27.0 and Safari 27.2 (on iOS 27.2), so current is iOS/Safari 27.x; previous is iOS/Safari 26 (Sept 2025). Source: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ and https://webkit.org/blog/18515/webkit-features-for-safari-27-2/ (from search result, page not read).

## 1. Answers

### 1. Safari AutoFill with contact info (confidence: medium; official page, summary only)
- Current iOS (26/27): Settings > Apps > Safari > AutoFill, turn on "Use Contact Info", tap "My Info", choose your contact card. Older iOS (before the Apps grouping, e.g. iOS 17/18): Settings > Safari > AutoFill.
- To use: tap a blank form field, then tap "AutoFill Contact" above the keyboard. "Other Contact" fills a different person's card.
- "My Card" in Contacts: Apple's page speaks of choosing "My Info", not "My Card". How to mark a card as My Card is not confirmed.
- Which fields fill: Apple's page says only "contact information from that card". A field-by-field list is not confirmed. The page was not read.
- Source: https://support.apple.com/guide/iphone/fill-in-forms-iphccfb450b7/ios (from search result, page not read).

### 2. Bookmarklets (confidence: low)
- No Apple Support page on bookmarklets found. Secondary sources only (unconfirmed): add a normal bookmark, then edit it and replace the address with the `javascript:` code. A 2023 vendor post says a Safari update changed how JavaScript is saved in bookmarks and a bookmarklet had to be deleted and re-added (unconfirmed).
- iCloud sync of a bookmarklet: not confirmed. Length limit: not confirmed.
- CSP: WebKit tests and bug 86848 show `javascript:` URLs typed into page content/links are refused when the page's CSP lacks script-src/unsafe-inline permission (source: bugs.webkit.org/show_bug.cgi?id=86848, search result). The CSP spec says (per WebKit bug 149000) a policy "SHOULD NOT interfere" with user-agent features such as bookmarklets (https://bugs.webkit.org/show_bug.cgi?id=149000, search result). Whether Safari on iOS exempts bookmarklets from a page's CSP today is NOT confirmed. Note: our app's own page does not matter here; the CSP that counts is the one on the official sign-up site.

### 3. Storage lifetime (confidence: medium)
- WebKit's ITP post says it deletes all script-writable storage (IndexedDB, LocalStorage, SessionStorage, media keys, service worker registrations/cache) after seven days of Safari use without user interaction on the site. Source: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (2020; search result).
- Applies to localStorage on a first-party site visited directly? The summary says it is counted by "days of Safari use without user interaction on the site", so a site the person opens and taps in resets the counter. Exact wording on whether first-party direct visits are capped is not confirmed. Treat as at risk if the person does not return within 7 days of Safari use.
- Home Screen web apps: exempt. "first-party domain of home screen web applications is exempt" from the 7-day cap (https://webkit.org/tracking-prevention/, search result). They have their own day counter.
- Shared storage between Home Screen app and Safari: no. WebKit says the web app's data is isolated from Safari. On adding, only cookies are copied, not localStorage (https://webkit.org/blog/14787/webkit-features-in-safari-17-2/ and https://webkit.org/blog/14403/updates-to-storage-policy/, search results). So data entered in Safari will NOT appear in the Home Screen app. Pick one place to use the tracker, or export and import a backup.
- A 2020 WebKit bug reported data deleted in a Home Screen app after 9 days without launching, despite the exemption; closed as duplicate (bug 211775 or 209501; unclear). Treat the exemption as not guaranteed.
- Artifact in the Claude app: not researched; storage there is controlled by Claude, not WebKit docs. Not confirmed.

### 4. Add to Home Screen (confidence: medium-high on wording)
- Apple: Safari > Page Menu > Share > Add to Home Screen > turn on "Open as Web App" > Add. If missing, Share list > Edit Actions > add it. If Tabs layout is Bottom or Top, tap the Share button on the toolbar. Source: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios (search result).
- "Open as Web App" exists as of iOS 26 and every added site opens as a web app by default; turn it off for a plain bookmark (WebKit Safari 26 note, via https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/, search result). Before iOS 26 a manifest (display standalone/fullscreen) or meta tag was needed for web app behaviour; without it the site became a bookmark.
- Needs a manifest or `apple-mobile-web-app-capable` now? No, from iOS 26. On iOS 25 and older, yes.
- `apple-touch-icon` as `data:` URI: not confirmed.

### 5. Downloads (confidence: low)
- Apple: downloads normally land in the Downloads folder in Files; Safari shows a Downloads button by the address field; location can be set in Settings > Apps > Safari > Downloads. Source: https://support.apple.com/en-us/102440 and https://support.apple.com/guide/iphone/find-your-downloaded-files-on-iphone-iphc9cd7266c/ios (search results).
- `blob:` URL with `<a download>` behaviour: not confirmed by a first-party source.
- `.ics`: Apple documents subscribing to .ics calendars by URL or importing from Mail; no Apple page confirms that a downloaded .ics in Files/Safari offers to add events to Calendar, or one vs many events. Not confirmed. `.vcf`: not confirmed.

### 6. Clipboard (confidence: medium)
- `navigator.clipboard.writeText`: secure context (https) only; Safari requires transient user activation (MDN Clipboard.writeText, search result). WebKit's 2020 post says writes must occur inside a user gesture handler (https://webkit.org/blog/10855/async-clipboard-api/). Async work (await) between tap and write can lose the gesture (WebKit bug 225559, reporter statements; not a spec). Do the write synchronously in the tap handler.
- `document.execCommand('copy')`: MDN marks it deprecated, "no longer guaranteed to work". Whether it still works on current iOS is not confirmed; keep it only as a fallback and show a "select and copy" text box if both fail.

### 7. New tabs (confidence: medium)
- MDN: `window.open` needs a direct user gesture; returns `null` when blocked. WebKit's User Activation post says another gated API (e.g. `navigator.share`) can consume the activation. Safari 27.0 notes: `window.open()` now consumes user activation when creating a new browsing context.
- After an `await`: a WebKit bug says Safari blocked popups opened after async work. Treat as unsafe; open synchronously in the tap.
- Plain `<a target="_blank">` tap always opens: not explicitly confirmed, but it is a direct user navigation, not a pop-up. Use it instead of `window.open`.
- Sources: https://developer.mozilla.org/en-US/docs/Web/API/Window/open, https://webkit.org/blog/13862/the-user-activation-api/, https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ (search results).

### 8. mailto (confidence: medium on app choice, low on rest)
- Apple: Settings > Apps > Default Apps > Email picks the app used when opening links to send email; third-party apps must support it. Source: https://support.apple.com/en-us/121430 and https://support.apple.com/guide/iphone/change-the-default-apps-iphc57feab64/ios (search results). Older iOS: Mail app default under Settings > Mail > Default Mail App (iOS 14 to 17; not verified).
- Body length limit: not confirmed (RFC 6068 search returned nothing). Keep bodies short (a few hundred characters) and offer Copy as backup.
- Nothing sent until Send is tapped: not stated by a source I could read; it is how a mail composer works. Not confirmed.

## 2. Steps for the app (draft; iOS 26 and 27 wording; older iOS differs where noted)

**Turn on AutoFill with your contact card**
1. Open Settings > Apps > Safari > AutoFill. (iOS 18 and older: Settings > Safari > AutoFill.)
2. Turn on "Use Contact Info".
3. Tap "My Info" and choose your own contact card. Check that your name, address, phone and email are filled in on that card in the Contacts app.
4. On a sign-up page, tap a blank field, then tap "AutoFill Contact" above the keyboard. Check every field before you tap submit.

**Make a bookmarklet** (steps are unconfirmed by Apple; test once)
1. In Safari, open any page and tap Share > Add Bookmark. Name it "Baby fill".
2. Open Bookmarks (book icon), tap Edit, then tap the "Baby fill" bookmark.
3. Delete the address and paste the code the app copied. It starts with `javascript:`.
4. Tap Done. On a sign-up page, open Bookmarks and tap "Baby fill".
5. If nothing happens, the site may block it. Use AutoFill instead.

**Add to Home Screen**
1. Open the app's page in Safari.
2. Tap the Page Menu (or the Share button), then Share > Add to Home Screen.
3. Leave "Open as Web App" on, tap Add.
4. If you already saved details in Safari, they do not carry over: export a backup in Safari, then import it in the Home Screen app.

## 3. Limits and risks (plain warnings)
- Safari may erase this page's saved data after about 7 days of Safari use without you opening it. Add to Home Screen, and export a backup now and then.
- The Home Screen app and Safari keep separate data. Pick one.
- Bookmarklets may not run on some sites or may stop working after an iOS update. They only fill; you press Submit.
- Copy buttons need a tap on the button itself; if one fails, press and hold the text to copy.
- Downloaded calendar and contact files: where they go and whether Calendar offers to add events is not confirmed on iPhone; say "open it from Downloads in Files" and test it.
- Email links open whichever mail app you chose in Settings > Apps > Default Apps. Nothing is sent until you tap Send.

## 4. Not confirmed
- Exact Apple quotes; all pages unread (network policy 403).
- How to set My Card in Contacts; field-by-field AutoFill list.
- Bookmarklet creation steps (Apple), iCloud sync, length limit, CSP behaviour in iOS Safari.
- Whether first-party direct visits are capped by the 7-day rule for localStorage today (post is from 2020).
- `apple-touch-icon` as `data:` URI.
- `blob:` download prompt, `.ics` one-vs-many events on iOS, `.vcf` handling.
- `execCommand('copy')` working on iOS 27.
- `<a target="_blank">` always opening, mailto body length, "nothing sent until Send" from a first-party source.
- Storage behaviour inside the Claude app's artifact view.
