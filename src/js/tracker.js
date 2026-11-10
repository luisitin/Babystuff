(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  BFF.views = BFF.views || {};
  var store = BFF.store;

  var STATUSES = ['todo', 'signed-up', 'received', 'skipped'];
  var LABELS = { todo: 'To do', 'signed-up': 'Signed up', received: 'Received', skipped: 'Skipped' };
  var APP = 'baby-freebies-finder';
  var KEY = 'tracker.v1';
  var MAX_BYTES = 1024 * 1024, MAX_ENTRIES = 5000, MAX_NOTE = 2000, MAX_FIELD = 200;
  var PROFILE_KEYS = ['firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'zip', 'dueDate'];
  // Optional "Your situation" answers. Kept in the profile and the backup, never used by any form filling.
  var SITUATION = {
    cover: ['private', 'marketplace', 'medicaid', 'tricare', 'none'],
    lowIncome: ['yes', 'no'],
    job: ['yes', 'no']
  };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

  function emit(id) {
    try {
      document.dispatchEvent(new CustomEvent('bff:tracker-changed', { detail: { id: id } }));
    } catch (e) {}
  }
  function state() {
    var s = store.get(KEY, {});
    return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
  }
  function ts(s) {
    var t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  }
  function entryOf(s, id) {
    return has(s, id) && s[id] ? s[id] : { status: 'todo', note: '', updatedAt: '' };
  }

  // ---- pure helpers (also used by tests) ----
  function parseBackup(text) {
    var data;
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('That file is too large to be a backup (the limit is 1 MB).');
    try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON, so it cannot be a backup.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That file is not a Baby Freebies Finder backup.');
    if (data.app !== APP) throw new Error('That file is not a Baby Freebies Finder backup (wrong app name).');
    if (data.version !== 1) throw new Error('This backup has an unsupported version (' + String(data.version) + ').');
    var t = data.tracker;
    if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('The backup has no tracker section.');
    var clean = {};
    var ids = Object.keys(t).filter(function (id) { return id !== '__proto__' && id !== 'constructor' && id !== 'prototype'; });
    if (ids.length > MAX_ENTRIES) throw new Error('This backup has too many entries (' + ids.length + '; the limit is ' + MAX_ENTRIES + ').');
    ids.forEach(function (id) {
      var e = t[id];
      if (!e || typeof e !== 'object') throw new Error('Entry "' + id + '" is malformed.');
      if (STATUSES.indexOf(e.status) < 0) throw new Error('Entry "' + id + '" has an unknown status.');
      if (e.note !== undefined && typeof e.note !== 'string') throw new Error('Entry "' + id + '" has a note that is not text.');
      if (e.updatedAt !== undefined && typeof e.updatedAt !== 'string') throw new Error('Entry "' + id + '" has a bad date.');
      clean[id] = { status: e.status, note: (e.note || '').slice(0, MAX_NOTE), updatedAt: (e.updatedAt || '').slice(0, 40) };
      if (typeof e.signedUpAt === 'string' && e.signedUpAt.length <= 40 && !isNaN(Date.parse(e.signedUpAt))) clean[id].signedUpAt = e.signedUpAt;
    });
    var profile = null;
    if (data.profile !== undefined && data.profile !== null) {
      if (typeof data.profile !== 'object' || Array.isArray(data.profile)) throw new Error('The profile section is malformed.');
      profile = {};
      PROFILE_KEYS.forEach(function (k) {
        if (typeof data.profile[k] === 'string') profile[k] = data.profile[k].slice(0, MAX_FIELD);
      });
      Object.keys(SITUATION).forEach(function (k) {
        var v = data.profile[k];
        if (typeof v === 'string' && SITUATION[k].indexOf(v) !== -1) profile[k] = v;
      });
      if (typeof data.profile.insurer === 'string' && data.profile.insurer.trim()) profile.insurer = data.profile.insurer.trim().slice(0, MAX_FIELD);
      if (typeof data.profile.usePlusTags === 'boolean') profile.usePlusTags = data.profile.usePlusTags;
      var ptm = data.profile.plusTagMap;
      if (ptm && typeof ptm === 'object' && !Array.isArray(ptm)) {
        profile.plusTagMap = {};
        Object.keys(ptm).slice(0, MAX_ENTRIES).forEach(function (id) {
          if (id !== '__proto__' && id !== 'constructor' && id !== 'prototype' && id.length <= MAX_FIELD && typeof ptm[id] === 'string' && /^[a-z0-9-]{1,24}$/.test(ptm[id])) profile.plusTagMap[id] = ptm[id];
        });
      }
      if (profile.dueDate) profile.dueDate = BFF.util.normalizeDate(profile.dueDate);
    }
    return { tracker: clean, profile: profile };
  }

  // Merge parsed.tracker into a copy of current. Newer updatedAt wins; ties keep current.
  function mergeImport(current, parsed) {
    var next = {};
    if (Object.keys(current).length > MAX_ENTRIES * 2) throw new Error('Too many saved entries to merge.');
    Object.keys(current).forEach(function (k) { next[k] = current[k]; });
    var imported = 0, skipped = 0;
    Object.keys(parsed.tracker).forEach(function (id) {
      var inc = parsed.tracker[id];
      if (!has(next, id) || !next[id] || ts(inc.updatedAt) > ts(next[id].updatedAt)) {
        next[id] = inc;
        imported++;
      } else {
        skipped++;
      }
    });
    return { state: next, imported: imported, skipped: skipped };
  }

  function buildExport(s, profile, now) {
    var out = { app: APP, version: 1, exportedAt: now, tracker: s };
    if (profile) out.profile = profile;
    return JSON.stringify(out, null, 2);
  }

  // ---- public API ----
  var tracker = {
    STATUSES: STATUSES,
    LABELS: LABELS,
    getStatus: function (id) {
      var st = entryOf(state(), id).status;
      return STATUSES.indexOf(st) >= 0 ? st : 'todo';
    },
    setStatus: function (id, status) {
      if (STATUSES.indexOf(status) < 0) return false;
      var s = state();
      var e = entryOf(s, id);
      var now = new Date().toISOString();
      var prev = STATUSES.indexOf(e.status) >= 0 ? e.status : 'todo';
      s[id] = { status: status, note: e.note || '', updatedAt: now };
      // signedUpAt marks when the program became Signed up; it is what reminders count from.
      if (status === 'signed-up' && prev !== 'signed-up') s[id].signedUpAt = now;
      else if (e.signedUpAt) s[id].signedUpAt = e.signedUpAt;
      var ok = store.set(KEY, s);
      emit(id);
      return ok;
    },
    // Copy of one entry (or null) and an exact restore, used by the guided run's Undo.
    getEntry: function (id) {
      var s = state();
      return has(s, id) && s[id] ? Object.assign({}, s[id]) : null;
    },
    restoreEntry: function (id, entry) {
      var s = state();
      if (entry) s[id] = Object.assign({}, entry); else delete s[id];
      var ok = store.set(KEY, s);
      emit(id);
      return ok;
    },
    getNote: function (id) {
      return entryOf(state(), id).note || '';
    },
    setNote: function (id, text) {
      var s = state();
      var e = entryOf(s, id);
      s[id] = { status: e.status || 'todo', note: String(text), updatedAt: new Date().toISOString() };
      if (e.signedUpAt) s[id].signedUpAt = e.signedUpAt;
      var ok = store.set(KEY, s);
      emit(id);
      return ok;
    },
    all: function () {
      return state();
    },
    counts: function () {
      var c = { todo: 0, 'signed-up': 0, received: 0, skipped: 0 };
      var s = state();
      var list = BFF.programs || [];
      list.forEach(function (p) { c[tracker.getStatus(p.id)]++; });
      c.total = list.length;
      c.done = c['signed-up'] + c.received;
      c.active = list.length - c.skipped;
      return c;
    },
    // Combined estimated value of programs marked Signed up or Received (text only; null when none).
    valueLine: function () {
      var L = BFF.logic;
      if (!L || !L.totalValue) return null;
      var done = (BFF.programs || []).filter(function (p) {
        var st = tracker.getStatus(p.id);
        return st === 'signed-up' || st === 'received';
      });
      if (!done.length) return null;
      var t = L.totalValue(done);
      var missing = t.missing;
      var lead = 'Estimated value of what you have signed up for: ';
      if (!t.count) return lead + 'not known (' + plural(missing, 'program') + ' with no known value)';
      var lo = t.low, hi = t.high;
      if (t.count > 1) { lo = L.roundTotal(lo); hi = L.roundTotal(hi); }
      var range = Math.round(lo) === Math.round(hi) ? L.money(lo) : L.money(lo) + ' to ' + L.money(hi);
      return lead + 'about ' + range + ' (our estimate' +
        (missing ? '; ' + plural(missing, 'program') + ' with no known value ' + (missing === 1 ? 'is' : 'are') + ' not counted' : '') + ')';
    },
    reset: function () {
      var ok = store.remove(KEY);
      emit(null);
      return ok;
    },
    exportJSON: function (opts) {
      var profile = opts && opts.includeProfile ? store.get('profile.v1', {}) : null;
      if (profile && typeof profile === 'object') profile = Object.assign({}, profile, { usePlusTags: !!profile.usePlusTags });
      return buildExport(state(), profile, new Date().toISOString());
    },
    // Dry run: what would importJSON do? Throws on bad input.
    analyzeImport: function (text) {
      var parsed = parseBackup(text);
      var m = mergeImport(state(), parsed);
      var known = {};
      (BFF.programs || []).forEach(function (p) { known[p.id] = 1; });
      var unknown = Object.keys(parsed.tracker).filter(function (id) { return !known[id]; }).length;
      return { imported: m.imported, skipped: m.skipped, unknown: unknown, hasProfile: !!parsed.profile };
    },
    importJSON: function (text) {
      var parsed = parseBackup(text);
      var m = mergeImport(state(), parsed);
      var saved = store.set(KEY, m.state);
      if (parsed.profile) {
        // Only fill blanks; never overwrite details already on this device.
        var cur = store.get('profile.v1', {}) || {};
        Object.keys(parsed.profile).forEach(function (k) {
          if (k === 'plusTagMap') {
            var m = cur.plusTagMap && typeof cur.plusTagMap === 'object' ? cur.plusTagMap : {};
            var used = {};
            Object.keys(m).forEach(function (id) { used[m[id]] = 1; });
            Object.keys(parsed.profile.plusTagMap).forEach(function (id) {
              var t = parsed.profile.plusTagMap[id];
              if (!has(m, id) && !used[t]) { m[id] = t; used[t] = 1; }
            });
            cur.plusTagMap = m;
          } else if (!cur[k] && parsed.profile[k]) cur[k] = parsed.profile[k];
        });
        saved = store.set('profile.v1', cur) && saved;
        try { document.dispatchEvent(new CustomEvent('bff:profile-changed')); } catch (e) {}
      }
      emit(null);
      return { imported: m.imported, skipped: m.skipped, saved: saved };
    },
    _parseBackup: parseBackup,
    _mergeImport: mergeImport,
    _buildExport: buildExport
  };
  BFF.tracker = tracker;

  // ---- view ----
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
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function plural(n, w) { return n + ' ' + (n === 1 ? w : w.replace(/y$/, 'ie') + 's'); }
  var SAVE_FAIL = 'Could not save on this device (storage is full or blocked). Your changes are kept only until you close this page.';

  var view = { rows: {}, filter: 'all', flushers: [] };

  function updateSummary() {
    if (!view.bar) return;
    var c = tracker.counts();
    view.bar.max = Math.max(c.active, 1);
    view.bar.value = Math.min(c.done, view.bar.max);
    view.barText.textContent = c.done + ' of ' + c.active + ' done' + (c.skipped ? ' (' + c.skipped + ' skipped)' : '');
    view.bar.setAttribute('aria-label', c.done + ' of ' + c.active + ' programs done');
    STATUSES.forEach(function (st) { view.countEls[st].textContent = c[st]; });
    var vl = tracker.valueLine();
    view.valueEl.textContent = vl || '';
    view.valueEl.hidden = !vl;
    view.empty.hidden = !!(BFF.programs && BFF.programs.length);
    view.storeWarn.hidden = store.persistent;
  }

  function applyFilter() {
    var shown = 0;
    var active = document.activeElement, moved = null;
    var list = BFF.programs || [];
    list.forEach(function (p) {
      var r = view.rows[p.id];
      if (!r) return;
      var ok = view.filter === 'all' || tracker.getStatus(p.id) === view.filter;
      if (!ok && !r.el.hidden && active && r.el.contains(active)) moved = p;
      r.el.hidden = !ok;
      if (ok) shown++;
    });
    view.none.hidden = shown > 0 || !list.length;
    Array.prototype.forEach.call(view.tabs, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filter') === view.filter ? 'true' : 'false');
    });
    if (moved) {
      // The row with focus just left this filter: hand focus to the next visible row.
      var idx = list.indexOf(moved), target = null, i;
      for (i = idx + 1; i < list.length && !target; i++) if (!view.rows[list[i].id].el.hidden) target = view.rows[list[i].id].select;
      for (i = idx - 1; i >= 0 && !target; i--) if (!view.rows[list[i].id].el.hidden) target = view.rows[list[i].id].select;
      if (!target) target = view.tabs[STATUSES.indexOf(view.filter) + 1];
      if (target) target.focus();
      view.live.textContent = moved.name + ' moved to ' + LABELS[tracker.getStatus(moved.id)] + '.';
    }
  }

  function syncRow(id, force) {
    var r = view.rows[id];
    if (!r) return;
    r.select.value = tracker.getStatus(id);
    r.el.setAttribute('data-status', r.select.value);
    if (force || document.activeElement !== r.note) r.note.value = tracker.getNote(id);
  }

  function buildRow(p) {
    var id = p.id;
    var sid = 'trk-s-' + id, nid = 'trk-n-' + id;
    var select = h('select', { id: sid, class: 'fx-select' });
    STATUSES.forEach(function (st) { select.appendChild(h('option', { value: st, text: LABELS[st] })); });
    var note = h('textarea', { id: nid, class: 'fx-textarea', rows: '2', maxlength: '2000', placeholder: 'Notes (confirmation email, date, issues)' });
    var hint = h('span', { class: 'fx-saved', role: 'status', 'aria-live': 'polite' });
    var link = h('a', { class: 'fx-link-btn', href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Sign up ↗' });
    link.setAttribute('aria-label', 'Sign up for ' + p.name + ' (opens in a new tab)');
    var addr = h('p', { class: 'fx-muted fx-trk-addr', hidden: '' });
    var gm = h('a', { class: 'fx-link-btn fx-link-btn--ghost', target: '_blank', rel: 'noopener noreferrer', hidden: '', text: 'Search my Gmail ↗' });
    gm.setAttribute('aria-label', 'Search my Gmail for ' + p.name + ' (opens your own Gmail in a new tab)');
    var el = h('li', { class: 'fx-trk-row' }, [
      h('div', { class: 'fx-trk-head' }, [
        h('div', { class: 'fx-trk-name' }, [h('strong', { text: p.name }), h('span', { class: 'fx-muted', text: p.brand || '' })]),
        h('div', { class: 'fx-trk-links' }, [link, gm])
      ]),
      addr,
      h('div', { class: 'fx-field' }, [h('label', { 'for': sid, text: 'Status for ' + p.name }), select]),
      h('div', { class: 'fx-field' }, [h('label', { 'for': nid, text: 'Notes for ' + p.name }), note, hint])
    ]);
    var timer = null;
    function flush() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      if (tracker.setNote(id, note.value)) {
        hint.className = 'fx-saved';
        hint.textContent = 'Saved';
        setTimeout(function () { if (hint.textContent === 'Saved') hint.textContent = ''; }, 1500);
      } else {
        hint.className = 'fx-hint';
        hint.textContent = SAVE_FAIL;
      }
    }
    view.flushers.push(flush);
    note.addEventListener('input', function () {
      hint.textContent = '';
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, 500);
    });
    note.addEventListener('blur', flush);
    select.addEventListener('change', function () {
      if (!tracker.setStatus(id, select.value)) view.msg.textContent = SAVE_FAIL;
    });
    view.rows[id] = { el: el, select: select, note: note, addr: addr, gm: gm };
    return el;
  }

  // Every file goes through BFF.host.saveFile, then the message says what happened (see reportSave).
  function hostOk() { return !!(BFF.host && BFF.host.saveFile); }
  function clearShown(msg, key) {
    var old = msg.parentNode ? msg.parentNode.querySelectorAll('[data-bff-shown="' + key + '"]') : [];
    for (var i = 0; i < old.length; i++) old[i].remove();
  }
  // o: {msg, key, name, text, mime, what, button}
  function saveFile(o) {
    var btn = o.button;
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    function finish() { if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); } }
    if (!hostOk()) { o.msg.textContent = 'This page cannot save files here.'; finish(); return; }
    BFF.host.saveFile({ name: o.name, text: o.text, mime: o.mime }).then(function (res) {
      finish();
      reportSave(res, o);
    }, function () {
      finish();
      reportSave({ status: 'shown', name: o.name }, o);
    });
  }
  function reportSave(res, o) {
    var msg = o.msg, inArt = BFF.host && BFF.host.inArtifact;
    if (res.status !== 'shown') clearShown(msg, o.key);
    if (res.status === 'saved') {
      var t = inArt ? 'Saved ' + o.what + ' as ' + res.name + ' (in the place you picked).' : 'Downloaded ' + o.what + ' as ' + res.name + '. Look in your Downloads.';
      if (res.zipped) t += ' The file is inside the zip: unzip it, then open ' + res.inner + '.';
      msg.textContent = t;
    } else if (res.status === 'declined') {
      msg.textContent = 'Not saved. Tap the button again whenever you want the file.';
    } else if (res.status === 'failed') {
      msg.textContent = res.message || 'Could not save the file.';
    } else {
      msg.textContent = 'This page cannot save files here, so the text is below. Copy it and paste it into a new file named ' + o.name + '.';
      if (BFF.host && BFF.host.showText) BFF.host.showText({ after: msg, key: o.key, label: 'Contents of ' + o.name, text: o.text, returnTo: o.button });
    }
  }

  // ---- email and calendar helpers ----
  function profileOf() {
    var p = store.get('profile.v1', {});
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  }
  function plusOn(pr) {
    return !!pr.usePlusTags && BFF.email.supportsPlus(pr.email) !== false && !!BFF.email.plusAddress(pr.email, 'x');
  }
  function tagMapNow() { return BFF.plusTags ? BFF.plusTags.map() : BFF.email.tagMap(BFF.programs || []); }
  function gmailAccount() {
    var p = store.get('prefs.v1', {});
    var n = p && typeof p === 'object' ? parseInt(p.gmailAccount, 10) : 0;
    return n >= 0 && n <= 9 ? n : 0;
  }
  function activePrograms() {
    return (BFF.programs || []).filter(function (p) { return tracker.getStatus(p.id) !== 'skipped'; });
  }
  // Programs the person has signed up for (or received); before that, everything still on their list.
  function checklistPrograms() {
    var started = (BFF.programs || []).filter(function (p) { var st = tracker.getStatus(p.id); return st === 'signed-up' || st === 'received'; });
    return started.length ? started : activePrograms();
  }
  function localDate(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  // Show or hide the per-row address and Gmail search link from the current profile.
  function syncEmailBits() {
    var pr = profileOf(), E = BFF.email, all = BFF.programs || [];
    var plus = plusOn(pr), gmail = E.isGmail(pr.email);
    var map = plus ? tagMapNow() : {};
    var acct = gmailAccount();
    all.forEach(function (p) {
      var r = view.rows[p.id];
      if (!r) return;
      var tag = plus ? map[p.id] : '';
      var inMail = !E.inEmailFeatures || E.inEmailFeatures(p);
      r.addr.hidden = !(plus && inMail);
      r.addr.textContent = plus && inMail ? 'Sign up with: ' + E.plusAddress(pr.email, tag) : '';
      var href = gmail ? E.gmailSearchUrl({ email: pr.email, tag: tag, domain: E.domainOfUrl(p.signupUrl), account: acct, program: p }) : '';
      r.gm.hidden = !href;
      if (href) r.gm.setAttribute('href', href); else r.gm.removeAttribute('href');
    });
    if (view.archive) {
      view.archive.disabled = !plus;
      if (!plus) view.archive.checked = false;
      view.plusHint.hidden = plus;
    }
    if (view.acctRow) view.acctRow.hidden = !gmail;
    if (view.mailHint) view.mailHint.hidden = !!E.plusAddress(pr.email, 'x');
    if (view.gmailNote) view.gmailNote.hidden = !gmail;
    refreshMailto();
  }

  function checklistMail(pr) {
    var to = BFF.email.plusAddress(pr.email, 'x') ? String(pr.email).trim() : '';
    return BFF.email.mailtoChecklist({
      to: to, programs: checklistPrograms(),
      statusOf: function (p) { return LABELS[tracker.getStatus(p.id)]; }
    });
  }
  // Keep the mailto link current: it is a real link, so its address and text are set before it is tapped.
  function refreshMailto() {
    if (!view.mailLink) return;
    var pr = profileOf(), ok = !!BFF.email.plusAddress(pr.email, 'x');
    view.mailLink.hidden = !ok;
    if (view.mailLinkNote) view.mailLinkNote.hidden = !ok;
    if (!ok) { view.mailLink.removeAttribute('href'); view.mailTruncated = false; return; }
    var r = checklistMail(pr);
    view.mailTruncated = r.truncated;
    view.mailLink.setAttribute('href', r.url);
  }
  // In the artifact a file is saved inside a zip when its type is not on the viewer's list.
  function zipNote(what) {
    if (!(BFF.host && BFF.host.inArtifact)) return null;
    return h('p', { class: 'fx-small', text: 'From this page ' + what + ' arrive inside a zip file. Unzip it first, then use the file inside.' });
  }

  function buildEmailPanel() {
    var E = BFF.email;
    var msg = h('p', { class: 'fx-msg', role: 'status', 'aria-live': 'polite' });
    view.mailHint = h('p', { class: 'fx-warn', hidden: '' }, [
      document.createTextNode('Add your email in '), h('a', { href: '#info', text: 'My info' }), document.createTextNode(' to email yourself the checklist.')
    ]);
    // 1. checklist by email: a real mailto link (kept current by refreshMailto) plus a Copy button that always works.
    var inArt = !!(BFF.host && BFF.host.inArtifact);
    var mailLink = h('a', { class: 'fx-btn' + (inArt ? '' : ' fx-btn--primary'), href: 'mailto:', text: 'Email me my checklist' });
    var mailNote = h('span', { class: 'fx-small', text: (BFF.host && BFF.host.mailtoNote) || '' });
    var copyBtn = h('button', { type: 'button', class: 'fx-btn' + (inArt ? ' fx-btn--primary' : ''), text: 'Copy my checklist' });
    view.mailLink = mailLink;
    view.mailLinkNote = mailNote;
    view.mailTruncated = false;
    mailLink.addEventListener('click', function () {
      clearShown(msg, 'checklist');
      msg.textContent = (view.mailTruncated
        ? 'The list was too long for an email link, so it is cut short there. Use Copy my checklist for the full list. '
        : '') + 'If no mail app opens, this device may not have one set up here. Use Copy my checklist instead.';
    });
    copyBtn.addEventListener('click', function () {
      var r = checklistMail(profileOf());
      if (BFF.host && BFF.host.copyText) {
        BFF.host.copyText(r.fullText).then(function (ok) {
          clearShown(msg, 'checklist');
          if (ok) msg.textContent = 'Checklist copied. Paste it into an email or a note. Nothing was sent.';
          else {
            msg.textContent = 'Copying did not work here, so the checklist is below. Select it and copy it. Nothing was sent.';
            BFF.host.showText({ after: msg, key: 'checklist', label: 'Your checklist', text: r.fullText, returnTo: copyBtn });
          }
        });
      }
    });
    view.mailCopy = copyBtn;
    var mailRow = h('div', { class: 'fx-actions' }, inArt ? [copyBtn, mailLink, mailNote] : [mailLink, mailNote, copyBtn]);
    // 2. Gmail filters
    var arch = h('input', { type: 'checkbox', id: 'trk-archive' });
    view.archive = arch;
    view.plusHint = h('p', { class: 'fx-small', hidden: '' }, [document.createTextNode('For tidy, safe filters, turn on plus addresses in '), h('a', { href: '#info', text: 'My info' }),
      document.createTextNode('. Without them, filters only add a label for each program\u2019s sender domain (big stores and .gov sites are left out), and Skip the inbox is off.')]);
    var fBtn = h('button', { type: 'button', class: 'fx-btn', text: 'Download Gmail filters' });
    fBtn.addEventListener('click', function () {
      var pr = profileOf();
      var usePlus = plusOn(pr);
      var xml = E.gmailFiltersXml(activePrograms(), { email: pr.email, usePlus: usePlus, archive: usePlus && arch.checked, tagMap: usePlus ? tagMapNow() : null, allPrograms: BFF.programs || [] });
      var n = (xml.match(/<entry>/g) || []).length;
      saveFile({ msg: msg, key: 'filters', name: 'baby-freebies-gmail-filters.xml', text: xml, mime: 'application/xml', what: plural(n, 'filter'), button: fBtn });
    });
    var steps = h('details', { class: 'fx-about' }, [
      h('summary', { text: 'How to import the filters' }),
      h('ol', {}, [
        h('li', { text: 'On a computer, open Gmail and go to Settings (gear) > See all settings > Filters and Blocked Addresses.' }),
        h('li', { text: 'Choose Import filters, then Choose file, and pick the downloaded file.' }),
        h('li', { text: 'Select Open file, tick the filters you want, and choose Create filters.' })
      ]),
      zipNote('the filters'),
      h('p', { class: 'fx-small', text: 'Each filter adds a label like Baby Freebies/Program name. With plus addresses on, it matches the tagged address exactly, so Skip the inbox is safe. Otherwise it matches the program\u2019s sender domain and never archives.' })
    ]);
    // 3. reminders
    var iBtn = h('button', { type: 'button', class: 'fx-btn', text: 'Download reminders (.ics)' });
    var icsNote = zipNote('reminders');
    iBtn.addEventListener('click', function () {
      var entries = [];
      (BFF.programs || []).forEach(function (p) {
        if (tracker.getStatus(p.id) !== 'signed-up') return;
        var en = entryOf(state(), p.id);
        var d = localDate(en.signedUpAt || en.updatedAt); // older data has no signedUpAt
        if (d) entries.push({ id: p.id, name: p.name, date: d });
      });
      if (!entries.length) {
        msg.textContent = 'No programs are marked Signed up yet. Mark a program as Signed up, then come back: each reminder lands 28 days after the date you marked it.';
        return;
      }
      saveFile({ msg: msg, key: 'reminders', name: 'baby-freebies-reminders.ics', text: E.icsReminders(entries, { days: 28 }), mime: 'text/calendar', what: plural(entries.length, 'reminder'), button: iBtn });
    });
    view.gmailNote = h('p', { class: 'fx-small', hidden: '', text: 'The Search my Gmail links on each row open your own Gmail in a new tab. This app never sees your mail.' });
    var acct = h('input', { type: 'number', id: 'trk-acct', class: 'fx-input fx-input--short', min: '0', max: '9', step: '1' });
    acct.value = String(gmailAccount());
    acct.addEventListener('change', function () {
      var n = parseInt(acct.value, 10);
      if (!(n >= 0 && n <= 9)) n = 0;
      acct.value = String(n);
      var pf = store.get('prefs.v1', {});
      if (!pf || typeof pf !== 'object') pf = {};
      pf.gmailAccount = n;
      store.set('prefs.v1', pf);
      syncEmailBits();
    });
    view.acctRow = h('div', { class: 'fx-field', hidden: '' }, [
      h('label', { 'for': 'trk-acct', text: 'Gmail account number' }), acct,
      h('span', { class: 'fx-small', text: 'Use 0 for the first Google account you are signed in to, 1 for the second, and so on.' })]);
    return h('section', { class: 'fx-card', 'aria-labelledby': 'trk-mail-h' }, [
      h('h3', { id: 'trk-mail-h', text: 'Email and calendar' }),
      h('p', { class: 'fx-muted', text: 'These hand off to your own mail app, Gmail or calendar. Nothing is sent from this app. Government and benefit programs are left out of the filters and searches.' }),
      view.mailHint,
      mailRow,
      h('div', { class: 'fx-check' }, [arch, h('label', { 'for': 'trk-archive', text: 'Skip the inbox (archive)' })]),
      view.plusHint,
      h('div', { class: 'fx-actions' }, [fBtn]),
      steps,
      h('div', { class: 'fx-actions' }, [iBtn]),
      icsNote,
      view.gmailNote,
      view.acctRow,
      msg
    ]);
  }

  view.init = function (el) {
    view.el = el;
    el.classList.add('fx-view');
    if (!el.querySelector('h2')) el.appendChild(h('h2', { tabindex: '-1', text: 'Tracker' }));

    view.bar = h('progress', { class: 'fx-progress', value: '0', max: '1' });
    view.barText = h('p', { class: 'fx-progress-text' });
    view.countEls = {};
    var counts = h('ul', { class: 'fx-counts' });
    STATUSES.forEach(function (st) {
      var n = h('strong');
      view.countEls[st] = n;
      counts.appendChild(h('li', {}, [n, h('span', { text: ' ' + LABELS[st] })]));
    });
    view.valueEl = h('p', { class: 'fx-muted', hidden: '' });
    view.empty = h('p', { class: 'fx-muted', text: 'No programs loaded.', hidden: '' });
    view.storeWarn = h('p', { class: 'fx-warn', role: 'alert', text: 'This browser is not saving data. ' + SAVE_FAIL, hidden: '' });
    view.live = h('div', { class: 'fx-sr', role: 'status', 'aria-live': 'polite' });
    view.msg = h('p', { class: 'fx-hint', role: 'alert' });
    el.appendChild(h('div', { class: 'fx-card' }, [view.barText, view.bar, counts, view.valueEl, view.empty]));
    el.appendChild(view.storeWarn);
    el.appendChild(view.msg);
    el.appendChild(view.live);
    el.appendChild(buildEmailPanel());
    // Mount point for the Gmail connection panel (BFF.inboxView, optional).
    var inboxNode = h('div', { id: 'trk-inbox' });
    el.appendChild(inboxNode);
    try { if (BFF.inboxView && typeof BFF.inboxView.mount === 'function') BFF.inboxView.mount(inboxNode); } catch (e) { if (window.console) console.error('Gmail panel failed to mount:', e); }

    var bar = h('div', { class: 'fx-tabs', role: 'group', 'aria-label': 'Filter by status' });
    [['all', 'All']].concat(STATUSES.map(function (s) { return [s, LABELS[s]]; })).forEach(function (f) {
      var b = h('button', { type: 'button', class: 'fx-tab', 'data-filter': f[0], 'aria-pressed': f[0] === 'all' ? 'true' : 'false', text: f[1] });
      b.addEventListener('click', function () { view.filter = f[0]; applyFilter(); });
      bar.appendChild(b);
    });
    view.tabs = bar.children;
    el.appendChild(bar);

    var list = h('ul', { class: 'fx-trk-list' });
    (BFF.programs || []).forEach(function (p) { list.appendChild(buildRow(p)); syncRow(p.id, true); });
    view.none = h('p', { class: 'fx-muted', text: 'Nothing here yet.', hidden: '' });
    el.appendChild(list);
    el.appendChild(view.none);

    // Backup panel
    var inc = h('input', { type: 'checkbox', id: 'trk-inc-profile' });
    var warn = h('p', { class: 'fx-warn', text: 'The file will contain your personal details (name, email, address). Keep it somewhere private.', hidden: '' });
    inc.addEventListener('change', function () { warn.hidden = !inc.checked; });
    var msg = h('p', { class: 'fx-msg', role: 'status', 'aria-live': 'polite' });
    var dl = h('button', { type: 'button', class: 'fx-btn fx-btn--primary', text: 'Download backup (JSON)' });
    dl.addEventListener('click', function () {
      var text;
      try { text = tracker.exportJSON({ includeProfile: inc.checked }); }
      catch (e) { msg.textContent = 'Could not create the backup: ' + e.message; return; }
      saveFile({ msg: msg, key: 'backup', name: 'baby-freebies-backup-' + today() + '.json', text: text, mime: 'application/json', what: 'your backup', button: dl });
    });
    var file = h('input', { type: 'file', id: 'trk-restore', accept: 'application/json,.json', class: 'fx-file' });
    var actions1 = h('div', { class: 'fx-actions' }, [dl]);
    // Shared by the file picker and the paste box.
    function restoreFrom(text, label, after, returnTo, done) {
      var a;
      try { a = tracker.analyzeImport(text); } catch (e) { msg.textContent = 'Restore failed: ' + e.message; done(); return; }
      var q = 'Restore from ' + label + '? ' + plural(a.imported, 'program entry') + ' will be added or updated (newer changes win). ' +
        plural(a.skipped, 'entry') + ' will be left as they are because yours are newer.' +
        (a.unknown ? ' ' + plural(a.unknown, 'entry') + ' for programs not in this version will be kept.' : '') +
        (a.hasProfile ? ' My info in the file will fill in blank fields only.' : '');
      msg.textContent = '';
      BFF.ui.confirm({
        after: after, message: q, confirmLabel: 'Restore', returnTo: returnTo,
        onConfirm: function () {
          try {
            var r = tracker.importJSON(text);
            msg.textContent = (r.saved ? 'Restored: ' : 'Restored for this visit only, but it could not be saved on this device: ') + plural(r.imported, 'entry') + ' imported, ' + r.skipped + ' skipped.';
          } catch (e) { msg.textContent = 'Restore failed: ' + e.message; }
          done(true);
        },
        onCancel: function () { msg.textContent = 'Restore cancelled. Nothing changed.'; done(); }
      });
    }
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > MAX_BYTES) { msg.textContent = 'Restore failed: that file is too large to be a backup (the limit is 1 MB).'; file.value = ''; return; }
      var fr = new FileReader();
      fr.onerror = function () { msg.textContent = 'Could not read that file.'; };
      fr.onload = function () {
        restoreFrom(String(fr.result), '"' + f.name + '"', file.parentNode, file, function () { file.value = ''; });
      };
      fr.readAsText(f);
    });
    // Paste box: for pages where the file picker is not available.
    var pasteBox = h('textarea', { id: 'trk-paste', class: 'fx-textarea', rows: '4', placeholder: 'Paste the text of a backup file here' });
    var pasteBtn = h('button', { type: 'button', class: 'fx-btn', text: 'Restore from pasted text' });
    var paste = h('details', { class: 'fx-about' }, [
      h('summary', { text: 'Restore from pasted text instead' }),
      h('div', { class: 'fx-field' }, [h('label', { 'for': 'trk-paste', text: 'Backup text' }), pasteBox]),
      h('div', { class: 'fx-actions' }, [pasteBtn])
    ]);
    pasteBtn.addEventListener('click', function () {
      var text = pasteBox.value.trim();
      if (!text) { msg.textContent = 'Paste the backup text into the box first.'; return; }
      if (text.length > MAX_BYTES) { msg.textContent = 'Restore failed: that text is too large to be a backup (the limit is 1 MB).'; return; }
      restoreFrom(text, 'the pasted text', paste, pasteBtn, function (ok) { if (ok) pasteBox.value = ''; });
    });
    var reset = h('button', { type: 'button', class: 'fx-btn fx-btn--danger', text: 'Reset tracker' });
    var actions2 = h('div', { class: 'fx-actions' }, [reset]);
    reset.addEventListener('click', function () {
      BFF.ui.confirm({
        after: actions2, confirmLabel: 'Reset tracker', returnTo: reset,
        message: 'Reset the tracker? All statuses and notes on this device will be cleared. My info is not affected.',
        onConfirm: function () { msg.textContent = tracker.reset() ? 'Tracker reset.' : 'Tracker reset for this visit, but the change could not be saved on this device.'; },
        onCancel: function () { msg.textContent = 'Reset cancelled.'; }
      });
    });
    el.appendChild(h('section', { class: 'fx-card', 'aria-labelledby': 'trk-backup-h' }, [
      h('h3', { id: 'trk-backup-h', text: 'Backup' }),
      h('p', { class: 'fx-muted', text: 'Your tracker lives only in this browser. Download a file to keep a copy or move to another device.' }),
      h('div', { class: 'fx-check' }, [inc, h('label', { 'for': 'trk-inc-profile', text: 'Include My info in the backup' })]),
      warn,
      actions1,
      h('div', { class: 'fx-field' }, [h('label', { 'for': 'trk-restore', text: 'Restore from backup' }), file]),
      paste,
      actions2,
      msg
    ]));

    document.addEventListener('bff:tracker-changed', function (e) {
      var id = e && e.detail ? e.detail.id : null;
      if (id && view.rows[id]) syncRow(id);
      else (BFF.programs || []).forEach(function (p) { syncRow(p.id, true); });
      updateSummary();
      applyFilter();
      refreshMailto();
    });
    document.addEventListener('bff:storage-failed', updateSummary);
    function flushAll() { view.flushers.forEach(function (f) { f(); }); }
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushAll(); });
    syncEmailBits();
    document.addEventListener('bff:profile-changed', syncEmailBits);
    updateSummary();
    applyFilter();
  };
  view.show = function () {
    syncEmailBits();
    (BFF.programs || []).forEach(function (p) { syncRow(p.id); });
    view.msg.textContent = '';
    updateSummary();
    applyFilter();
  };
  BFF.views.tracker = { init: view.init, show: view.show };
})();
