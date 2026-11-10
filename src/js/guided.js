(function () {
  'use strict';
  var BFF = (window.BFF = window.BFF || {});
  BFF.views = BFF.views || {};
  var store = BFF.store;
  var KEY = 'guided.v1';

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
  function T() { return BFF.tracker; }
  function progs() { return BFF.programs || []; }
  function byId(id) {
    var l = progs();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function trulyFree(p) {
    if (BFF.logic && BFF.logic.isTrulyFree) return BFF.logic.isTrulyFree(p);
    var r = p.requirements || [];
    return p.costToClaim === 'free' && r.indexOf('purchase') < 0 && r.indexOf('membership') < 0;
  }
  function defaultOn(p) {
    if (BFF.logic && BFF.logic.guidedDefault) return BFF.logic.guidedDefault(p);
    var r = p.requirements || [];
    return trulyFree(p) && p.category !== 'health-benefits' && p.category !== 'assistance' && r.indexOf('eligibility') < 0 && r.indexOf('insurance') < 0;
  }
  var NO_FREE = 'Nothing arrives free without a purchase or a win.';
  // Best first. Falls back to the data order when the shared logic is missing.
  function ranked(list) {
    return BFF.logic && BFF.logic.rankPrograms ? BFF.logic.rankPrograms(list) : list.slice();
  }
  function verdictLabel(p) {
    var L = BFF.logic;
    if (!L || !L.verdict || !L.VERDICTS) return '';
    var v = L.verdict(p);
    for (var i = 0; i < L.VERDICTS.length; i++) if (L.VERDICTS[i].id === v) return L.VERDICTS[i].label;
    return '';
  }
  function worthLine(p) {
    var vl = verdictLabel(p);
    var vt = BFF.logic && BFF.logic.valueText ? BFF.logic.valueText(p) : '';
    return [vl, vt].filter(Boolean).join(' \u00b7 ');
  }
  function freeLine(p) { return p.freeStuff ? p.freeStuff : NO_FREE; }
  function handled(p) { return T().getStatus(p.id) !== 'todo'; }
  function profile() {
    var p = store.get('profile.v1', {});
    return p && typeof p === 'object' ? p : {};
  }

  // ---- details to copy ----
  function dateParts(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? { iso: s, us: m[2] + '/' + m[3] + '/' + m[1] } : null;
  }
  // The tagged address for this program, or '' when plus tags are off or unsupported for this provider.
  function taggedEmail(pr, prog) {
    var E = BFF.email;
    if (!E || !pr.usePlusTags || !prog || E.supportsPlus(pr.email) === false) return '';
    if (E.inEmailFeatures && !E.inEmailFeatures(prog)) return '';
    return E.plusAddress(pr.email, BFF.plusTags ? BFF.plusTags.forProgram(prog) : E.tagFor(prog, progs()));
  }
  function detailList(p, prog) {
    var out = [];
    function add(label, value) { if (value) out.push({ label: label, value: value }); }
    var full = [p.firstName, p.lastName].filter(Boolean).join(' ');
    var cityLine = [p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var oneLine = [p.address1, p.address2, cityLine].filter(Boolean).join(', ');
    var d = dateParts(p.dueDate);
    add('First name', p.firstName);
    add('Last name', p.lastName);
    add('Full name', full);
    var tagged = taggedEmail(p, prog);
    if (tagged) add('Email for this program', tagged);
    add(tagged ? 'Email (plain)' : 'Email', p.email);
    add('Phone', p.phone);
    add('Address line 1', p.address1);
    add('Address line 2', p.address2);
    add('City', p.city);
    add('State', p.state);
    add('ZIP', p.zip);
    add('Full address', oneLine);
    if (d) {
      add('Due date (MM/DD/YYYY)', d.us);
      add('Due date (YYYY-MM-DD)', d.iso);
    } else add('Due date', p.dueDate);
    return out;
  }

  // ---- clipboard ----
  var live = null;
  function announce(msg) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }
  function fallbackCopy(text) {
    var ta = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', readonly: '' });
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  }
  // The artifact frame cannot open pages from script, so nothing here depends on window.open there.
  function canPopup() { return !(BFF.host && BFF.host.canPopup === false); }
  function copy(text, label, btn) {
    function done(ok) {
      announce(ok ? 'Copied ' + label : 'Could not copy ' + label + '. Select the text and copy it manually.');
      if (ok && btn) {
        var old = btn.getAttribute('data-label') || btn.textContent;
        btn.setAttribute('data-label', old);
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = old; }, 1200);
      }
    }
    if (BFF.host && BFF.host.copyText) BFF.host.copyText(text).then(done);
    else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else done(fallbackCopy(text));
  }

  // ---- state ----
  var el, body, selected = null, run = null, focusHeading = false, focusOpen = false;
  var actions = null; // buttons of the program on screen, for keyboard shortcuts
  var preorder = null; // ids in the order the Directory gave them; null means best first
  var undoInfo = null; // {id, entry, index, text}: lets the last Done or Skip be taken back
  var saved0 = store.get(KEY, null);
  var autoOpen = !(saved0 && saved0.autoOpenNext === false); // only used where canPopup() is true
  var shortcutsOn = !!(saved0 && saved0.shortcuts === true);

  function loadRun() {
    var r = store.get(KEY, null);
    if (r && Array.isArray(r.ids) && r.ids.length && (r.step === 'run' || r.step === 'finish')) {
      r.ids = r.ids.filter(function (id) { return !!byId(id); });
      if (!r.ids.length) return null;
      r.index = Math.max(0, Math.min(r.index | 0, r.ids.length - 1));
      return r;
    }
    return null;
  }
  // guided.v1 holds the current run plus the auto-open preference. Between runs it keeps only the preference.
  function saveRun() {
    if (run) { run.autoOpenNext = autoOpen; run.shortcuts = shortcutsOn; store.set(KEY, run); }
    else if (autoOpen && !shortcutsOn) store.remove(KEY);
    else store.set(KEY, { autoOpenNext: autoOpen, shortcuts: shortcutsOn });
  }
  // Open a program's page once per run. Returns '' (not needed), 'opened' or 'blocked'.
  function openOnce(prog) {
    if (!run) return '';
    run.opened = Array.isArray(run.opened) ? run.opened : [];
    if (run.opened.indexOf(prog.id) >= 0) return '';
    // No "noopener" feature here: it makes window.open return null always, hiding blocked popups.
    // The opener link is cut right after instead, and the page sends no referrer.
    var w = window.open(prog.signupUrl, '_blank');
    if (!w) return 'blocked';
    try { w.opener = null; } catch (e) {}
    run.opened.push(prog.id);
    return 'opened';
  }
  function shortcutToggle() {
    var cb = h('input', { type: 'checkbox', id: 'gd-shortcuts' });
    cb.checked = shortcutsOn;
    cb.addEventListener('change', function () {
      shortcutsOn = cb.checked;
      saveRun();
      announce(shortcutsOn ? 'Single-key shortcuts are on.' : 'Single-key shortcuts are off.');
    });
    return h('div', { class: 'fx-check' }, [cb, h('label', { 'for': 'gd-shortcuts', text: 'Enable single-key shortcuts' })]);
  }
  function autoToggle(idSuffix) {
    if (!canPopup()) return null; // the option cannot work here, so it is not offered
    var id = 'gd-auto-' + idSuffix;
    var cb = h('input', { type: 'checkbox', id: id });
    cb.checked = autoOpen;
    cb.addEventListener('change', function () {
      autoOpen = cb.checked;
      saveRun();
      announce(autoOpen ? 'Will open the next sign-up page when you tap Done or Skip.' : 'Will not open pages automatically.');
    });
    return h('div', { class: 'fx-check' }, [cb, h('label', { 'for': id, text: 'When I tap Done or Skip, open the next sign-up page' })]);
  }

  // Programs for other states are left out of the list unless the person chose to show them.
  function hiddenByState(p) {
    var L = BFF.logic;
    if (!L || !L.hiddenByState) return false;
    var prefs = store.get('prefs.v1', {});
    if (prefs && typeof prefs === 'object' && prefs.showOtherStates) return false;
    var st = profile().state;
    return L.hiddenByState(p, typeof st === 'string' ? st : '');
  }
  function setupProgs() {
    return progs().filter(function (p) { return !hiddenByState(p) || !!(selected && selected[p.id]); });
  }

  function initSelection() {
    selected = {};
    preorder = null;
    progs().forEach(function (p) { if (!handled(p) && !hiddenByState(p) && defaultOn(p)) selected[p.id] = true; });
  }

  // ---- views ----
  function renderSetup() {
    body.textContent = '';
    body.appendChild(h('p', { class: 'fx-lead', text: 'Pick the programs to work through. For each one you get a sign-up page to open and your details ready to copy. Nothing is ever submitted for you.' }));
    body.appendChild(phoneHint());
    var pr = profile();
    if (!pr.firstName && !pr.email && !pr.address1) {
      var w = h('p', { class: 'fx-warn' }, [document.createTextNode('My info is empty, so there is nothing to copy yet. '), h('a', { href: '#info', text: 'Fill in My info' }), document.createTextNode(' first.')]);
      body.appendChild(w);
    }
    var count = h('p', { class: 'fx-count', role: 'status', 'aria-live': 'polite' });
    var start = h('button', { type: 'button', class: 'fx-btn fx-btn--primary' });
    var boxes = [];
    var shownList = ranked(setupProgs());
    function refresh() {
      var n = Object.keys(selected).length;
      count.textContent = n + ' of ' + shownList.length + ' selected';
      start.textContent = 'Start (' + n + ' program' + (n === 1 ? '' : 's') + ')';
      start.disabled = n === 0;
    }
    function setAll(fn) {
      selected = {};
      shownList.forEach(function (p, i) { var on = fn(p); boxes[i].checked = on; if (on) selected[p.id] = true; });
      refresh();
    }
    var bar = h('div', { class: 'fx-actions' });
    [['Select all', function () { return true; }], ['Select none', function () { return false; }],
     ['Truly free only', function (p) { return !handled(p) && trulyFree(p); }]].forEach(function (b) {
      var btn = h('button', { type: 'button', class: 'fx-btn', text: b[0] });
      btn.addEventListener('click', function () { setAll(b[1]); });
      bar.appendChild(btn);
    });
    body.appendChild(bar);
    var at = autoToggle('setup');
    if (at) body.appendChild(at);
    body.appendChild(count);
    var list = h('ul', { class: 'fx-pick' });
    shownList.forEach(function (p, i) {
      var id = 'gd-pick-' + p.id;
      var cb = h('input', { type: 'checkbox', id: id });
      cb.checked = !!selected[p.id];
      cb.addEventListener('change', function () {
        if (cb.checked) selected[p.id] = true; else delete selected[p.id];
        refresh();
      });
      boxes.push(cb);
      var st = T().getStatus(p.id);
      var extra = st !== 'todo' ? ' · ' + T().LABELS[st] : '';
      var cost = BFF.logic && BFF.logic.COST_LABELS ? BFF.logic.COST_LABELS[p.costToClaim] || p.costToClaim : p.costToClaim;
      list.appendChild(h('li', { class: 'fx-pick-item' }, [cb, h('label', { 'for': id }, [
        h('strong', { text: p.name }),
        h('span', { class: 'fx-muted', text: (p.brand || '') + ' · ' + cost + extra }),
        h('span', { class: 'fx-small', text: worthLine(p) }),
        h('span', { class: 'fx-small', text: freeLine(p) })
      ])]));
    });
    body.appendChild(list);
    start.addEventListener('click', function () {
      var chosen = ranked(progs().filter(function (p) { return selected[p.id]; })).map(function (p) { return p.id; });
      var ids = chosen;
      if (preorder) {
        var first = preorder.filter(function (id) { return selected[id]; });
        var seen = {};
        first.forEach(function (id) { seen[id] = true; });
        ids = first.concat(chosen.filter(function (id) { return !seen[id]; }));
      }
      if (!ids.length) return;
      run = { ids: ids, index: 0, step: 'run' };
      saveRun();
      focusHeading = true;
      render();
    });
    body.appendChild(h('div', { class: 'fx-actions fx-sticky' }, [start]));
    refresh();
  }

  function listBlock(title, items, cls) {
    return h('div', { class: cls || 'fx-block' }, [h('h4', { text: title })].concat(items));
  }

  function go(delta, keepUndo, focus) {
    if (!keepUndo) undoInfo = null;
    focusOpen = focus === 'open';
    run.index += delta;
    if (run.index >= run.ids.length) { run.index = run.ids.length - 1; run.step = 'finish'; }
    if (run.index < 0) run.index = 0;
    saveRun();
    focusHeading = true;
    render();
  }

  function startOver() {
    undoInfo = null;
    run = null;
    saveRun();
    initSelection();
    focusHeading = true;
    render();
  }

  var SAVE_FAIL = 'Could not save on this device (storage is full or blocked). Your progress is kept only until you close this page.';

  // "Undo" after Done or Skip: restores that program's status and note and returns to it.
  function undoBar() {
    if (!undoInfo) return null;
    var u = undoInfo;
    var btn = h('button', { type: 'button', class: 'fx-btn fx-btn--small', text: 'Undo' });
    btn.setAttribute('aria-label', 'Undo: ' + u.text);
    btn.addEventListener('click', function () {
      undoInfo = null;
      if (!T().restoreEntry(u.id, u.entry)) announce(SAVE_FAIL);
      run.index = Math.max(0, Math.min(u.index, run.ids.length - 1));
      run.step = 'run';
      saveRun();
      focusHeading = true;
      render();
      announce('Undone. Back on ' + (byId(u.id) ? byId(u.id).name : 'the program') + '.');
    });
    return h('div', { class: 'fx-undo' }, [h('span', { class: 'fx-small', text: u.text }), btn]);
  }

  function phoneHint() {
    return h('p', { class: 'fx-small fx-tight' }, [document.createTextNode('Filling on your phone? '), h('a', { href: '#info', text: 'Set up the fill script in My info' }), document.createTextNode('.')]);
  }

  function renderRun() {
    var p = byId(run.ids[run.index]);
    body.textContent = '';
    actions = {};
    var st = T().getStatus(p.id);
    var last = run.index === run.ids.length - 1;

    // (a) progress + name
    var next = h('button', { type: 'button', class: 'fx-btn fx-btn--link', text: last ? 'Finish ›' : 'Next ›' });
    next.setAttribute('aria-label', last ? 'Finish without changing this program' : 'Next program without changing this one');
    next.addEventListener('click', function () { go(1); });
    body.appendChild(h('div', { class: 'fx-run-top' }, [
      h('p', { class: 'fx-run-count', text: (run.index + 1) + ' of ' + run.ids.length }),
      h('progress', { class: 'fx-progress', value: String(run.index + 1), max: String(run.ids.length), 'aria-label': 'Program ' + (run.index + 1) + ' of ' + run.ids.length }),
      next
    ]));
    if (!store.persistent) body.appendChild(h('p', { class: 'fx-warn', role: 'alert', text: SAVE_FAIL }));
    var ub = undoBar();
    if (ub) body.appendChild(ub);
    var title = h('h3', { class: 'fx-run-title', tabindex: '-1', text: p.name });
    body.appendChild(title);
    body.appendChild(h('p', { class: 'fx-muted fx-tight', text: p.brand + ' · Status: ' + T().LABELS[st] }));
    var wl = worthLine(p);
    if (wl) body.appendChild(h('p', { class: 'fx-small fx-tight', text: wl }));
    body.appendChild(h('p', { class: 'fx-small fx-tight', text: freeLine(p) }));

    // (b) open link: a real anchor, so it works wherever links work (no window.open)
    var open = h('a', { class: 'fx-btn fx-btn--primary fx-btn--big', href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Open sign-up page \u2197' });
    open.setAttribute('aria-label', 'Open sign-up page for ' + p.name + ' (opens in a new tab)');
    open.addEventListener('click', function () {
      run.opened = Array.isArray(run.opened) ? run.opened : [];
      if (run.opened.indexOf(p.id) < 0) { run.opened.push(p.id); saveRun(); }
      announce('Opening the ' + p.name + ' sign-up page in a new tab.');
    });
    actions.open = open;
    body.appendChild(open);
    body.appendChild(phoneHint());

    // (c) details
    var details = detailList(profile(), p);
    var dsec = h('section', { class: 'fx-card fx-card--tight', 'aria-labelledby': 'gd-details-h' }, [h('h4', { id: 'gd-details-h', text: 'Your details' })]);
    if (!details.length) {
      dsec.appendChild(h('p', { class: 'fx-muted' }, [document.createTextNode('Nothing saved yet. '), h('a', { href: '#info', text: 'Add My info' })]));
    } else {
      var all = h('button', { type: 'button', class: 'fx-btn fx-btn--small', text: 'Copy all' });
      all.addEventListener('click', function () {
        copy(details.map(function (d) { return d.label + ': ' + d.value; }).join('\n'), 'all details', all);
      });
      actions.copyAll = all;
      dsec.appendChild(all);
      var dl = h('ul', { class: 'fx-details' });
      details.forEach(function (d) {
        var b = h('button', { type: 'button', class: 'fx-btn fx-btn--small', text: d.value });
        b.setAttribute('aria-label', 'Copy ' + d.label.toLowerCase() + ': ' + d.value);
        b.title = d.label;
        b.addEventListener('click', function () { copy(d.value, d.label.toLowerCase(), b); });
        dl.appendChild(h('li', {}, [h('span', { class: 'fx-d-label', text: d.label }), b]));
      });
      dsec.appendChild(dl);
    }
    body.appendChild(dsec);

    // (d) catches line + about
    if (p.catches) body.appendChild(h('p', { class: 'fx-warn fx-warn--line', text: 'Catches: ' + p.catches }));
    var about = h('details', { class: 'fx-about' }, [h('summary', { text: 'About this program' }), h('p', { text: p.whatYouGet })]);
    if (p.requirements && p.requirements.length) {
      var rl = BFF.logic && BFF.logic.REQUIREMENT_LABELS ? BFF.logic.REQUIREMENT_LABELS : {};
      about.appendChild(h('p', {}, [h('strong', { text: 'You will need: ' }), document.createTextNode(p.requirements.map(function (r) { return rl[r] || r; }).join(', '))]));
    }
    if (p.catches) about.appendChild(h('p', { class: 'fx-warn' }, [h('strong', { text: 'Catches: ' }), document.createTextNode(p.catches)]));
    if (p.notes) about.appendChild(h('p', {}, [h('strong', { text: 'Notes: ' }), document.createTextNode(p.notes)]));
    body.appendChild(about);
    var ar = autoToggle('run');
    if (ar) body.appendChild(ar);
    body.appendChild(h('details', { class: 'fx-about fx-shortcuts' }, [
      h('summary', { text: 'Shortcuts' }),
      shortcutToggle(),
      h('p', { class: 'fx-small', text: 'When on, press a key while you are not typing in a field.' }),
      h('ul', { class: 'fx-keys' }, [['O', 'Open the sign-up page'], ['C', 'Copy all details'], ['D', 'Done and go on'], ['S', 'Skip'],
        ['P', 'Report a problem'], ['B', 'Back'], ['N', 'Next without changing']].map(function (k) {
        return h('li', {}, [h('kbd', { text: k[0] }), document.createTextNode(' ' + k[1])]);
      }))
    ]));
    var so = h('button', { type: 'button', class: 'fx-btn fx-btn--link', text: 'Start over' });
    so.addEventListener('click', function () {
      if (!BFF.ui || !BFF.ui.confirm) { startOver(); return; }
      BFF.ui.confirm({
        after: so.parentNode, returnTo: so, confirmLabel: 'Start over',
        message: 'Start over? Your place in this run is lost. Statuses you already set are kept.',
        onConfirm: startOver
      });
    });
    body.appendChild(so);

    // (e) sticky action bar
    var pbox = h('div', { class: 'fx-problem', hidden: '' });
    var pta = h('textarea', { class: 'fx-textarea', id: 'gd-problem', rows: '2', maxlength: '500' });
    var psave = h('button', { type: 'button', class: 'fx-btn', text: 'Save problem and go on' });
    pbox.appendChild(h('div', { class: 'fx-field' }, [h('label', { 'for': 'gd-problem', text: 'What went wrong? (short note)' }), pta]));
    pbox.appendChild(psave);
    function saved(ok) { if (!ok) announce(SAVE_FAIL); }
    psave.addEventListener('click', function () {
      var txt = pta.value.trim() || 'could not finish';
      var old = T().getNote(p.id);
      saved(T().setNote(p.id, 'Problem: ' + txt + (old ? '\n' + old : '')));
      go(1);
    });
    // Done and Skip share one path. Opening the next page happens inside the click (a user gesture).
    function advance(kind) {
      var prev = T().getEntry(p.id);
      if (kind === 'done') { if (st === 'todo' || st === 'skipped') saved(T().setStatus(p.id, 'signed-up')); }
      else if (st === 'todo') saved(T().setStatus(p.id, 'skipped'));
      var msg = p.name + (kind === 'done' ? ' marked as signed up.' : ' skipped.');
      var nextP = last ? null : byId(run.ids[run.index + 1]);
      if (autoOpen && canPopup() && nextP) {
        var r = openOnce(nextP);
        if (r === 'opened') msg += ' Opened the ' + nextP.name + ' sign-up page in a new tab.';
        else if (r === 'blocked') msg += ' Your browser blocked the popup, so use the Open sign-up page link.';
      }
      if (nextP) msg += ' Next: ' + nextP.name + '. Focus is on its Open sign-up page link.';
      undoInfo = { id: p.id, entry: prev, index: run.index, text: msg };
      go(1, true, nextP ? 'open' : '');
      announce(msg + ' Undo is available.');
    }
    var done = h('button', { type: 'button', class: 'fx-btn fx-btn--primary', text: 'Done' });
    done.addEventListener('click', function () { advance('done'); });
    actions.done = done;
    var skip = h('button', { type: 'button', class: 'fx-btn', text: 'Skip' });
    skip.addEventListener('click', function () { advance('skip'); });
    actions.skip = skip;
    var prob = h('button', { type: 'button', class: 'fx-btn', text: 'Problem', 'aria-expanded': 'false' });
    prob.addEventListener('click', function () {
      pbox.hidden = !pbox.hidden;
      prob.setAttribute('aria-expanded', pbox.hidden ? 'false' : 'true');
      if (!pbox.hidden) pta.focus();
    });
    actions.prob = prob;
    var back = h('button', { type: 'button', class: 'fx-btn', text: 'Back' });
    back.disabled = run.index === 0;
    back.addEventListener('click', function () { go(-1); });
    actions.back = back;
    actions.next = next;
    body.appendChild(h('div', { class: 'fx-actionbar fx-sticky' }, [pbox, h('div', { class: 'fx-actionbar-row' }, [done, skip, prob, back])]));
    if (focusOpen && actions.open) actions.open.focus();
    else if (focusHeading) title.focus();
    focusOpen = false;
  }

  function renderFinish() {
    body.textContent = '';
    actions = null;
    var doneL = [], skipL = [], probL = [];
    run.ids.forEach(function (id) {
      var p = byId(id), st = T().getStatus(id);
      if (st === 'signed-up' || st === 'received') doneL.push(p);
      else if (st === 'skipped') skipL.push(p);
      else if (/^Problem:/.test(T().getNote(id))) probL.push(p);
    });
    var ub = undoBar();
    if (ub) body.appendChild(ub);
    var title = h('h3', { class: 'fx-run-title', tabindex: '-1', text: 'All done for now' });
    body.appendChild(title);
    body.appendChild(h('p', { class: 'fx-lead', text: doneL.length + ' signed up, ' + skipL.length + ' skipped, ' + probL.length + ' with problems.' }));
    function sec(name, list) {
      if (!list.length) return;
      var ul = h('ul');
      list.forEach(function (p) { ul.appendChild(h('li', { text: p.name })); });
      body.appendChild(h('div', { class: 'fx-block' }, [h('h4', { text: name + ' (' + list.length + ')' }), ul]));
    }
    sec('Signed up', doneL); sec('Skipped', skipL); sec('Problems', probL);
    body.appendChild(h('p', { class: 'fx-muted', text: 'Watch your inbox for confirmation emails, and mark programs as Received in the Tracker when your freebies arrive.' }));
    var again = h('button', { type: 'button', class: 'fx-btn', text: 'Start over' });
    again.addEventListener('click', startOver);
    var bk = h('button', { type: 'button', class: 'fx-btn', text: 'Back to last program' });
    bk.addEventListener('click', function () { run.step = 'run'; saveRun(); focusHeading = true; render(); });
    body.appendChild(h('div', { class: 'fx-actions' }, [h('a', { class: 'fx-btn fx-btn--primary', href: '#tracker', text: 'Open the Tracker' }), bk, again]));
    if (focusHeading) title.focus();
  }

  function render() {
    if (!body) return;
    if (run && run.step === 'run') renderRun();
    else if (run && run.step === 'finish') renderFinish();
    else { actions = null; if (!selected) initSelection(); renderSetup(); }
    focusHeading = false;
  }

  // ---- keyboard shortcuts ----
  var KEYS = { o: 'open', c: 'copyAll', d: 'done', s: 'skip', p: 'prob', b: 'back', n: 'next' };
  function onKey(e) {
    if (!shortcutsOn || e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!el || el.hidden || !run || run.step !== 'run' || !actions) return;
    var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : '';
    var itype = tag === 'input' ? String(t.type || '').toLowerCase() : '';
    var typing = tag === 'textarea' || tag === 'select' || (t && t.isContentEditable) ||
      (tag === 'input' && ['checkbox', 'radio', 'button', 'submit', 'reset'].indexOf(itype) < 0);
    if (typing) return; // text fields keep their own keys; checkboxes and buttons do not type letters
    var name = e.key && /^[a-zA-Z]$/.test(e.key) ? KEYS[e.key.toLowerCase()] : null;
    if (!name) return;
    var btn = actions[name];
    if (!btn) { announce(name === 'copyAll' ? 'Nothing to copy. Add My info first.' : 'That is not available here.'); return; }
    if (btn.disabled) { announce('That is not available here.'); return; }
    e.preventDefault();
    btn.click();
  }

  // Set the setup selection (for example from the directory's filtered list). Any run in progress is replaced.
  BFF.guided = {
    // Position of a run in progress, or null.
    runInfo: function () { return run && run.step === 'run' ? { index: run.index + 1, total: run.ids.length } : null; },
    preselect: function (ids) {
      var valid = {};
      (Array.isArray(ids) ? ids : []).forEach(function (id) { if (byId(id)) valid[id] = true; });
      selected = valid;
      preorder = (Array.isArray(ids) ? ids : []).filter(function (id, i, a) { return valid[id] && a.indexOf(id) === i; });
      undoInfo = null;
      if (run) { run = null; saveRun(); }
      if (body) render();
    }
  };

  BFF.views.guided = {
    init: function (root) {
      el = root;
      el.classList.add('fx-view');
      if (!el.querySelector('h2')) el.appendChild(h('h2', { tabindex: '-1', text: 'Do it for me' }));
      live = h('div', { class: 'fx-sr', role: 'status', 'aria-live': 'polite' });
      body = h('div', { class: 'fx-guided' });
      el.appendChild(body);
      el.appendChild(live);
      run = loadRun();
      if (run && run.autoOpenNext === false) autoOpen = false;
      if (run && run.shortcuts === true) shortcutsOn = true;
      document.addEventListener('keydown', onKey);
      render();
    },
    show: function () {
      render();
    }
  };
})();
