/* BFF.phoneView: the "Fill forms on your phone" card in My info.
   The fill script is generated at tap time from the current My info and is never stored. */
(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});

  /* STEPS: ALL user-facing wording for this card lives in this one constant. Edit here only.
     Source: Apple, WebKit and MDN help pages as seen in search results (November 2026); the pages
     themselves could not be opened, so nothing is promised as guaranteed. Menu names may differ by iOS version. */
  var STEPS = {
    title: 'Fill forms on your phone',
    intro: 'Sign-up pages ask for the same details again and again. These ways put your details from My info into a form for you. They only fill empty boxes. You check everything and press the final button yourself.',
    menuNote: 'Menu names are from Apple’s help pages for iOS 26 and 27 (November 2026). Other versions may differ slightly.',
    options: [
      {
        id: 'autofill',
        title: 'Safari AutoFill',
        tag: 'No script at all',
        lead: '',
        steps: [
          'Open Settings, then Apps, then Safari, then AutoFill. (On iOS 17 and earlier: Settings, then Safari, then AutoFill.)',
          'Turn on Use Contact Info.',
          'Tap My Info and choose your own contact card. Check in Contacts that the card has your name, address, phone and email.',
          'On a sign-up page, tap an empty field, then tap AutoFill Contact above the keyboard. Check every field before you submit.'
        ],
        note: ''
      },
      {
        id: 'shortcut',
        title: 'Fill with a Shortcut',
        tag: 'Recommended',
        lead: 'Fills the page you are looking at from Safari’s Share menu. Tap “Copy fill script” below first.',
        steps: [
          'In Settings, open Shortcuts (on recent iOS it is under Apps), tap Advanced and turn on Allow Running Scripts.',
          'Open the Shortcuts app and tap + to start a new shortcut.',
          'Search the actions for “Run JavaScript” and add Run JavaScript on Web Page.',
          'Tap the script box in that action, clear what is there and paste the script you copied from this page.',
          'Open the shortcut’s details (the info button) and turn on Show in Share Sheet. Then set what it accepts to Safari web pages only (untick the other types).',
          'Name it, for example “Baby form fill”, and tap Done.',
          'In Safari, open the official sign-up page, tap Share, then tap “Baby form fill”. The first time, iPhone asks whether the shortcut may use that website: allow it for the official site only.',
          'Check every field, fill in anything it skipped, and press the site’s own submit button yourself.'
        ],
        note: 'Changed your details in My info? Copy the script again and paste it over the old one in the shortcut.'
      },
      {
        id: 'bookmarklet',
        title: 'Or use a bookmark',
        tag: 'Apple does not document this; test it once',
        lead: 'Tap “Copy bookmarklet” below first.',
        steps: [
          'In Safari, open any page, tap Share, then Add Bookmark. Name it “Baby fill” and save it.',
          'Open Bookmarks, tap Edit, then tap “Baby fill”.',
          'Delete the address and paste the code you copied from this page. It starts with javascript:.',
          'Tap Done. On a sign-up page, open Bookmarks and tap “Baby fill”.',
          'If nothing happens, that site blocks bookmark scripts. Use the Shortcut or AutoFill instead.'
        ],
        note: ''
      }
    ],
    homeScreen: {
      title: 'Add this app to the Home Screen',
      steps: [
        'Open this page in Safari.',
        'Tap Share, then Add to Home Screen. If you do not see it, scroll to the end of the list and tap Edit Actions to add it.',
        'Leave Open as Web App on and tap Add.',
        'The Home Screen app keeps its own copy of your data, separate from Safari. If you already saved details in Safari, save a backup there first (Tracker, Backup) and load it in the Home Screen app.'
      ]
    },
    warnTitle: 'Keep it private. ',
    warnings: [
      'The script contains the details you saved in My info. Keep the shortcut to yourself: do not share or export it. If Shortcuts sync is on in iCloud, it also appears on your other Apple devices.',
      'Apple’s own warning: a shortcut that runs JavaScript on a page can read everything on that page. Run it only on the official sign-up page. The script checks the site address and does nothing on other sites.',
      'It works from Safari’s Share menu only, not inside other apps’ built-in browsers.',
      'It only fills fields. It never presses submit, never ticks consent boxes for you and never touches password, payment or ID fields. It has nothing to do with “I am not a robot” checks.',
      'Safari can clear a website’s saved data after about a week without a visit. Save a backup from the Tracker now and then.',
      'Some sites will not let scripts run. If nothing fills, use AutoFill or type.',
      'After you change My info, make a new script and replace the old one.'
    ],
    does: [
      'Fills your name, email, phone, address, city, state, ZIP and due date into boxes that are empty and match.',
      'Uses the tagged plus address for that program when you turned plus addresses on in My info.',
      'Shows a short message at the top of the page saying how many boxes it filled. Tap Close to dismiss it.'
    ],
    doesNot: [
      'Never presses Submit or any other button, and never ticks a box.',
      'Never overwrites what you already typed.',
      'Does nothing on a site that is not an official sign-up site from this app’s list. It tells you so and stops.',
      'Sends nothing anywhere. It runs only in the page you run it on.'
    ]
  };

  var FILE_NAME = 'baby-freebies-fill.txt';
  var KEY = 'profile.v1';
  var mounted = [];
  var listening = false;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function list(tag, items) {
    return h(tag, { class: 'ph-list' }, items.map(function (t) { return h('li', { text: t }); }));
  }

  function readProfile() {
    var p = BFF.store && BFF.store.get ? BFF.store.get(KEY, {}) : {};
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  }
  function hasDetails(p) {
    return ['firstName', 'lastName', 'email', 'phone', 'address1', 'city', 'state', 'zip', 'dueDate'].some(function (k) {
      return typeof p[k] === 'string' && p[k].trim() !== '';
    });
  }
  function buildScript() {
    var p = readProfile();
    var map = p.usePlusTags && BFF.plusTags && BFF.plusTags.map ? BFF.plusTags.map() : {};
    return BFF.fill.build({ profile: p, programs: BFF.programs || [], tagMap: map });
  }

  function fallbackCopy(text) {
    return new Promise(function (resolve) {
      var done = false;
      function legacy() {
        var ok = false, ta = null;
        try {
          ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, text.length);
          ok = !!document.execCommand('copy');
        } catch (e) { ok = false; }
        if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
        return ok;
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { if (!done) { done = true; resolve(true); } },
            function () { if (!done) { done = true; resolve(legacy()); } });
          return;
        }
      } catch (e) {}
      resolve(legacy());
    });
  }
  function copyText(text) {
    if (BFF.host && typeof BFF.host.copyText === 'function') {
      try { return Promise.resolve(BFF.host.copyText(text)).catch(function () { return false; }); } catch (e) { return Promise.resolve(false); }
    }
    return fallbackCopy(text);
  }

  function render(el) {
    el.textContent = '';
    var p = readProfile();
    var ready = hasDetails(p) && !!(BFF.fill && BFF.fill.build);

    var status = h('p', { class: 'ph-status', role: 'status', 'aria-live': 'polite' });
    var shown = h('div', { class: 'ph-shown' });

    function say(text) { status.textContent = text; }
    function clearShown() { shown.textContent = ''; }
    function showText(text, label) {
      clearShown();
      var id = 'ph-text-' + Math.floor(Math.random() * 1e9);
      var ta = h('textarea', { id: id, class: 'fx-textarea ph-text', readonly: '', rows: '6', 'aria-label': label, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' });
      ta.value = text;
      var copy = h('button', { type: 'button', class: 'fx-btn', text: 'Copy' });
      copy.addEventListener('click', function () {
        ta.focus(); ta.select();
        try { ta.setSelectionRange(0, text.length); } catch (e) {}
        fallbackCopy(text).then(function (ok) { say(ok ? 'Copied.' : 'Could not copy by itself. The text is selected: use your device’s Copy command.'); });
      });
      shown.appendChild(h('p', { class: 'fx-muted', text: 'Select all of this text and copy it. It contains your details, so keep it private.' }));
      shown.appendChild(ta);
      shown.appendChild(h('div', { class: 'fx-actions' }, [copy]));
      ta.focus(); ta.select();
    }

    function guarded(fn) {
      return function () {
        clearShown();
        say('');
        var script;
        try { script = buildScript(); } catch (e) { say('Could not make the fill script. Check My info above and try again.'); return; }
        fn(script);
      };
    }
    function doCopy(text, what) {
      copyText(text).then(function (ok) {
        if (ok) say('Copied the ' + what + '. Paste it where the steps above say, and keep it private.');
        else { say('Your browser would not copy automatically. Copy the text below instead.'); showText(text, 'The ' + what); }
      });
    }

    var bScript = h('button', { type: 'button', class: 'fx-btn fx-btn--primary', text: 'Copy fill script' });
    var bMark = h('button', { type: 'button', class: 'fx-btn', text: 'Copy bookmarklet' });
    var bFile = h('button', { type: 'button', class: 'fx-btn', text: 'Save fill script as a file' });
    [bScript, bMark, bFile].forEach(function (b) { if (!ready) b.disabled = true; });

    bScript.addEventListener('click', guarded(function (s) { doCopy(s, 'fill script'); }));
    bMark.addEventListener('click', guarded(function (s) { doCopy(BFF.fill.bookmarklet(s), 'bookmarklet'); }));
    bFile.addEventListener('click', guarded(function (s) {
      if (BFF.host && typeof BFF.host.saveFile === 'function') {
        var r;
        try { r = Promise.resolve(BFF.host.saveFile({ name: FILE_NAME, text: s, mime: 'text/plain' })); } catch (e) { r = Promise.resolve({ status: 'failed' }); }
        r.then(function (res) {
          var st = res && res.status;
          if (st === 'saved') say('Saved ' + FILE_NAME + '. It contains your details, so keep it private.');
          else if (st === 'declined') say('Save cancelled. Nothing was saved.');
          else { say('The file could not be saved here. Copy the text below instead.'); showText(s, 'The fill script'); }
        }, function () { say('The file could not be saved here. Copy the text below instead.'); showText(s, 'The fill script'); });
      } else {
        say('This page cannot save files here. Copy the text below instead.');
        showText(s, 'The fill script');
      }
    }));

    var kids = [
      h('h3', { id: 'info-phone-h', text: STEPS.title }),
      h('p', { text: STEPS.intro })
    ];
    STEPS.options.forEach(function (o) {
      kids.push(h('section', { class: 'ph-opt', 'aria-labelledby': 'ph-' + o.id }, [
        h('h4', { id: 'ph-' + o.id, text: o.title }),
        o.tag ? h('p', { class: 'ph-tag', text: o.tag }) : null,
        o.lead ? h('p', { text: o.lead }) : null,
        list('ol', o.steps),
        o.note ? h('p', { class: 'fx-muted', text: o.note }) : null
      ]));
    });
    kids.push(h('p', { class: 'fx-muted', text: STEPS.menuNote }));
    if (!(BFF.host && BFF.host.inArtifact)) {
      kids.push(h('section', { class: 'ph-opt', 'aria-labelledby': 'ph-home' }, [
        h('h4', { id: 'ph-home', text: STEPS.homeScreen.title }),
        list('ol', STEPS.homeScreen.steps)
      ]));
    }
    kids.push(h('div', { class: 'fx-warn ph-warn', role: 'note' }, [h('strong', { text: STEPS.warnTitle }), list('ul', STEPS.warnings)]));
    if (!ready) {
      kids.push(h('p', { class: 'ph-empty', text: 'Fill in My info above first (at least your name, email and address). The buttons turn on once there is something to fill.' }));
    }
    kids.push(h('div', { class: 'fx-actions ph-actions' }, [bScript, bMark, bFile]));
    kids.push(status);
    kids.push(shown);
    kids.push(h('h4', { text: 'What the script does' }));
    kids.push(list('ul', STEPS.does));
    kids.push(h('h4', { text: 'What it will not do' }));
    kids.push(list('ul', STEPS.doesNot));
    kids.push(h('p', { class: 'fx-muted', text: 'The script is made from your current My info each time you tap a button. It is not stored anywhere in this app.' }));

    el.appendChild(h('section', { class: 'fx-card ph-card', 'aria-labelledby': 'info-phone-h' }, kids));
  }

  function mount(el) {
    if (!el || !el.appendChild) return;
    if (mounted.indexOf(el) < 0) mounted.push(el);
    if (!listening) {
      listening = true;
      document.addEventListener('bff:profile-changed', function () {
        mounted = mounted.filter(function (n) { return n.isConnected !== false; });
        mounted.forEach(render);
      });
    }
    render(el);
  }

  BFF.phoneView = { mount: mount, STEPS: STEPS, FILE_NAME: FILE_NAME };

  window.addEventListener('hashchange', function () { mounted.forEach(render); });

  var pre = document.getElementById('info-fill');
  if (pre && mounted.indexOf(pre) < 0 && !pre.firstChild) mount(pre);
})();
