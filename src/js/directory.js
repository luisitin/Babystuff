(function () {
  'use strict';
  window.BFF = window.BFF || {};
  BFF.views = BFF.views || {};

  var L = BFF.logic;
  var DEFAULTS = { query: '', category: '', offer: '', trulyFree: false, openToAll: false, emailOnly: false, needsRegistry: false, sort: 'best' };
  var SORTS = [
    ['best', 'Best value first'],
    ['when', 'When to do it'],
    ['name', 'Name A-Z'],
    ['verified', 'Recently verified'],
    ['category', 'Category'],
    ['confidence', 'Confidence']
  ];
  var STATUSES = [['todo', 'To do'], ['signed-up', 'Signed up'], ['received', 'Received'], ['skipped', 'Skipped']];

  var VERDICT_NOTES = {
    top: 'Free, and worth the most. Claim these first.',
    good: 'Free, and worth a few minutes of your time.',
    small: 'Free, but small or hard to put a price on.',
    conditional: 'Needs a purchase, a fee or a membership, or gives coupons or points. Skip unless you would buy anyway.',
    longshot: 'Prize draws and testing panels. Most people get nothing.'
  };
  var WHEN_NOTES = {
    pregnancy: 'Sign up as soon as you can.',
    'late-pregnancy': 'Best started in the last 4 to 8 weeks before the due date.',
    'after-birth': 'These need the baby to be born first.',
    anytime: 'No best time. Do these whenever you like.',
    none: 'The best time is not listed.'
  };
  var TRULY_FREE_LINE = 'Truly free: real products or samples at no cost. No purchase, no fee, not a prize draw.';

  var state = Object.assign({}, DEFAULTS);
  var showOther = false;
  var profile = {};
  var els = {};
  var shownIds = [];
  var uid = 0;

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function loadPrefs() {
    var prefs = BFF.store ? BFF.store.get('prefs.v1', {}) : {};
    var f = prefs && prefs.filters;
    if (f && typeof f === 'object') {
      state.query = typeof f.query === 'string' ? f.query : '';
      state.category = L.CATEGORIES.some(function (c) { return c.id === f.category; }) ? f.category : '';
      state.offer = typeof f.offer === 'string' && L.OFFER_LABELS[f.offer] ? f.offer : '';
      state.openToAll = !!f.openToAll;
      state.trulyFree = !!f.trulyFree;
      state.emailOnly = !!f.emailOnly;
      state.needsRegistry = !!f.needsRegistry;
      state.sort = f.sort === 'recommended' ? 'best' : SORTS.some(function (s) { return s[0] === f.sort; }) ? f.sort : 'best';
    }
    showOther = !!(prefs && prefs.showOtherStates);
  }
  function savePrefs() {
    if (!BFF.store) return;
    var prefs = BFF.store.get('prefs.v1', {});
    if (!prefs || typeof prefs !== 'object') prefs = {};
    prefs.filters = Object.assign({}, state);
    prefs.showOtherStates = showOther;
    BFF.store.set('prefs.v1', prefs);
  }

  function readProfile() {
    var p = BFF.store ? BFF.store.get('profile.v1', {}) : {};
    profile = p && typeof p === 'object' ? p : {};
  }
  function profState() {
    var s = typeof profile.state === 'string' ? profile.state.trim() : '';
    return s;
  }

  function programs() { return Array.isArray(BFF.programs) ? BFF.programs : []; }

  function buildControls(root) {
    var all = programs();
    var counts = {};
    all.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    var id = 'dir' + (++uid);
    els.search = h('input', { type: 'search', id: id + '-q', autocomplete: 'off', placeholder: 'Name, brand or what you get' });
    els.category = h('select', { id: id + '-cat' }, [h('option', { value: '', text: 'All categories' })]
      .concat(L.CATEGORIES.map(function (c) { return h('option', { value: c.id, text: c.label + ' (' + (counts[c.id] || 0) + ')' }); })));
    els.offer = h('select', { id: id + '-offer' }, [h('option', { value: '', text: 'Anything' })]
      .concat(Object.keys(L.OFFER_LABELS).map(function (k) { return h('option', { value: k, text: L.OFFER_LABELS[k] }); })));
    els.sort = h('select', { id: id + '-sort' }, SORTS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));

    function check(key, label) {
      var input = h('input', { type: 'checkbox' });
      input.addEventListener('change', function () { state[key] = input.checked; savePrefs(); render(); });
      els[key] = input;
      return h('label', { class: 'chip-toggle' }, [input, h('span', { text: label })]);
    }

    els.clear = h('button', { type: 'button', class: 'btn btn-small', text: 'Clear filters' });
    els.clear.addEventListener('click', clearFilters);

    var timer = null;
    els.search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.query = els.search.value; savePrefs(); render(); }, 150);
    });
    els.category.addEventListener('change', function () { state.category = els.category.value; savePrefs(); render(); });
    els.offer.addEventListener('change', function () { state.offer = els.offer.value; savePrefs(); render(); });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; savePrefs(); render(); });

    var filters = h('div', { class: 'filters', role: 'search', 'aria-label': 'Filter programs' }, [
      h('div', { class: 'field' }, [h('label', { for: id + '-q', text: 'Search' }), els.search]),
      h('div', { class: 'field-row' }, [
        h('div', { class: 'field' }, [h('label', { for: id + '-sort', text: 'Sort by' }), els.sort]),
        h('div', { class: 'field' }, [h('label', { for: id + '-offer', text: 'What you get' }), els.offer]),
        h('div', { class: 'field' }, [h('label', { for: id + '-cat', text: 'Category' }), els.category])
      ]),
      h('div', { class: 'checks' }, [
        check('trulyFree', 'Truly free'),
        check('openToAll', 'Open to everyone'),
        check('emailOnly', 'Email only'),
        check('needsRegistry', 'Needs a registry')
      ])
    ]);
    els.tfNote = h('p', { class: 'dir-note', hidden: true, text: TRULY_FREE_LINE });
    els.stateBox = h('div', { class: 'dir-state', hidden: true });
    els.summary = h('section', { class: 'dir-summary', 'aria-label': 'Summary' });

    els.count = h('p', { class: 'result-count', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var resultRow = h('div', { class: 'result-row' }, [els.count, els.clear]);
    els.list = h('div', { class: 'dir-groups' });
    els.empty = h('div', { class: 'empty', hidden: true }, [
      h('p', { text: 'No programs match those filters.' })
    ]);
    var emptyClear = h('button', { type: 'button', class: 'btn btn-primary', text: 'Clear filters' });
    emptyClear.addEventListener('click', clearFilters);
    els.empty.appendChild(emptyClear);

    els.start = h('button', { type: 'button', class: 'btn btn-primary start-run' });
    els.start.addEventListener('click', function () {
      if (!shownIds.length || !BFF.guided) return;
      var ids = shownIds.slice();
      function go() { BFF.guided.preselect(ids); if (BFF.nav) BFF.nav.go('guided'); else location.hash = '#guided'; }
      var ri = BFF.guided.runInfo && BFF.guided.runInfo();
      if (!ri || !BFF.ui) { go(); return; }
      BFF.ui.confirm({
        after: els.start.parentNode, returnTo: els.start, confirmLabel: 'Replace run',
        message: 'Replace your current run? You are at ' + ri.index + ' of ' + ri.total + ' in a guided run. A new run starts from this list. Statuses you already set are kept.',
        onConfirm: go
      });
    });

    root.appendChild(els.summary);
    root.appendChild(filters);
    root.appendChild(els.tfNote);
    root.appendChild(els.stateBox);
    root.appendChild(resultRow);
    root.appendChild(h('div', { class: 'start-row' }, [els.start]));
    root.appendChild(els.list);
    root.appendChild(els.empty);
  }

  function syncControls() {
    els.search.value = state.query;
    els.category.value = state.category;
    els.offer.value = state.offer;
    els.openToAll.checked = state.openToAll;
    els.sort.value = state.sort;
    els.trulyFree.checked = state.trulyFree;
    els.emailOnly.checked = state.emailOnly;
    els.needsRegistry.checked = state.needsRegistry;
  }

  function clearFilters() {
    var sort = state.sort;
    state = Object.assign({}, DEFAULTS, { sort: sort });
    syncControls();
    savePrefs();
    render();
    els.search.focus();
  }

  function categoryLabel(id) {
    for (var i = 0; i < L.CATEGORIES.length; i++) if (L.CATEGORIES[i].id === id) return L.CATEGORIES[i].label;
    return id || 'Other';
  }

  function programName(id) {
    var list = programs();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return '';
  }

  function inMyState(p) {
    var st = profState().toUpperCase();
    return !!st && Array.isArray(p.states) && p.states.some(function (x) { return String(x).toUpperCase() === st; });
  }

  function card(p, level, rank) {
    var cost = p.costToClaim;
    var badges = h('div', { class: 'badges' }, [
      h('span', { class: 'badge badge-category', text: categoryLabel(p.category) }),
      h('span', { class: 'badge badge-cost-' + String(cost).replace(/[^a-z-]/g, ''), text: L.COST_LABELS[cost] || String(cost || 'Unknown') })
    ]);

    var vid = L.verdict(p);
    var vlabel = '';
    L.VERDICTS.forEach(function (v) { if (v.id === vid) vlabel = v.label; });
    var top = [];
    if (rank) top.push(h('span', { class: 'rank', text: '#' + rank, title: 'Rank by value among the programs listed' }));
    if (vlabel) top.push(h('span', { class: 'badge badge-verdict badge-v-' + vid, text: vlabel }));
    if (p.certainty === 'if-eligible') top.push(h('span', { class: 'badge badge-tag tag-qualify', text: 'If you qualify' }));
    if (inMyState(p)) top.push(h('span', { class: 'badge badge-tag tag-state', text: 'In your state' }));

    var kids = [];
    if (top.length) kids.push(h('div', { class: 'card-top' }, top));
    kids.push(h('div', { class: 'card-head' }, [h(level, { text: p.name }), h('p', { class: 'card-brand', text: p.brand })]));
    if (p.sameAs) {
      var mainName = programName(p.sameAs);
      if (mainName) kids.push(h('p', { class: 'same-as', text: 'Another way to get the same thing as ' + mainName + '. You only need one.' }));
    }
    if (typeof p.freeStuff === 'string') {
      kids.push(p.freeStuff.trim()
        ? h('p', { class: 'free-line' }, [h('strong', { text: 'Free with no purchase: ' }), document.createTextNode(p.freeStuff)])
        : h('p', { class: 'free-line free-none', text: 'Nothing arrives free without a purchase or a win.' }));
    }
    var vt = L.valueText(p);
    var vb = [h('strong', { text: vt })];
    if (p.valueBasis) vb.push(h('span', { class: 'value-basis', text: ' ' + p.valueBasis }));
    kids.push(h('p', { class: 'value-line' }, vb));
    var offs = Array.isArray(p.offers) ? p.offers.filter(function (o) { return L.OFFER_LABELS[o]; }) : [];
    if (offs.length) {
      kids.push(h('ul', { class: 'chips offer-chips', 'aria-label': 'What you get' }, offs.map(function (o) { return h('li', { class: 'chip', text: L.OFFER_LABELS[o] }); })));
    }

    var facts = [];
    if (L.CERTAINTY_LABELS[p.certainty]) facts.push(['How sure', L.CERTAINTY_LABELS[p.certainty]]);
    if (L.EFFORT_LABELS[p.effort]) facts.push(['Effort', L.EFFORT_LABELS[p.effort]]);
    if (L.WHEN_LABELS[p.when]) facts.push(['Best time', L.WHEN_LABELS[p.when] + (p.whenNote ? '. ' + p.whenNote : '')]);
    if (Array.isArray(p.states) && p.states.length) facts.push(['Only in', p.states.join(', ')]);
    if (facts.length) {
      kids.push(h('dl', { class: 'facts' }, facts.map(function (f) {
        return h('div', null, [h('dt', { text: f[0] }), h('dd', { text: f[1] })]);
      })));
    }

    if (p.catches && String(p.catches).trim()) {
      kids.push(h('div', { class: 'catches', role: 'note' }, [
        h('strong', { text: 'Catches' }),
        h('span', { text: p.catches })
      ]));
    }

    var foot = [
      h('a', { class: 'btn btn-primary', href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer' }, [
        document.createTextNode('Sign up on ' + L.domainOf(p.signupUrl) + ' '),
        h('span', { class: 'visually-hidden', text: '(opens in a new tab)' }),
        h('span', { 'aria-hidden': 'true', text: String.fromCharCode(0x2197) })
      ])
    ];
    if (BFF.tracker) {
      var sid = 'st-' + p.id;
      var sel = h('select', { id: sid, 'data-program-id': p.id, 'aria-label': 'My status for ' + p.name }, STATUSES.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      sel.value = BFF.tracker.getStatus(p.id) || 'todo';
      sel.addEventListener('change', function () { BFF.tracker.setStatus(p.id, sel.value); });
      foot.push(h('div', { class: 'status-row' }, [h('label', { for: sid, text: 'My status' }), sel]));
    }
    kids.push(h('div', { class: 'card-foot' }, foot));

    // Everything else sits in one disclosure.
    var d = [h('summary', null, [document.createTextNode('More details'), h('span', { class: 'visually-hidden', text: ' about ' + p.name })])];
    d.push(badges);
    if (p.whatYouGet) d.push(h('p', { text: p.whatYouGet }));
    if (p.costDetail) d.push(h('p', { class: 'cost-detail', text: p.costDetail }));
    var reqs = Array.isArray(p.requirements) ? p.requirements : [];
    if (reqs.length) {
      d.push(h('div', null, [
        h('p', { class: 'card-section-title', text: 'What you need' }),
        h('ul', { class: 'chips' }, reqs.map(function (r) { return h('li', { class: 'chip', text: L.REQUIREMENT_LABELS[r] || r }); }))
      ]));
    }
    var meta = [];
    if (p.eligibility) meta.push(h('div', null, [h('dt', { text: 'Who: ' }), h('dd', { text: p.eligibility })]));
    if (p.region) meta.push(h('div', null, [h('dt', { text: 'Where: ' }), h('dd', { text: p.region })]));
    if (meta.length) d.push(h('dl', { class: 'meta' }, meta));
    if (p.notes) d.push(h('p', { text: p.notes }));
    var sources = Array.isArray(p.sourceUrls) ? p.sourceUrls : [];
    if (sources.length) {
      d.push(h('ul', { class: 'source-list' }, sources.map(function (u) {
        return h('li', null, [h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, [
          document.createTextNode(L.domainOf(u) + ' page '),
          h('span', { class: 'visually-hidden', text: '(opens in a new tab)' }),
          h('span', { 'aria-hidden': 'true', text: String.fromCharCode(0x2197) })
        ])]);
      })));
    }
    d.push(h('p', { class: 'verified', text: 'Verified ' + (p.verifiedOn || 'date unknown') + ' · ' + (p.confidence || 'unknown') + ' confidence' }));
    kids.push(h('details', { class: 'more-details' }, d));

    return h('article', { class: 'card', 'data-program-id': p.id }, kids);
  }

  function stateInfo() {
    var st = profState();
    var hidden = L.otherStateCount(programs(), st);
    return { st: st, hidden: hidden, hide: hidden > 0 && !showOther };
  }

  function renderStateBox(info) {
    els.stateBox.textContent = '';
    els.stateBox.hidden = false;
    if (info.hidden === 0) { els.stateBox.hidden = true; return; }
    var n = info.hidden, t;
    if (!info.st) {
      if (info.hide) t = (n === 1 ? '1 program is' : n + ' programs are') + ' only for some states. ';
      else t = (n === 1 ? '1 program only for some states is' : n + ' programs only for some states are') + ' shown. ';
      var kids = [document.createTextNode(t)];
      if (info.hide) {
        kids.push(document.createTextNode('Add your state in '));
        kids.push(h('a', { href: '#info', text: 'My info' }));
        kids.push(document.createTextNode(' to see the ones for you.'));
      } else {
        kids.push(document.createTextNode('Add your state in '));
        kids.push(h('a', { href: '#info', text: 'My info' }));
        kids.push(document.createTextNode(' to narrow them.'));
      }
      els.stateBox.appendChild(h('p', null, kids));
    } else if (info.hide) {
      els.stateBox.appendChild(h('p', { text: n === 1 ? '1 program for another state is hidden.' : n + ' programs for other states are hidden.' }));
    } else {
      els.stateBox.appendChild(h('p', { text: n === 1 ? '1 program for another state is shown.' : n + ' programs for other states are shown.' }));
    }
    var b = h('button', { type: 'button', class: 'btn btn-small', text: info.hide ? 'Show them' : 'Hide them' });
    b.addEventListener('click', function () { showOther = !showOther; savePrefs(); render(); var nb = els.stateBox.querySelector('button'); if (nb) nb.focus(); });
    els.stateBox.appendChild(b);
  }

  function goGroup(when) {
    state.sort = 'when';
    els.sort.value = 'when';
    savePrefs();
    render();
    var g = document.getElementById('dir-group-' + when) || els.list;
    if (g.scrollIntoView) g.scrollIntoView({ block: 'start' });
    var hd = g.querySelector && g.querySelector('.group-title');
    if (hd) hd.focus({ preventScroll: true });
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function renderSummary(pool) {
    var box = els.summary;
    box.textContent = '';
    var free = pool.filter(function (p) { return L.isTrulyFree(p) && L.isOpenToAll(p); });
    var tv = L.totalValue(free);
    var lo = L.roundTotal(tv.low), hi = L.roundTotal(tv.high);
    var worth = '.';
    if (tv.count) worth = ', worth about ' + (lo === hi ? L.money(lo) : L.money(lo) + ' to ' + L.money(hi)) + ' together.';
    box.appendChild(h('p', { class: 'sum-main' }, [
      h('strong', { text: free.length + ' truly free ' + (free.length === 1 ? 'program' : 'programs') + ' open to everyone' }),
      document.createTextNode(worth)
    ]));
    var noValue = free.filter(function (p) { return L.valueMid(p) === null; }).length;
    box.appendChild(h('p', { class: 'dir-note', text: tv.count
      ? 'This is our estimate, from ordinary shelf prices.' + (noValue ? ' ' + noValue + (noValue === 1 ? ' has' : ' have') + ' no known value and ' + (noValue === 1 ? 'is' : 'are') + ' not counted.' : '')
      : 'No dollar value is known for these programs yet.' }));
    var more = pool.filter(function (p) {
      var v = L.verdict(p);
      return L.needsQualifying(p) && (v === 'top' || v === 'good' || v === 'small');
    }).length;
    box.appendChild(h('p', { class: 'sum-more', text: more + ' more ' + (more === 1 ? 'is' : 'are') + ' free if you qualify (income, insurance or where you live).' }));

    var due = typeof profile.dueDate === 'string' ? profile.dueDate.trim() : '';
    var wk = due ? L.weeksUntil(due) : null;
    if (wk === null) {
      box.appendChild(h('p', { class: 'dir-note' }, [
        document.createTextNode('Add your due date in '),
        h('a', { href: '#info', text: 'My info' }),
        document.createTextNode(' to see what to do when. It stays on this device.')
      ]));
      return;
    }
    var head;
    if (wk < 0) head = 'Your due date has passed.';
    else if (wk === 0) head = 'Your due date is less than a week away.';
    else head = plural(wk, 'week', 'weeks') + ' until your due date.';
    box.appendChild(h('p', { class: 'sum-main' }, [h('strong', { text: head })]));
    var defs = [['pregnancy', 'do now'], ['late-pregnancy', 'in the last weeks'], ['after-birth', 'after the birth']];
    var row = h('ul', { class: 'when-buttons' });
    defs.forEach(function (d) {
      var n = pool.filter(function (p) { return p.when === d[0]; }).length;
      var b = h('button', { type: 'button', class: 'btn btn-small', 'aria-label': n + ' programs best to ' + d[1] + '. Show them.' }, [
        h('strong', { text: String(n) }), document.createTextNode(' ' + d[1])
      ]);
      b.addEventListener('click', function () { goGroup(d[0]); });
      row.appendChild(h('li', null, [b]));
    });
    box.appendChild(row);
  }

  function groupSection(id, title, note, items, rankOf) {
    var hid = 'dir-ghead-' + id;
    var head = h('h3', { class: 'group-title', id: hid, tabindex: '-1' }, [document.createTextNode(title + ' '), h('span', { class: 'group-count', text: '(' + items.length + ')' })]);
    var grid = h('div', { class: 'card-grid' });
    items.forEach(function (p) { grid.appendChild(card(p, 'h4', rankOf[p.id])); });
    return h('section', { class: 'dir-group', id: 'dir-group-' + id, 'aria-labelledby': hid }, [head, h('p', { class: 'group-note', text: note }), grid]);
  }

  function render() {
    var all = programs();
    var info = stateInfo();
    var pool = L.filterPrograms(all, { state: info.st, hideOtherStates: info.hide });
    var rankOf = L.rankMap(pool);
    var opts = Object.assign({}, state, { state: info.st, hideOtherStates: info.hide });
    var shown = L.sortPrograms(L.filterPrograms(pool, opts), state.sort);
    els.list.textContent = '';
    var frag = document.createDocumentFragment();
    if (state.sort === 'best' || state.sort === 'when') {
      var groups = state.sort === 'best'
        ? L.VERDICTS.map(function (v) { return { id: v.id, title: v.label, note: VERDICT_NOTES[v.id], items: shown.filter(function (p) { return L.verdict(p) === v.id; }) }; })
        : L.WHEN_ORDER.map(function (w) { return { id: w, title: L.WHEN_LABELS[w], note: WHEN_NOTES[w], items: shown.filter(function (p) { return p.when === w; }) }; })
          .concat([{ id: 'none', title: 'Timing not listed', note: WHEN_NOTES.none, items: shown.filter(function (p) { return L.WHEN_ORDER.indexOf(p.when) === -1; }) }]);
      groups.forEach(function (g) { if (g.items.length) frag.appendChild(groupSection(g.id, g.title, g.note, g.items, rankOf)); });
      els.list.className = 'dir-groups';
    } else {
      var grid = h('div', { class: 'card-grid' });
      shown.forEach(function (p) { grid.appendChild(card(p, 'h3', rankOf[p.id])); });
      frag.appendChild(grid);
      els.list.className = 'dir-groups';
    }
    els.list.appendChild(frag);
    els.tfNote.hidden = !state.trulyFree;
    renderStateBox(info);
    renderSummary(pool);
    els.count.textContent = 'Showing ' + shown.length + ' of ' + pool.length + ' programs';
    els.empty.hidden = shown.length !== 0;
    shownIds = shown.map(function (p) { return p.id; });
    els.start.textContent = 'Start a guided run with these ' + shown.length;
    els.start.disabled = shown.length === 0;
  }

  function onTrackerChanged() {
    if (!BFF.tracker || !els.list) return;
    var sels = els.list.querySelectorAll('select[data-program-id]');
    for (var i = 0; i < sels.length; i++) {
      var s = BFF.tracker.getStatus(sels[i].getAttribute('data-program-id')) || 'todo';
      if (sels[i].value !== s) sels[i].value = s;
    }
  }

  BFF.views.directory = {
    init: function (el) {
      loadPrefs();
      readProfile();
      buildControls(el);
      syncControls();
      render();
      document.addEventListener('bff:tracker-changed', onTrackerChanged);
      document.addEventListener('bff:profile-changed', function () { readProfile(); render(); });
    },
    show: function () { readProfile(); render(); onTrackerChanged(); }
  };
})();
