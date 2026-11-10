// BFF.inboxView: the "Gmail connection" card. The only optional connection in the app: the person's own Gmail,
// reached through the Claude artifact runtime's mcp capability, only after a tap. Nothing from the mailbox is stored
// (only prefs.v1.inboxCheckedAt) and everything from the mailbox is shown with textContent.
(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  var PAGE_SIZE = 50, MAX_PAGES = 3, MAX_THREADS = 600, MAX_WAIT = 5000, DAYS = 120, MAX_PER_PROGRAM = 3;
  var LABEL_NAME = 'Baby Freebies';
  var uid = 0;

  function I() { return BFF.inbox; }
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
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function labelOf(st) { return (BFF.tracker && BFF.tracker.LABELS && BFF.tracker.LABELS[st]) || st; }

  // ---- reading the app's own state ----
  function profile() {
    var p = BFF.store.get('profile.v1', {});
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  }
  function plusNow(pr) {
    var E = BFF.email;
    return !!pr.usePlusTags && E.supportsPlus(pr.email) !== false && !!E.plusAddress(pr.email, 'x');
  }
  function tagMapNow() { return BFF.plusTags ? BFF.plusTags.map() : BFF.email.tagMap(BFF.programs || []); }
  function programById(id) {
    var l = BFF.programs || [];
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function activePrograms() { return (BFF.programs || []).filter(function (p) { return BFF.tracker.getStatus(p.id) !== 'skipped'; }); }
  function checklistPrograms() {
    var started = (BFF.programs || []).filter(function (p) { var s = BFF.tracker.getStatus(p.id); return s === 'signed-up' || s === 'received'; });
    return started.length ? started : activePrograms();
  }
  function localDate(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    try { return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return localDate(iso); }
  }
  function payloadOf(res) {
    var p = res && typeof res === 'object' ? (res.payload !== undefined ? res.payload : res.structuredContent) : undefined;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { p = {}; } }
    return p && typeof p === 'object' ? p : {};
  }
  function getMcp() {
    try {
      var p = BFF.host && typeof BFF.host.use === 'function' ? BFF.host.use('mcp')
        : window.claude && typeof window.claude.use === 'function' ? window.claude.use('mcp') : null;
      return Promise.resolve(p).then(function (ns) { return ns && typeof ns.callTool === 'function' ? ns : null; }, function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function create(el) {
    var id = ++uid, E = BFF.email;
    var mcp = null, state = 'pending'; // pending | none | ready
    var tools = null, toolsChecked = false;
    var off = { check: false, label: false, draft: false };
    var dead = false, noRetry = false, busy = false, needConnect = false;
    var matches = null, account = '', checkedPrompted = false;

    // ---- skeleton, built once ----
    var intro = h('p', { class: 'fx-muted ib-intro' });
    var steps = h('div', { class: 'ib-steps', hidden: '' }, [
      h('p', { class: 'fx-small ib-tight', text: 'To connect Gmail:' }),
      h('ol', { class: 'fx-small' }, [
        h('li', { text: 'In claude.ai, open Customize, then Connectors.' }),
        h('li', { text: 'Find Gmail and select Connect.' }),
        h('li', { text: 'Sign in to Google and allow the permissions. The button then reads Disconnect.' }),
        h('li', { text: 'To reconnect, select Disconnect, then connect again. On a work or school account, an admin may have to allow it first.' })
      ]),
      h('p', { class: 'fx-small', text: 'This needs the page opened in Claude (claude.ai or the Claude desktop app). In the Claude iPhone app it may not be offered yet. The Gmail search links in the Email and calendar card work everywhere.' })
    ]);
    var unavailable = h('ul', { class: 'ib-unavail fx-small', hidden: '' });
    var btnCheck = h('button', { type: 'button', class: 'fx-btn fx-btn--primary ib-btn', text: 'Check my Gmail' });
    var btnLabel = h('button', { type: 'button', class: 'fx-btn ib-btn', hidden: '', text: 'Label these in Gmail' });
    var btnList = h('button', { type: 'button', class: 'fx-btn ib-btn', text: 'Draft my checklist' });
    var btnKit = h('button', { type: 'button', class: 'fx-btn ib-btn', text: 'Draft my setup kit' });
    var btnAddr = h('button', { type: 'button', class: 'fx-btn ib-btn', hidden: '' });
    var btnClear = h('button', { type: 'button', class: 'fx-btn fx-btn--link ib-btn', hidden: '', text: 'Clear results from this page' });
    var actions = h('div', { class: 'fx-actions ib-actions', hidden: '' }, [btnCheck, btnLabel, btnList, btnKit, btnAddr, btnClear]);
    var needEmail = h('p', { class: 'fx-warn', hidden: '' }, [
      document.createTextNode('A draft goes to your own address, so add your email in '), h('a', { href: '#info', text: 'My info' }), document.createTextNode(' first.')
    ]);
    var live = h('p', { class: 'ib-live fx-msg', role: 'status', 'aria-live': 'polite' });
    var err = h('p', { class: 'ib-error fx-warn', role: 'alert', hidden: '' });
    var done = h('p', { class: 'ib-done fx-msg', role: 'status', 'aria-live': 'polite' });
    var changed = h('p', { class: 'ib-changed fx-msg', role: 'status', 'aria-live': 'polite', tabindex: '-1' });
    var resultsEl = h('div', { class: 'ib-results' });
    var sugEl = h('div', { class: 'ib-suggest' });
    var hid = 'ib-h-' + id;
    var card = h('section', { class: 'fx-card ib-card', 'data-ib-card': '', 'aria-labelledby': hid }, [
      h('h3', { id: hid, text: 'Gmail connection' }),
      intro,
      h('details', { class: 'fx-about' }, [
        h('summary', { text: 'What this can and cannot do' }),
        h('ul', {}, [
          h('li', { text: 'It looks through your Gmail for confirmation and shipping emails from the programs on your list.' }),
          h('li', { text: 'Where your Claude allows it, it can add one label, “' + LABEL_NAME + '”, to the conversations it found.' }),
          h('li', { text: 'Where your Claude allows it, it can save drafts addressed to your own email.' }),
          h('li', { text: 'This page never sends, deletes or archives mail.' }),
          h('li', { text: 'Nothing from your mailbox is saved by this app. Results disappear when you leave this page.' })
        ])
      ]),
      steps, unavailable, actions, needEmail, live, err, done, changed, resultsEl, sugEl
    ]);
    el.appendChild(card);

    function say(t) { live.textContent = t || ''; }
    function say2(t) { done.textContent = ''; if (t) done.textContent = t; }
    function showErr(t) { err.textContent = t || ''; err.hidden = !t; }

    // ---- state -> screen ----
    function render() {
      var hasEmail = !!I().validAddress(profile().email);
      var ready = state === 'ready' && !dead && !noRetry;
      intro.textContent =
        state === 'pending' ? 'Checking whether Gmail can connect here…' :
        state === 'none' ? 'Gmail is not connected to this page. Checking your mail for sign-up and shipping emails works once the app is opened in Claude with Gmail connected. Until then, use the Search my Gmail links on each program below: they open your own Gmail in a new tab.' :
        noRetry ? I().errorCopy('not_granted') :
        dead ? I().errorCopy('capability_disabled') :
        'Optional. Check my Gmail looks for sign-up and shipping emails from your programs, and you decide which tracker updates to apply. Labels and drafts are optional extras. Claude asks for your permission the first time.';
      steps.hidden = !(state === 'none' || needConnect || noRetry);
      actions.hidden = !ready;
      btnCheck.hidden = off.check;
      btnLabel.hidden = off.label || !matches || !matches.length;
      btnList.hidden = off.draft;
      btnKit.hidden = off.draft;
      btnClear.hidden = !(matches && (matches.length || checkedPrompted));
      var notes = [];
      if (ready && off.check) notes.push('Searching is not available in this Gmail connection.');
      if (ready && (off.label || off.draft)) notes.push('This Gmail connection does not offer labels or drafts to this page, so those buttons are hidden. Checking your mail still works.');
      unavailable.textContent = '';
      notes.forEach(function (t) { unavailable.appendChild(h('li', { text: t })); });
      unavailable.hidden = !notes.length;
      var showAddr = ready && !hasEmail && !!account && !off.check;
      btnAddr.hidden = !showAddr;
      if (showAddr) btnAddr.textContent = 'Use ' + account + ' as my email';
      if (hasEmail) needEmail.hidden = true;
    }
    function setBusy(b) {
      busy = b;
      card.setAttribute('aria-busy', b ? 'true' : 'false');
      Array.prototype.forEach.call(card.querySelectorAll('button.ib-btn'), function (x) { x.disabled = b; });
    }
    function clearData() {
      matches = null; account = ''; checkedPrompted = false;
      resultsEl.textContent = ''; sugEl.textContent = ''; changed.textContent = ''; done.textContent = ''; live.textContent = '';
      if (BFF.ui && BFF.ui.closeConfirm) BFF.ui.closeConfirm();
    }

    // ---- connector calls ----
    async function afterSuccess() {
      if (toolsChecked) return;
      toolsChecked = true;
      try {
        var r = await mcp.listTools(I().SERVER);
        var srv = null;
        ((r && r.servers) || []).forEach(function (s) { if (s && s.server === I().SERVER) srv = s; });
        if (srv && Array.isArray(srv.tools) && srv.tools.length) {
          tools = {};
          srv.tools.forEach(function (t) { if (t && typeof t.name === 'string') tools[t.name] = true; });
          var F = I().FEATURE_TOOLS;
          Object.keys(F).forEach(function (f) { off[f] = F[f].some(function (t) { return !tools[t]; }); });
        }
      } catch (e) { /* listing is only a hint; real calls still report their own errors */ }
      render();
    }
    // Reads may retry once, and only when the runtime says retryable. Writes never retry.
    async function call(tool, input, isRead) {
      var res;
      for (var attempt = 0; ; attempt++) {
        try { res = await mcp.callTool(I().SERVER, tool, input); break; }
        catch (e) {
          if (isRead && attempt === 0 && e && typeof e === 'object' && e.retryable === true) {
            var ms = typeof e.retryAfterMs === 'number' && e.retryAfterMs > 0 ? e.retryAfterMs : 1000;
            await wait(Math.min(MAX_WAIT, ms + Math.floor(Math.random() * 250)));
            continue;
          }
          throw e;
        }
      }
      await afterSuccess();
      return payloadOf(res);
    }
    function codeOf(e) { return e && typeof e === 'object' && typeof e.code === 'string' ? e.code : ''; }
    function fail(e, feature) {
      var code = codeOf(e), g = I().errorGroup(code);
      showErr(I().errorCopy(code));
      say('');
      // Only a refusal that will not change on its own switches the card off. A declined prompt may be answered differently on the next tap.
      if (code === 'not_granted' || code === 'not_in_manifest') noRetry = true;
      if (g === 'connect') needConnect = true;
      if (I().clearsData(code)) clearData();
      if (g === 'unavailable') { if (code === 'blocked_by_policy') off[feature] = true; else dead = true; }
      render();
    }
    async function run(btn, feature, fn) {
      if (busy) return;
      showErr(''); changed.textContent = ''; done.textContent = '';
      setBusy(true);
      try { await fn(); } catch (e) { fail(e, feature); }
      setBusy(false);
      if (btn && btn.isConnected && !btn.hidden && !btn.disabled) btn.focus();
    }

    // ---- check ----
    async function doCheck() {
      var pr = profile(), email = I().validAddress(pr.email), progs = activePrograms();
      var plus = plusNow(pr), tags = plus ? tagMapNow() : null;
      var qs = I().buildQueries({ programs: progs, email: email, tagMap: tags || {}, usePlus: plus, days: DAYS });
      clearData();
      if (!qs.length) { say('Nothing to search for. Turn on plus addresses in My info, or add programs that email from their own site.'); return; }
      var threads = [], seen = {};
      for (var q = 0; q < qs.length; q++) {
        var token = '';
        for (var page = 0; page < MAX_PAGES; page++) {
          say('Searching ' + (q + 1) + ' of ' + qs.length + (page ? ', page ' + (page + 1) : '') + '…');
          var input = { query: qs[q].query, pageSize: PAGE_SIZE, view: 'THREAD_VIEW_SUMMARY' };
          if (token) input.pageToken = token;
          var p = await call('search_threads', input, true);
          (Array.isArray(p.threads) ? p.threads : []).forEach(function (t) {
            if (t && typeof t === 'object' && typeof t.id === 'string' && !seen[t.id] && threads.length < MAX_THREADS) { seen[t.id] = true; threads.push(t); }
          });
          token = typeof p.nextPageToken === 'string' && p.nextPageToken.length <= 500 ? p.nextPageToken : '';
          if (!token) break;
        }
      }
      for (var i = 0; i < threads.length && !account; i++) account = I().accountFromViewUrl(threads[i].viewUrl);
      matches = I().matchThreads(threads, { programs: progs, email: email, tagMap: tags });
      threads = null;
      checkedPrompted = true;
      var prefs = BFF.store.get('prefs.v1', {});
      if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {};
      prefs.inboxCheckedAt = new Date().toISOString();
      BFF.store.set('prefs.v1', prefs);
      var nProg = {};
      matches.forEach(function (m) { nProg[m.programId] = 1; });
      var skipped = I().unsearchable({ programs: progs, email: email, tagMap: tags || {}, usePlus: plus }).length;
      say(matches.length
        ? 'Found ' + plural(matches.length, 'conversation') + ' from ' + plural(Object.keys(nProg).length, 'program') + ' in the last ' + DAYS + ' days.'
        : 'No matching conversations in the last ' + DAYS + ' days.' + ' Checked ' + plural(qs.length, 'search') + '.');
      if (skipped) live.textContent += ' ' + plural(skipped, 'program') + ' could not be searched: turn on plus addresses in My info to include them.';
      renderResults();
      renderSuggestions();
      render();
    }

    function badge(text, cls) { return h('span', { class: 'ib-badge' + (cls ? ' ib-badge--' + cls : ''), text: text }); }
    function renderResults() {
      resultsEl.textContent = '';
      if (!matches || !matches.length) return;
      var groups = {}, order = [];
      matches.forEach(function (m) {
        if (!groups[m.programId]) { groups[m.programId] = []; order.push(m.programId); }
        groups[m.programId].push(m);
      });
      var holder = h('div', { class: 'ib-groups' });
      order.forEach(function (pid) {
        var p = programById(pid), list = groups[pid];
        var ul = h('ul', { class: 'ib-list' });
        list.slice(0, MAX_PER_PROGRAM).forEach(function (m) {
          var meta = [m.from, fmtDate(m.date)].filter(Boolean).join(' · ');
          var badges = h('div', { class: 'ib-badges' });
          if (m.kind === 'confirm') badges.appendChild(badge('Needs you to confirm', 'warn'));
          else if (m.kind === 'shipped') badges.appendChild(badge('Shipping', 'ok'));
          else if (m.kind === 'welcome') badges.appendChild(badge('Welcome', 'ok'));
          badges.appendChild(badge(m.certainty === 'exact' ? 'Addressed to your program address' : 'Likely: from the program\u2019s own site', ''));
          var li = h('li', { class: 'ib-item' }, [
            h('strong', { class: 'ib-subject', text: m.subject || '(no subject)' }),
            h('span', { class: 'fx-small ib-meta', text: meta }),
            badges
          ]);
          if (m.viewUrl) {
            var a = h('a', { class: 'fx-link-btn fx-link-btn--ghost ib-open', href: m.viewUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Open in Gmail ↗' });
            a.setAttribute('aria-label', 'Open “' + (m.subject || 'no subject') + '” in Gmail (opens in a new tab)');
            li.appendChild(a);
          }
          ul.appendChild(li);
        });
        var gid = 'ib-g-' + id + '-' + pid.replace(/[^a-z0-9-]/gi, '');
        var g = h('section', { class: 'ib-group', 'aria-labelledby': gid }, [
          h('h4', { id: gid, class: 'ib-group-h', text: p ? p.name : pid }),
          p ? h('p', { class: 'fx-small ib-tight', text: 'Tracker status: ' + labelOf(BFF.tracker.getStatus(pid)) }) : null,
          ul,
          list.length > MAX_PER_PROGRAM ? h('p', { class: 'fx-small', text: '…and ' + (list.length - MAX_PER_PROGRAM) + ' more.' }) : null
        ]);
        holder.appendChild(g);
      });
      resultsEl.appendChild(h('h4', { text: 'What I found' }));
      resultsEl.appendChild(holder);
    }

    // ---- suggestions: statuses change only on a tap ----
    function currentSuggestions() {
      if (!matches) return [];
      return I().suggest(matches, function (pid) { return BFF.tracker.getStatus(pid); }).filter(function (s) {
        return !(s.noteOnly && BFF.tracker.getNote(s.programId).indexOf(s.note) >= 0);
      });
    }
    function describe(s) {
      var p = programById(s.programId), name = p ? p.name : s.programId;
      return { name: name, label: s.noteOnly ? 'Add note to ' + name + ': ' + s.note : 'Mark ' + name + ' as ' + labelOf(s.to) };
    }
    function applyOne(s) {
      var tr = BFF.tracker, pid = s.programId, d = describe(s), ok;
      if (tr.getStatus(pid) !== s.from) return { text: d.name + ' changed in the meantime, so it was left as it is.', ok: true, applied: false };
      if (s.noteOnly) {
        var n = tr.getNote(pid);
        ok = tr.setNote(pid, n ? n + '\n' + s.note : s.note);
      } else ok = tr.setStatus(pid, s.to);
      return { text: s.noteOnly ? 'Added a note to ' + d.name + ': ' + s.note + '.' : d.name + ' is now ' + labelOf(s.to) + '.', ok: ok, applied: true };
    }
    var SAVE_FAIL = ' It could not be saved on this device, so it lasts only until you close this page.';
    function renderSuggestions() {
      sugEl.textContent = '';
      var list = currentSuggestions();
      if (!list.length) return;
      var ul = h('ul', { class: 'ib-sugs' });
      list.forEach(function (s) {
        var d = describe(s);
        var b = h('button', { type: 'button', class: 'fx-btn ib-btn ib-sug-btn', text: d.label + (s.certainty === 'likely' ? ' (likely)' : '') });
        if (busy) b.disabled = true;
        b.addEventListener('click', function () {
          if (busy) return;
          var r = applyOne(s);
          changed.textContent = r.text + (r.ok ? '' : SAVE_FAIL);
          renderSuggestions();
          var next = sugEl.querySelector('button:not([disabled])');
          (next || btnCheck).focus();
        });
        ul.appendChild(h('li', { class: 'ib-sug' }, [h('span', { class: 'fx-small ib-sug-why', text: s.subject || d.name }), b]));
      });
      sugEl.appendChild(h('h4', { text: 'Suggested updates' }));
      sugEl.appendChild(h('p', { class: 'fx-small', text: 'Nothing changes until you tap a button.' }));
      sugEl.appendChild(ul);
      if (list.length > 1) {
        var all = h('button', { type: 'button', class: 'fx-btn fx-btn--primary ib-btn', text: 'Apply all ' + list.length });
        if (busy) all.disabled = true;
        all.addEventListener('click', function () {
          if (busy) return;
          var names = [], saved = true, n = 0;
          list.forEach(function (s) {
            var r = applyOne(s);
            if (r.applied) { n++; names.push(describe(s).name); if (!r.ok) saved = false; }
          });
          changed.textContent = n ? 'Updated ' + plural(n, 'program') + ': ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' and ' + (names.length - 6) + ' more' : '') + '.' + (saved ? '' : SAVE_FAIL) : 'Nothing needed changing.';
          renderSuggestions();
          btnCheck.focus();
        });
        sugEl.appendChild(h('div', { class: 'fx-actions' }, [all]));
      }
    }

    // ---- label ----
    function threadIdsToLabel() {
      var seen = {}, out = [];
      (matches || []).forEach(function (m) { if (I().isId(m.threadId) && !seen[m.threadId]) { seen[m.threadId] = 1; out.push(m.threadId); } });
      return out;
    }
    function labelIdOf(p) {
      if (!p || typeof p !== 'object') return '';
      var v = p.labelId || p.id || (p.label && (p.label.labelId || p.label.id));
      return I().isId(v) ? v : '';
    }
    function findLabel(p) {
      var found = '';
      (Array.isArray(p.labels) ? p.labels : []).forEach(function (l) {
        if (l && typeof l.name === 'string' && l.name.trim().toLowerCase() === LABEL_NAME.toLowerCase() && !found) found = labelIdOf(l);
      });
      return found;
    }
    async function doLabel() {
      var ids = threadIdsToLabel();
      if (!ids.length) { say('There is nothing to label.'); return; }
      say('Looking for the “' + LABEL_NAME + '” label…');
      var labelId = findLabel(await call('list_labels', {}, true));
      if (!labelId) {
        say('Creating the “' + LABEL_NAME + '” label…');
        labelId = labelIdOf(await call('create_label', { displayName: LABEL_NAME }, false));
        if (!labelId) labelId = findLabel(await call('list_labels', {}, true)); // a read, so it may retry
      }
      if (!labelId) { showErr('Gmail made the label but did not say which one it is, so nothing was labelled. Try again in a moment.'); say(''); return; }
      var ok = 0, bad = 0, firstBad = null;
      for (var i = 0; i < ids.length; i++) {
        say('Labelling ' + (i + 1) + ' of ' + ids.length + '…');
        try { await call('label_thread', { threadId: ids[i], labelIds: [labelId] }, false); ok++; }
        catch (e) {
          bad++; if (!firstBad) firstBad = e;
          // Stop at once when the page is not allowed to write or Gmail is busy; keep going only on a one-off failure of one thread.
          // fail() clears the screen for refusals, so the count is shown again after it.
          if (I().errorGroup(codeOf(e)) !== 'failed') { fail(e, 'label'); if (ok) done.textContent = 'Labelled ' + ok + ' of ' + plural(ids.length, 'conversation') + ' before it stopped.'; return; }
        }
      }
      say('');
      done.textContent = 'Labelled ' + ok + ' of ' + plural(ids.length, 'conversation') + ' with “' + LABEL_NAME + '”.' + (bad ? ' ' + plural(bad, 'conversation') + ' could not be labelled.' : '');
      if (firstBad) showErr(I().errorCopy(codeOf(firstBad)));
    }

    // ---- drafts ----
    function draftDone(p) {
      done.textContent = '';
      done.appendChild(document.createTextNode('Draft saved in your Gmail.'));
      var url = I().safeViewUrl(p && p.viewUrl);
      if (url) {
        done.appendChild(document.createTextNode(' '));
        done.appendChild(h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: 'Open the draft in Gmail ↗' }));
      }
    }
    function noEmail() { needEmail.hidden = false; say('Add your email in My info first.'); }
    async function doDraftList() {
      var email = I().validAddress(profile().email);
      if (!email) return noEmail();
      needEmail.hidden = true;
      var d = I().checklistDraft({ email: email, programs: checklistPrograms(), statusOf: function (p) { return labelOf(BFF.tracker.getStatus(p.id)); } });
      say('Saving a draft in your Gmail…');
      var p = await call('create_draft', d, false);
      say('');
      draftDone(p);
    }
    async function doDraftKit() {
      var pr = profile(), email = I().validAddress(pr.email);
      if (!email) return noEmail();
      needEmail.hidden = true;
      var plus = plusNow(pr), files = [];
      var xml = E.gmailFiltersXml(activePrograms(), { email: email, usePlus: plus, archive: false, tagMap: plus ? tagMapNow() : null, allPrograms: BFF.programs || [] });
      if (/<entry>/.test(xml)) files.push({ name: 'baby-freebies-gmail-filters.xml', text: xml });
      var entries = [];
      (BFF.programs || []).forEach(function (p) {
        if (BFF.tracker.getStatus(p.id) !== 'signed-up') return;
        var en = BFF.tracker.getEntry(p.id) || {};
        var d = localDate(en.signedUpAt || en.updatedAt);
        if (d) entries.push({ id: p.id, name: p.name, date: d });
      });
      var ics = E.icsReminders(entries, { days: 28 });
      if (ics) files.push({ name: 'baby-freebies-reminders.ics', text: ics });
      var draft = I().kitDraft({ email: email, files: files });
      if (!draft || !draft.attachments.length) { say('There is nothing to attach yet. Mark a program as Signed up for reminders, or keep some programs on your list for filters.'); return; }
      say('Saving a draft in your Gmail…');
      var p2 = await call('create_draft', draft, false);
      say('');
      draftDone(p2);
    }

    // ---- wiring ----
    btnCheck.addEventListener('click', function () { run(btnCheck, 'check', doCheck); });
    btnList.addEventListener('click', function () { run(btnList, 'draft', doDraftList); });
    btnKit.addEventListener('click', function () { run(btnKit, 'draft', doDraftKit); });
    btnLabel.addEventListener('click', function () {
      if (busy) return;
      var n = threadIdsToLabel().length;
      if (!n) return;
      BFF.ui.confirm({
        after: actions, returnTo: btnLabel, confirmLabel: 'Add label',
        message: 'Add the label “' + LABEL_NAME + '” to ' + plural(n, 'conversation') + ' in your Gmail? This only adds a label.',
        onConfirm: function () { run(btnLabel, 'label', doLabel); },
        onCancel: function () { say('Cancelled. Nothing was labelled.'); }
      });
    });
    btnAddr.addEventListener('click', function () {
      if (!account) return;
      var pr = profile();
      pr.email = account;
      var ok = BFF.store.set('profile.v1', pr);
      try { document.dispatchEvent(new CustomEvent('bff:profile-changed')); } catch (e) {}
      changed.textContent = 'Saved ' + account + ' as your email in My info.' + (ok ? '' : SAVE_FAIL);
      render();
      btnCheck.focus();
    });
    btnClear.addEventListener('click', function () {
      clearData();
      say('Results cleared from this page.');
      render();
      btnCheck.focus();
    });
    document.addEventListener('bff:tracker-changed', function () { if (matches) { renderSuggestions(); renderResults(); } });
    document.addEventListener('bff:profile-changed', render);

    render();
    // First contact with the runtime happens after first paint, never during the first synchronous run.
    function start() {
      getMcp().then(function (ns) {
        mcp = ns; state = ns ? 'ready' : 'none';
        render();
      });
    }
    if (document.readyState === 'complete') setTimeout(start, 0);
    else window.addEventListener('load', function () { setTimeout(start, 0); }, { once: true });
    return card;
  }

  function mount(el) {
    if (!el || el.nodeType !== 1 || !BFF.inbox || !BFF.tracker || !BFF.store || !BFF.email) return null;
    var have = el.querySelector('[data-ib-card]');
    return have || create(el);
  }
  BFF.inboxView = { mount: mount };

  // A mount point that appeared before this script ran still gets its card.
  function auto() { var n = document.getElementById('trk-inbox'); if (n) mount(n); }
  auto();
  document.addEventListener('DOMContentLoaded', auto);
})();
