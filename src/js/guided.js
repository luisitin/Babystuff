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
  function detailList(p) {
    var out = [];
    function add(label, value) { if (value) out.push({ label: label, value: value }); }
    var full = [p.firstName, p.lastName].filter(Boolean).join(' ');
    var cityLine = [p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    var oneLine = [p.address1, p.address2, cityLine].filter(Boolean).join(', ');
    var d = dateParts(p.dueDate);
    add('First name', p.firstName);
    add('Last name', p.lastName);
    add('Full name', full);
    add('Email', p.email);
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else done(fallbackCopy(text));
  }

  // ---- state ----
  var el, body, selected = null, run = null, focusHeading = false;

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
  function saveRun() { if (run) store.set(KEY, run); else store.remove(KEY); }

  function initSelection() {
    selected = {};
    progs().forEach(function (p) { if (!handled(p) && defaultOn(p)) selected[p.id] = true; });
  }

  // ---- views ----
  function renderSetup() {
    body.textContent = '';
    body.appendChild(h('p', { class: 'fx-lead', text: 'Pick the programs to work through. For each one you get a sign-up page to open and your details ready to copy. Nothing is ever submitted for you.' }));
    var pr = profile();
    if (!pr.firstName && !pr.email && !pr.address1) {
      var w = h('p', { class: 'fx-warn' }, [document.createTextNode('My info is empty, so there is nothing to copy yet. '), h('a', { href: '#info', text: 'Fill in My info' }), document.createTextNode(' first.')]);
      body.appendChild(w);
    }
    var count = h('p', { class: 'fx-count', role: 'status', 'aria-live': 'polite' });
    var start = h('button', { type: 'button', class: 'fx-btn fx-btn--primary' });
    var boxes = [];
    function refresh() {
      var n = Object.keys(selected).length;
      count.textContent = n + ' of ' + progs().length + ' selected';
      start.textContent = 'Start (' + n + ' program' + (n === 1 ? '' : 's') + ')';
      start.disabled = n === 0;
    }
    function setAll(fn) {
      selected = {};
      progs().forEach(function (p, i) { var on = fn(p); boxes[i].checked = on; if (on) selected[p.id] = true; });
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
    body.appendChild(count);
    var list = h('ul', { class: 'fx-pick' });
    progs().forEach(function (p, i) {
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
        h('span', { class: 'fx-muted', text: (p.brand || '') + ' · ' + cost + extra })
      ])]));
    });
    body.appendChild(list);
    start.addEventListener('click', function () {
      var ids = progs().filter(function (p) { return selected[p.id]; }).map(function (p) { return p.id; });
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

  function go(delta) {
    run.index += delta;
    if (run.index >= run.ids.length) { run.index = run.ids.length - 1; run.step = 'finish'; }
    if (run.index < 0) run.index = 0;
    saveRun();
    focusHeading = true;
    render();
  }

  function startOver() {
    run = null;
    saveRun();
    initSelection();
    focusHeading = true;
    render();
  }

  function renderRun() {
    var p = byId(run.ids[run.index]);
    body.textContent = '';
    var top = h('div', { class: 'fx-run-top' }, [
      h('p', { class: 'fx-run-count', text: (run.index + 1) + ' of ' + run.ids.length }),
      h('progress', { class: 'fx-progress', value: String(run.index + 1), max: String(run.ids.length), 'aria-label': 'Program ' + (run.index + 1) + ' of ' + run.ids.length })
    ]);
    var so = h('button', { type: 'button', class: 'fx-btn fx-btn--link', text: 'Start over' });
    so.addEventListener('click', startOver);
    top.appendChild(so);
    body.appendChild(top);

    var title = h('h3', { class: 'fx-run-title', tabindex: '-1', text: p.name });
    body.appendChild(title);
    var st = T().getStatus(p.id);
    body.appendChild(h('p', { class: 'fx-muted', text: p.brand + ' · Current status: ' + T().LABELS[st] }));
    body.appendChild(h('p', { text: p.whatYouGet }));
    if (p.requirements && p.requirements.length) {
      var rl = BFF.logic && BFF.logic.REQUIREMENT_LABELS ? BFF.logic.REQUIREMENT_LABELS : {};
      body.appendChild(h('p', { class: 'fx-reqs' }, [h('strong', { text: 'You will need: ' }),
        document.createTextNode(p.requirements.map(function (r) { return rl[r] || r; }).join(', '))]));
    }
    if (p.catches) body.appendChild(h('div', { class: 'fx-warn' }, [h('strong', { text: 'Catches: ' }), document.createTextNode(p.catches)]));

    var open = h('button', { type: 'button', class: 'fx-btn fx-btn--primary fx-btn--big', text: 'Open sign-up page ↗' });
    open.addEventListener('click', function () { window.open(p.signupUrl, '_blank', 'noopener,noreferrer'); });
    body.appendChild(open);
    body.appendChild(h('p', { class: 'fx-small' }, [document.createTextNode('Or use the plain link: '),
      h('a', { href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer', text: 'open the sign-up page' })]));

    var details = detailList(profile());
    var dsec = h('section', { class: 'fx-card', 'aria-labelledby': 'gd-details-h' }, [h('h4', { id: 'gd-details-h', text: 'Your details' })]);
    if (!details.length) {
      dsec.appendChild(h('p', { class: 'fx-muted' }, [document.createTextNode('Nothing saved yet. '), h('a', { href: '#info', text: 'Add My info' })]));
    } else {
      var all = h('button', { type: 'button', class: 'fx-btn', text: 'Copy all' });
      all.addEventListener('click', function () {
        copy(details.map(function (d) { return d.label + ': ' + d.value; }).join('\n'), 'all details', all);
      });
      dsec.appendChild(all);
      var dl = h('ul', { class: 'fx-details' });
      details.forEach(function (d) {
        var b = h('button', { type: 'button', class: 'fx-btn fx-btn--small', text: 'Copy' });
        b.setAttribute('aria-label', 'Copy ' + d.label.toLowerCase());
        b.addEventListener('click', function () { copy(d.value, d.label.toLowerCase(), b); });
        dl.appendChild(h('li', {}, [h('span', { class: 'fx-d-label', text: d.label }), h('span', { class: 'fx-d-value', text: d.value }), b]));
      });
      dsec.appendChild(dl);
    }
    body.appendChild(dsec);

    // Problem box
    var pbox = h('div', { class: 'fx-card', hidden: '' });
    var pta = h('textarea', { class: 'fx-textarea', id: 'gd-problem', rows: '2', maxlength: '500' });
    var psave = h('button', { type: 'button', class: 'fx-btn', text: 'Save problem and go on' });
    pbox.appendChild(h('div', { class: 'fx-field' }, [h('label', { 'for': 'gd-problem', text: 'What went wrong? (short note)' }), pta]));
    pbox.appendChild(psave);
    psave.addEventListener('click', function () {
      var txt = pta.value.trim() || 'could not finish';
      var old = T().getNote(p.id);
      T().setNote(p.id, 'Problem: ' + txt + (old ? '\n' + old : ''));
      go(1);
    });

    var done = h('button', { type: 'button', class: 'fx-btn fx-btn--primary', text: 'Done' });
    done.addEventListener('click', function () { T().setStatus(p.id, 'signed-up'); go(1); });
    var skip = h('button', { type: 'button', class: 'fx-btn', text: 'Skip' });
    skip.addEventListener('click', function () { T().setStatus(p.id, 'skipped'); go(1); });
    var prob = h('button', { type: 'button', class: 'fx-btn', text: 'Problem', 'aria-expanded': 'false' });
    prob.addEventListener('click', function () {
      pbox.hidden = !pbox.hidden;
      prob.setAttribute('aria-expanded', pbox.hidden ? 'false' : 'true');
      if (!pbox.hidden) pta.focus();
    });
    var back = h('button', { type: 'button', class: 'fx-btn', text: 'Back' });
    back.disabled = run.index === 0;
    back.addEventListener('click', function () { go(-1); });
    var next = h('button', { type: 'button', class: 'fx-btn', text: run.index === run.ids.length - 1 ? 'Finish' : 'Next' });
    next.addEventListener('click', function () { go(1); });

    body.appendChild(h('div', { class: 'fx-actions' }, [done, skip, prob]));
    body.appendChild(pbox);
    body.appendChild(h('div', { class: 'fx-actions' }, [back, next]));
    if (focusHeading) title.focus();
  }

  function renderFinish() {
    body.textContent = '';
    var doneL = [], skipL = [], probL = [];
    run.ids.forEach(function (id) {
      var p = byId(id), st = T().getStatus(id);
      if (st === 'signed-up' || st === 'received') doneL.push(p);
      else if (st === 'skipped') skipL.push(p);
      else if (/^Problem:/.test(T().getNote(id))) probL.push(p);
    });
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
    else { if (!selected) initSelection(); renderSetup(); }
    focusHeading = false;
  }

  BFF.views.guided = {
    init: function (root) {
      el = root;
      el.textContent = '';
      el.classList.add('fx-view');
      if (!el.querySelector('h2')) el.appendChild(h('h2', { tabindex: '-1', text: 'Do it for me' }));
      live = h('div', { class: 'fx-sr', role: 'status', 'aria-live': 'polite' });
      body = h('div', { class: 'fx-guided' });
      el.appendChild(body);
      el.appendChild(live);
      run = loadRun();
      render();
    },
    show: function () {
      if (!run) initSelection();
      render();
    }
  };
})();
