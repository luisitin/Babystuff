(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  BFF.views = BFF.views || {};
  var store = BFF.store;

  var STATUSES = ['todo', 'signed-up', 'received', 'skipped'];
  var LABELS = { todo: 'To do', 'signed-up': 'Signed up', received: 'Received', skipped: 'Skipped' };
  var APP = 'baby-freebies-finder';
  var KEY = 'tracker.v1';
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
    try { data = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON, so it cannot be a backup.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That file is not a Baby Freebies Finder backup.');
    if (data.app !== APP) throw new Error('That file is not a Baby Freebies Finder backup (wrong app name).');
    if (data.version !== 1) throw new Error('This backup has an unsupported version (' + String(data.version) + ').');
    var t = data.tracker;
    if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('The backup has no tracker section.');
    var clean = {};
    Object.keys(t).forEach(function (id) {
      var e = t[id];
      if (!e || typeof e !== 'object') throw new Error('Entry "' + id + '" is malformed.');
      if (STATUSES.indexOf(e.status) < 0) throw new Error('Entry "' + id + '" has an unknown status.');
      if (e.note !== undefined && typeof e.note !== 'string') throw new Error('Entry "' + id + '" has a note that is not text.');
      if (e.updatedAt !== undefined && typeof e.updatedAt !== 'string') throw new Error('Entry "' + id + '" has a bad date.');
      clean[id] = { status: e.status, note: e.note || '', updatedAt: e.updatedAt || '' };
    });
    var profile = null;
    if (data.profile !== undefined && data.profile !== null) {
      if (typeof data.profile !== 'object' || Array.isArray(data.profile)) throw new Error('The profile section is malformed.');
      profile = {};
      Object.keys(data.profile).forEach(function (k) {
        if (typeof data.profile[k] === 'string') profile[k] = data.profile[k];
      });
    }
    return { tracker: clean, profile: profile };
  }

  // Merge parsed.tracker into a copy of current. Newer updatedAt wins; ties keep current.
  function mergeImport(current, parsed) {
    var next = {};
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
      if (STATUSES.indexOf(status) < 0) return;
      var s = state();
      var e = entryOf(s, id);
      s[id] = { status: status, note: e.note || '', updatedAt: new Date().toISOString() };
      store.set(KEY, s);
      emit(id);
    },
    getNote: function (id) {
      return entryOf(state(), id).note || '';
    },
    setNote: function (id, text) {
      var s = state();
      var e = entryOf(s, id);
      s[id] = { status: e.status || 'todo', note: String(text), updatedAt: new Date().toISOString() };
      store.set(KEY, s);
      emit(id);
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
    reset: function () {
      store.remove(KEY);
      emit(null);
    },
    exportJSON: function (opts) {
      var profile = opts && opts.includeProfile ? store.get('profile.v1', {}) : null;
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
      store.set(KEY, m.state);
      if (parsed.profile) {
        // Only fill blanks; never overwrite details already on this device.
        var cur = store.get('profile.v1', {}) || {};
        Object.keys(parsed.profile).forEach(function (k) {
          if (!cur[k] && parsed.profile[k]) cur[k] = parsed.profile[k];
        });
        store.set('profile.v1', cur);
        try { document.dispatchEvent(new CustomEvent('bff:profile-changed')); } catch (e) {}
      }
      emit(null);
      return { imported: m.imported, skipped: m.skipped };
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

  var view = { rows: {}, filter: 'all' };

  function plural(n, w) { return n + ' ' + (n === 1 ? w : w.replace(/y$/, 'ie') + 's'); }

  function updateSummary() {
    if (!view.bar) return;
    var c = tracker.counts();
    view.bar.max = Math.max(c.active, 1);
    view.bar.value = Math.min(c.done, view.bar.max);
    view.barText.textContent = c.done + ' of ' + c.active + ' done' + (c.skipped ? ' (' + c.skipped + ' skipped)' : '');
    view.bar.setAttribute('aria-label', c.done + ' of ' + c.active + ' programs done');
    STATUSES.forEach(function (st) { view.countEls[st].textContent = c[st]; });
    view.empty.hidden = !!(BFF.programs && BFF.programs.length);
  }

  function applyFilter() {
    var shown = 0;
    (BFF.programs || []).forEach(function (p) {
      var r = view.rows[p.id];
      if (!r) return;
      var ok = view.filter === 'all' || tracker.getStatus(p.id) === view.filter;
      r.el.hidden = !ok;
      if (ok) shown++;
    });
    view.none.hidden = shown > 0 || !(BFF.programs || []).length;
    Array.prototype.forEach.call(view.tabs, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-filter') === view.filter ? 'true' : 'false');
    });
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
    var el = h('li', { class: 'fx-trk-row' }, [
      h('div', { class: 'fx-trk-head' }, [
        h('div', { class: 'fx-trk-name' }, [h('strong', { text: p.name }), h('span', { class: 'fx-muted', text: p.brand || '' })]),
        link
      ]),
      h('div', { class: 'fx-field' }, [h('label', { 'for': sid, text: 'Status' }), select]),
      h('div', { class: 'fx-field' }, [h('label', { 'for': nid, text: 'Notes' }), note, hint])
    ]);
    var timer = null;
    function flush() {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      tracker.setNote(id, note.value);
      hint.textContent = 'Saved';
      setTimeout(function () { if (hint.textContent === 'Saved') hint.textContent = ''; }, 1500);
    }
    note.addEventListener('input', function () {
      hint.textContent = '';
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, 500);
    });
    note.addEventListener('blur', flush);
    select.addEventListener('change', function () { tracker.setStatus(id, select.value); });
    view.rows[id] = { el: el, select: select, note: note };
    return el;
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  view.init = function (el) {
    view.el = el;
    el.textContent = '';
    if (!el.querySelector('h2')) el.appendChild(h('h2', { tabindex: '-1', text: 'Tracker' }));
    el.classList.add('fx-view');

    view.bar = h('progress', { class: 'fx-progress', value: '0', max: '1' });
    view.barText = h('p', { class: 'fx-progress-text' });
    view.countEls = {};
    var counts = h('ul', { class: 'fx-counts' });
    STATUSES.forEach(function (st) {
      var n = h('strong');
      view.countEls[st] = n;
      counts.appendChild(h('li', {}, [n, h('span', { text: ' ' + LABELS[st] })]));
    });
    view.empty = h('p', { class: 'fx-muted', text: 'No programs loaded.', hidden: '' });
    el.appendChild(h('div', { class: 'fx-card' }, [view.barText, view.bar, counts, view.empty]));

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
      try {
        download('baby-freebies-backup-' + today() + '.json', tracker.exportJSON({ includeProfile: inc.checked }));
        msg.textContent = 'Backup downloaded.';
      } catch (e) { msg.textContent = 'Could not create the backup: ' + e.message; }
    });
    var file = h('input', { type: 'file', id: 'trk-restore', accept: 'application/json,.json', class: 'fx-file' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onerror = function () { msg.textContent = 'Could not read that file.'; };
      fr.onload = function () {
        try {
          var text = String(fr.result);
          var a = tracker.analyzeImport(text);
          var q = 'Restore from "' + f.name + '"?\n\n' + plural(a.imported, 'program entry') + ' will be added or updated (newer changes win).\n' +
            plural(a.skipped, 'entry') + ' will be left as they are because yours are newer.' +
            (a.unknown ? '\n' + plural(a.unknown, 'entry') + ' for programs not in this version will be kept.' : '') +
            (a.hasProfile ? '\nMy info in the file will fill in blank fields only.' : '');
          if (!window.confirm(q)) { msg.textContent = 'Restore cancelled. Nothing changed.'; }
          else {
            var r = tracker.importJSON(text);
            msg.textContent = 'Restored: ' + plural(r.imported, 'entry') + ' imported, ' + r.skipped + ' skipped.';
          }
        } catch (e) { msg.textContent = 'Restore failed: ' + e.message; }
        file.value = '';
      };
      fr.readAsText(f);
    });
    var reset = h('button', { type: 'button', class: 'fx-btn fx-btn--danger', text: 'Reset tracker' });
    reset.addEventListener('click', function () {
      if (window.confirm('Reset the tracker? All statuses and notes on this device will be cleared. My info is not affected.')) {
        tracker.reset();
        msg.textContent = 'Tracker reset.';
      }
    });
    el.appendChild(h('section', { class: 'fx-card', 'aria-labelledby': 'trk-backup-h' }, [
      h('h3', { id: 'trk-backup-h', text: 'Backup' }),
      h('p', { class: 'fx-muted', text: 'Your tracker lives only in this browser. Download a file to keep a copy or move to another device.' }),
      h('div', { class: 'fx-check' }, [inc, h('label', { 'for': 'trk-inc-profile', text: 'Include My info in the backup' })]),
      warn,
      h('div', { class: 'fx-actions' }, [dl]),
      h('div', { class: 'fx-field' }, [h('label', { 'for': 'trk-restore', text: 'Restore from backup' }), file]),
      h('div', { class: 'fx-actions' }, [reset]),
      msg
    ]));

    document.addEventListener('bff:tracker-changed', function (e) {
      var id = e && e.detail ? e.detail.id : null;
      if (id && view.rows[id]) syncRow(id);
      else (BFF.programs || []).forEach(function (p) { syncRow(p.id, true); });
      updateSummary();
      applyFilter();
    });
    updateSummary();
    applyFilter();
  };
  view.show = function () {
    (BFF.programs || []).forEach(function (p) { syncRow(p.id); });
    updateSummary();
    applyFilter();
  };
  BFF.views.tracker = { init: view.init, show: view.show };
})();
