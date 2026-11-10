# Phase F lane: iOS Shortcuts "Run JavaScript on Web Page"

Read on 2026-11-10. IMPORTANT: every fetch of support.apple.com failed with this container's proxy error ("CONNECT tunnel failed, response 403", retried once near the end, same result). This is the container's network policy, not Apple refusing. Every claim below is therefore "from search result, page not read" (WebSearch summaries of official Apple pages). Quotes are as the search tool relayed them, not verified against the page. Treat all as medium confidence at best until someone reads the pages.

Current iOS (search result, apple.com / support.apple.com/en-us/100100): iOS 27.2.1 published 2026-11-09; iOS 27 launched September 2026; iOS 27.3 in beta. Previous major: iOS 26. Apple's Shortcuts pages found are generic ("iPhone or iPad") and not stamped to a version; some are old (search tool said roughly 1,300 to 2,150 days for some). Which iOS versions each fact applies to is NOT confirmed.

## 1. Answers

**1. The action.** Apple spells it both "Run JavaScript on Webpage" (page titles) and "Run JavaScript on Web Page" (other titles); the intro page title reads "Run JavaScript on Web Page". In the editor, searching "Run JavaScript" finds it. Confidence medium.
- Input is a Safari web page from the share sheet; Apple says it "only works on an active Safari page" (search-tool paraphrase), so launch from the share sheet.
- Must call the completion handler: "To return data, you must call the completion handler in JavaScript, such as completion(result)."
- Time limit: "Like all JavaScript extensions in Safari ... subject to a time limit"; synchronous calls like window.alert() can cause timeouts.
- Trust warning: allowing it means the shortcut "can access all of the information on that webpage"; never run a shortcut with JavaScript you don't trust.
- Other browsers / in-app browsers / Safari View Controller: not confirmed (nothing in results).
- Sources: https://support.apple.com/guide/shortcuts/use-the-run-javascript-on-webpage-action-apdb71a01d93/ios ; https://support.apple.com/guide/shortcuts/intro-to-the-run-javascript-on-webpage-action-apd218e2187d/ios (both from search result, page not read).

**2. Enabling.** Settings > Shortcuts > Advanced > turn on "Allow Running Scripts" (iPhone/iPad). Mac: Shortcuts > Settings > Advanced tab. First-run prompt exists ("The first run shows a prompt") but exact wording and how to grant: not confirmed. Previous-iOS path difference: not confirmed. Confidence medium. Source: https://support.apple.com/guide/shortcuts/advanced-shortcuts-settings-apdfeb05586f/ios (search result, page not read).

**3. Making the shortcut.** Per search summary: add the action via search "Run JavaScript"; write script in its text field; call completion(); open Details, turn on "Show in Share Sheet"; "To ensure that the shortcut appears only in Safari, deselect all input types except 'Safari webpages.'"; run: in Safari tap the share button, then tap the shortcut. Where Shortcuts appear in the share sheet on iOS 26/27 and exact button names (new shortcut "+", rename): not confirmed. Confidence medium.

**4. Updating.** Not documented in what I could see. Inference only (unconfirmed): open the shortcut in the Shortcuts app, edit the action's text box, replace the script, tap Done.

**5. Sharing and files.** Apple documents: iCloud link ("Copy iCloud Link"; recipient sees description, taps "Get Shortcut"); file sharing with "Anyone" (Apple "will receive a copy of your shortcut for validation (to prevent unauthorized tampering)") or "People Who Know Me" (contact info included); the privacy setting is "Private Sharing" under Settings > Shortcuts, because shortcuts from others are "untrusted". The term "Allow Untrusted Shortcuts" was not found on any Apple page (it is the older name; unconfirmed here). Apple's security guide: downloaded shortcuts warn that they are not reviewed by Apple. Whether a script-built .shortcut file can be imported unsigned: not confirmed; signing appears required by Apple's validation. Conclusion: ship a recipe, not a file. Confidence medium. Sources: https://support.apple.com/guide/shortcuts/share-shortcuts-apdf01f8c054/ios ; https://support.apple.com/guide/shortcuts/adjust-privacy-settings-apd961a4fc65/ios ; https://support.apple.com/guide/security/secure-features-in-the-shortcuts-app-secec043bdae/web (all from search result, page not read).

**6. Privacy.** iCloud sync: signed in to Apple Account with iCloud Sync on in Shortcuts, the collection syncs across devices (personal automations excepted). So a script holding name, address, email and due date would sync to the person's other devices and iCloud. Whether an iCloud link's content is visible to anyone with the link: not confirmed, but the link opens a page with a description and "Get Shortcut", so assume yes. Apple wording to repeat: "that shortcut can access all of the information on that webpage". Source: https://support.apple.com/guide/shortcuts/sync-shortcuts-apdb3a4240b0/ios (search result, page not read). Confidence medium.

**7. Alternatives.** "Get Clipboard" exists (Apple: for apps that don't offer sharing; copy content then run shortcut). Whether its output can feed the JavaScript action as the script text: not documented in anything seen; not confirmed. Apple's action is documented with the script typed in its text field. URL scheme documented: shortcuts://run-shortcut?name=[name]&input=[input]&text=[text]; example shortcuts://run-shortcut?name=Lookup%20Goetta&input=text&text=goetta%20is%20great; input=clipboard sends clipboard text (text param ignored). But the JS action needs a Safari page as input, so a URL scheme call from a web page would not supply that. Not confirmed as a path. Sources: https://support.apple.com/guide/shortcuts/run-a-shortcut-from-a-url-apd624386f42/ios ; https://support.apple.com/guide/shortcuts/about-actions-in-complicated-shortcuts-apd081d9d61f/ios (search result, page not read).

**8. Limits.** Apple pages found say nothing about unsupported pages. Content Security Policy effect: not confirmed (not checked at webkit.org or developer.apple.com; proxy blocked Apple support only, but no search result addressed it).

## 2. Steps for the app (draft, medium confidence, to be checked on a real iPhone running iOS 27)
1. Open Settings > Shortcuts > Advanced and turn on Allow Running Scripts.
2. Open the Shortcuts app, tap + to make a new shortcut.
3. Search "Run JavaScript", add Run JavaScript on Web Page.
4. Replace the text in the action with the script from this app (Copy button), keeping the completion() line.
5. Open the shortcut's Details (info button), turn on Show in Share Sheet.
6. In Share Sheet Input types, deselect everything except Safari web pages.
7. Name it (for example "Baby form fill") and tap Done.
8. In Safari, open the official sign-up page, tap Share, tap the shortcut. Allow the permission prompt if iOS asks.
9. Check the filled fields yourself, then submit the form yourself.

## 3. Limits and risks
- The script contains your personal details and is stored in the shortcut; it syncs through iCloud if Shortcuts sync is on. Do not share or export the shortcut.
- Apple warns the shortcut can read everything on the page, including sensitive data. Only run it on the official sign-up page.
- Works only from Safari's share sheet (other browsers and in-app browsers: not confirmed, assume not).
- Scripts have a time limit; the script must not use alert() and must call completion().
- We cannot ship a ready-made shortcut file; the person must build it by hand.
- Some pages may block or ignore it (CSP behaviour not confirmed).

## 4. Not confirmed
- Exact current menu wording in iOS 27 / 26 (button names, share sheet location).
- First-run permission prompt wording.
- Whether Get Clipboard can supply the script at run time.
- Safari View Controller and non-Safari behaviour; CSP effect.
- Whether unsigned/script-built .shortcut files import on current iOS.
- Whether iCloud link content is public to anyone with the link.
- How to edit the pasted script later (inferred only).
- All of the above sources should be read directly once support.apple.com is reachable.
