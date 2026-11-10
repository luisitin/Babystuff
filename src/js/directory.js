(function () {
  'use strict';
  window.BFF = window.BFF || {};
  BFF.views = BFF.views || {};

  var L = BFF.logic;
  var DEFAULTS = { query: '', kind: 'stuff', category: '', offer: '', trulyFree: false, openToAll: false, emailOnly: false, needsRegistry: false, fitsMine: false, sort: 'best' };
  var KIND_IDS = ['stuff', 'money', 'care', 'all'];
  var CERTAIN_SHORT = { guaranteed: 'Guaranteed', likely: 'Likely', chance: 'Chance only' };
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
  var showNoFit = false;
  var openCards = {};
  var profile = {};
  var els = {};
  var shownIds = [];
  var uid = 0;
  var openGroups = {};

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

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
      state.offer = typeof f.offer === 'string' && has(L.OFFER_LABELS, f.offer) ? f.offer : '';
      state.openToAll = !!f.openToAll;
      state.trulyFree = !!f.trulyFree;
      state.emailOnly = !!f.emailOnly;
      state.needsRegistry = !!f.needsRegistry;
      state.fitsMine = !!f.fitsMine;
      state.kind = KIND_IDS.indexOf(f.kind) !== -1 ? f.kind : DEFAULTS.kind;
      state.sort = f.sort === 'recommended' ? 'best' : SORTS.some(function (s) { return s[0] === f.sort; }) ? f.sort : 'best';
    }
    showOther = !!(prefs && prefs.showOtherStates);
    showNoFit = !!(prefs && prefs.showNoFit);
  }
  function savePrefs() {
    if (!BFF.store) return;
    var prefs = BFF.store.get('prefs.v1', {});
    if (!prefs || typeof prefs !== 'object') prefs = {};
    prefs.filters = Object.assign({}, state);
    prefs.showOtherStates = showOther;
    prefs.showNoFit = showNoFit;
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

    var search = h('div', { class: 'filters filters-search', role: 'search', 'aria-label': 'Search programs' }, [
      h('div', { class: 'field' }, [h('label', { for: id + '-q', text: 'Search' }), els.search])
    ]);
    els.tabs = h('div', { class: 'kind-tabs', role: 'group', 'aria-label': 'Kind of program' });
    els.tabBtns = {};
    KIND_IDS.forEach(function (k) {
      var b = h('button', { type: 'button', class: 'kind-tab', 'data-kind': k, 'aria-pressed': 'false' });
      b.addEventListener('click', function () {
        if (state.kind === k) return;
        state.kind = k;
        savePrefs();
        render();
      });
      els.tabBtns[k] = b;
      els.tabs.appendChild(b);
    });
    els.fitsHint = h('span', { class: 'chip-hint', id: id + '-fit-hint', hidden: true, text: 'Answer the questions in My info to use this.' });
    els.fitsMine = null;
    var fitsInput = h('input', { type: 'checkbox', 'aria-describedby': id + '-fit-hint' });
    fitsInput.addEventListener('change', function () { state.fitsMine = fitsInput.checked; savePrefs(); render(); });
    els.fitsMine = fitsInput;
    els.filterSummary = h('summary', { text: 'Sort and filter' });
    els.filterBox = h('details', { class: 'dir-filters filters' }, [
      els.filterSummary,
      h('div', { class: 'field-row' }, [
        h('div', { class: 'field' }, [h('label', { for: id + '-sort', text: 'Sort by' }), els.sort]),
        h('div', { class: 'field' }, [h('label', { for: id + '-offer', text: 'What you get' }), els.offer]),
        h('div', { class: 'field' }, [h('label', { for: id + '-cat', text: 'Category' }), els.category])
      ]),
      h('div', { class: 'checks' }, [
        check('trulyFree', 'Truly free'),
        check('openToAll', 'Open to everyone'),
        check('emailOnly', 'Email only'),
        check('needsRegistry', 'Needs a registry'),
        h('label', { class: 'chip-toggle', 'data-chip': 'fitsMine' }, [fitsInput, h('span', { text: 'Fits my answers' })])
      ]),
      els.fitsHint
    ]);
    els.tfNote = h('p', { class: 'dir-note', hidden: true, text: TRULY_FREE_LINE });
    els.stateBox = h('div', { class: 'dir-state', hidden: true });
    els.fitBox = h('div', { class: 'dir-state dir-fit', hidden: true });
    els.summary = h('section', { class: 'dir-summary', 'aria-label': 'Summary' });
    els.missBox = h('div', { class: 'dir-miss', hidden: true });

    els.count = h('p', { class: 'result-count', tabindex: '-1', 'aria-live': 'polite', 'aria-atomic': 'true' });
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
    root.appendChild(els.missBox);
    root.appendChild(search);
    root.appendChild(els.tabs);
    root.appendChild(els.filterBox);
    root.appendChild(els.tfNote);
    root.appendChild(els.stateBox);
    root.appendChild(els.fitBox);
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
    els.fitsMine.checked = state.fitsMine;
  }

  function clearFilters() {
    var sort = state.sort;
    state = Object.assign({}, DEFAULTS, { sort: sort });   // the tab goes back to the default too
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

  function statusOf(id) { return BFF.tracker ? (BFF.tracker.getStatus(id) || 'todo') : 'todo'; }
  function statusLabel(st) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i][0] === st) return STATUSES[i][1];
    return st;
  }
  function hasAudience(p) { return Array.isArray(p.audience) && p.audience.length > 0; }

  // The one badge that says how sure the program is, or how it fits the person's answers.
  function certaintyBadge(p, sit) {
    var f = L.fit(p, profile);
    if (sit && hasAudience(p) && f === 'yes') return h('span', { class: 'badge badge-tag badge-certainty tag-fit', text: 'Fits your answers' });
    if ((sit && f === 'maybe') || p.certainty === 'if-eligible') return h('span', { class: 'badge badge-tag badge-certainty tag-qualify', text: 'If you qualify' });
    if (has(CERTAIN_SHORT, p.certainty)) return h('span', { class: 'badge badge-tag badge-certainty tag-certainty', text: CERTAIN_SHORT[p.certainty] });
    return null;
  }

  // What My info is missing for this program, only while it is still to do.
  function missLine(p) {
    if (!BFF.missing || statusOf(p.id) !== 'todo') return null;
    return BFF.missing.line(p, profile);
  }
  function byProgramId(id) {
    var l = programs();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function renderMissBox() {
    if (!els.missBox) return;
    els.missBox.textContent = '';
    var n = BFF.missing && L.missingInfoCounts ? BFF.missing.notice(L.missingInfoCounts(programs(), profile, statusOf)) : null;
    if (n) els.missBox.appendChild(n);
    els.missBox.hidden = !n;
  }

  function card(p, level, rank, ctx) {
    var cost = p.costToClaim;
    var open = !!openCards[p.id];
    var cid = 'more-' + p.id;
    var sit = ctx.sit;

    var vid = L.verdict(p);
    var vlabel = '';
    L.VERDICTS.forEach(function (v) { if (v.id === vid) vlabel = v.label; });
    var top = [];
    if (rank) top.push(h('span', { class: 'rank', text: '#' + rank, title: 'Rank by value among the programs listed' }));
    if (vlabel) top.push(h('span', { class: 'badge badge-verdict badge-v-' + vid, text: vlabel }));
    var cb = certaintyBadge(p, sit);
    if (cb) top.push(cb);
    if (sit && L.fit(p, profile) === 'no') top.push(h('span', { class: 'badge badge-tag tag-nomatch', text: 'Does not match your answers' }));
    var st = statusOf(p.id);
    top.push(h('span', { class: 'badge badge-status card-status-badge', hidden: st === 'todo', text: st === 'todo' ? '' : statusLabel(st) }));

    var kids = [];
    kids.push(h('div', { class: 'card-top' }, top));
    kids.push(h('div', { class: 'card-head' }, [h(level, { text: p.name }), h('p', { class: 'card-brand', text: p.brand })]));
    if (typeof p.freeStuff === 'string') {
      kids.push(p.freeStuff.trim()
        ? h('p', { class: 'free-line' }, [h('strong', { text: 'Free with no purchase: ' }), document.createTextNode(p.freeStuff)])
        : h('p', { class: 'free-line free-none', text: L.freeNote(p) }));
    }
    kids.push(h('p', { class: 'value-line' }, [h('strong', { text: L.valueText(p) })]));
    var ml = missLine(p);
    if (ml) kids.push(ml);

    var link = h('a', { class: 'btn btn-primary', href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer' }, [
      document.createTextNode('Sign up on ' + L.domainOf(p.signupUrl) + ' '),
      h('span', { class: 'visually-hidden', text: '(opens in a new tab)' }),
      h('span', { 'aria-hidden': 'true', text: String.fromCharCode(0x2197) })
    ]);
    var toggle = h('button', { type: 'button', class: 'btn card-toggle', 'aria-expanded': open ? 'true' : 'false', 'aria-controls': cid }, [
      document.createTextNode('Details'),
      h('span', { class: 'visually-hidden', text: ' about ' + p.name }),
      h('span', { class: 'card-toggle-icon', 'aria-hidden': 'true', text: open ? String.fromCharCode(0x25B4) : String.fromCharCode(0x25BE) })
    ]);
    kids.push(h('div', { class: 'card-foot' }, [link, toggle]));

    // Everything else, shown when the card is opened.
    var d = [];
    d.push(h('div', { class: 'badges' }, [
      h('span', { class: 'badge badge-category', text: categoryLabel(p.category) }),
      h('span', { class: 'badge badge-cost-' + String(cost).replace(/[^a-z-]/g, ''), text: L.COST_LABELS[cost] || String(cost || 'Unknown') })
    ].concat(inMyState(p) ? [h('span', { class: 'badge badge-tag tag-state', text: 'In your state' })] : [])));
    if (p.sameAs) {
      var mainName = programName(p.sameAs);
      if (mainName) d.push(h('p', { class: 'same-as', text: 'Another way to get the same thing as ' + mainName + '. You only need one.' }));
    }
    if (p.valueBasis) d.push(h('p', { class: 'value-basis', text: p.valueBasis }));
    var offs = Array.isArray(p.offers) ? p.offers.filter(function (o) { return has(L.OFFER_LABELS, o); }) : [];
    if (offs.length) {
      d.push(h('ul', { class: 'chips offer-chips', 'aria-label': 'What you get' }, offs.map(function (o) { return h('li', { class: 'chip', text: L.OFFER_LABELS[o] }); })));
    }
    var facts = [];
    if (has(L.CERTAINTY_LABELS, p.certainty)) facts.push(['How sure', L.CERTAINTY_LABELS[p.certainty]]);
    if (has(L.EFFORT_LABELS, p.effort)) facts.push(['Effort', L.EFFORT_LABELS[p.effort]]);
    if (has(L.WHEN_LABELS, p.when)) facts.push(['Best time', L.WHEN_LABELS[p.when] + (p.whenNote ? '. ' + p.whenNote : '')]);
    if (Array.isArray(p.states) && p.states.length) facts.push(['Only in', p.states.join(', ')]);
    if (facts.length) {
      d.push(h('dl', { class: 'facts' }, facts.map(function (f) {
        return h('div', null, [h('dt', { text: f[0] }), h('dd', { text: f[1] })]);
      })));
    }
    if (p.catches && String(p.catches).trim()) {
      d.push(h('div', { class: 'catches', role: 'note' }, [h('strong', { text: 'Catches' }), h('span', { text: p.catches })]));
    }
    if (BFF.tracker) {
      var sid = 'st-' + p.id;
      var sel = h('select', { id: sid, 'data-program-id': p.id, 'aria-label': 'My status for ' + p.name }, STATUSES.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      sel.value = st;
      sel.addEventListener('change', function () { BFF.tracker.setStatus(p.id, sel.value); });
      d.push(h('div', { class: 'status-row' }, [h('label', { for: sid, text: 'My status' }), sel]));
    }
    if (p.whatYouGet) d.push(h('p', { class: 'what-you-get', text: p.whatYouGet }));
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
    var more = h('div', { class: 'card-more', id: cid, hidden: !open }, d);
    kids.push(more);

    var art = h('article', { class: 'card' + (open ? ' is-open' : ''), 'data-program-id': p.id }, kids);
    toggle.addEventListener('click', function () {
      var now = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', now ? 'true' : 'false');
      toggle.querySelector('.card-toggle-icon').textContent = now ? String.fromCharCode(0x25B4) : String.fromCharCode(0x25BE);
      more.hidden = !now;
      art.classList.toggle('is-open', now);
      if (now) openCards[p.id] = true; else delete openCards[p.id];
    });
    return art;
  }

  function stateInfo() {
    var st = profState();
    var hidden = L.otherStateCount(programs(), st);
    return { st: st, hidden: hidden, hide: hidden > 0 && !showOther };
  }

  // Programs the answers in My info rule out (never ones already in progress), among those left by the state rule.
  function fitInfo(afterState) {
    var sit = L.hasSituation(profile);
    var hidden = sit ? L.hiddenByAnswersCount(afterState, profile, statusOf) : 0;
    return { sit: sit, hidden: hidden, hide: sit && hidden > 0 && !showNoFit };
  }
  function renderFitBox(info) {
    els.fitBox.textContent = '';
    els.fitBox.hidden = info.hidden === 0;
    if (info.hidden === 0) return;
    var n = info.hidden;
    els.fitBox.appendChild(h('p', { text: info.hide
      ? (n === 1 ? '1 program hidden' : n + ' programs hidden') + ' because of your answers in My info.'
      : (n === 1 ? '1 program that does not match' : n + ' programs that do not match') + ' your answers in My info ' + (n === 1 ? 'is' : 'are') + ' shown.' }));
    var b = h('button', { type: 'button', class: 'btn btn-small', text: info.hide ? 'Show them' : 'Hide them' });
    b.addEventListener('click', function () { showNoFit = !showNoFit; savePrefs(); render(); var nb = els.fitBox.querySelector('button'); if (nb) nb.focus(); });
    els.fitBox.appendChild(b);
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
        kids.push(h('a', { href: '#info', 'data-info-key': 'state', text: 'My info' }));
        kids.push(document.createTextNode(' to see the ones for you.'));
      } else {
        kids.push(document.createTextNode('Add your state in '));
        kids.push(h('a', { href: '#info', 'data-info-key': 'state', text: 'My info' }));
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
    state.kind = 'all';   // the count on the button is over every kind
    els.sort.value = 'when';
    savePrefs();
    render();
    var g = document.getElementById('dir-group-' + when);
    if (!g) return;
    if (g.scrollIntoView) g.scrollIntoView({ block: 'start' });
    var hd = g.querySelector('.group-title');
    if (hd) hd.focus({ preventScroll: true });
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function distinctGroups(list) {
    var seen = {}, n = 0;
    list.forEach(function (p) { var k = L.groupKey(p); if (!seen[k]) { seen[k] = true; n++; } });
    return n;
  }

  // The lead cards the list would show under the "when" sort with the current filters.
  function collapseShown(pool) {
    return L.collapseGroups(L.sortPrograms(L.filterPrograms(pool, listOpts({ kind: 'all' })), 'when'));
  }
  // Filter options for the list: the chosen filters plus the state and answers rules.
  function listOpts(extra) {
    var info = stateInfo();
    var opts = Object.assign({}, state, {
      state: info.st, hideOtherStates: info.hide,
      profile: profile, hideNoFit: false,
      fitsMine: state.fitsMine && L.hasSituation(profile)
    }, extra || {});
    return opts;
  }

  function renderSummary(pool, fInfo) {
    var box = els.summary;
    box.textContent = '';
    var free = pool.filter(function (p) { return L.isTrulyFree(p) && L.isOpenToAll(p); });
    var freeGroups = distinctGroups(free);
    var tv = L.totalValue(free);
    var lo = L.roundTotal(tv.low), hi = L.roundTotal(tv.high);
    var noValue = free.filter(function (p) { return L.valueMid(p) === null; }).length;
    var worth = '. No dollar value is known for these programs yet.';
    var skipNote = noValue ? '; ' + noValue + (noValue === 1 ? ' has' : ' have') + ' no known value and ' + (noValue === 1 ? 'is' : 'are') + ' not counted' : '';
    if (tv.count) worth = ', worth about ' + (lo === hi ? L.money(lo) : L.money(lo) + ' to ' + L.money(hi)) + ' together (our estimate, from ordinary shelf prices' + skipNote + ').';
    var mainKids = [
      h('strong', { text: freeGroups + ' truly free ' + (freeGroups === 1 ? 'program' : 'programs') + ' open to everyone' }),
      document.createTextNode(worth)
    ];
    var top = h('div', { class: 'sum-top' }, [h('p', { class: 'sum-main' }, mainKids)]);
    var more = distinctGroups(pool.filter(function (p) {
      var v = L.verdict(p);
      return L.needsQualifying(p) && (v === 'top' || v === 'good' || v === 'small') && L.fit(p, L.hasSituation(profile) ? profile : {}) !== 'no';
    }));
    if (freeGroups > 0 && !(state.trulyFree && state.openToAll && state.kind !== 'money' && state.kind !== 'care')) {
      var show = h('button', { type: 'button', class: 'btn btn-small show-these', text: 'Show these' });
      show.addEventListener('click', function () {
        state.trulyFree = true;
        state.openToAll = true;
        state.query = '';
        state.category = '';
        state.offer = '';
        state.emailOnly = false;
        state.needsRegistry = false;
        state.fitsMine = false;
        state.kind = 'stuff';   // truly free programs are all in Free stuff
        savePrefs();
        syncControls();
        render();
        els.count.focus();
      });
      top.appendChild(h('p', { class: 'sum-show' }, [show]));
    }
    box.appendChild(top);
    box.appendChild(h('p', { class: 'sum-more', text: more + ' more ' + (more === 1 ? 'is' : 'are') + ' free if you qualify.' }));

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
    var dueBox = h('div', { class: 'sum-due' }, [h('p', { class: 'sum-main sum-due-head' }, [h('strong', { text: head })])]);
    var defs = [['pregnancy', 'do now'], ['late-pregnancy', 'in the last weeks'], ['after-birth', 'after the birth']];
    if (wk < 0) defs = [defs[2]];
    var counts = {};
    collapseShown(pool).forEach(function (g) { counts[g.lead.when] = (counts[g.lead.when] || 0) + 1; });
    var row = h('ul', { class: 'when-buttons' });
    defs.forEach(function (d) {
      var n = counts[d[0]] || 0;
      if (!n) return;
      var b = h('button', { type: 'button', class: 'btn btn-small' }, [
        h('strong', { text: String(n) }), document.createTextNode(' ' + d[1]),
        h('span', { class: 'visually-hidden', text: ', show ' + (n === 1 ? 'this program' : 'these programs') })
      ]);
      b.addEventListener('click', function () { goGroup(d[0]); });
      row.appendChild(h('li', null, [b]));
    });
    if (row.childNodes.length) dueBox.appendChild(row);
    box.appendChild(dueBox);
  }

  function appendGroup(grid, g, level, rankOf, ctx) {
    grid.appendChild(card(g.lead, level, rankOf[g.lead.id], ctx));
    if (!g.others.length) return;
    var key = L.groupKey(g.lead);
    var n = g.others.length;
    var det = h('details', { class: 'same-group', 'data-group': key }, [
      h('summary', { text: n === 1 ? '1 more way to get the same thing' : n + ' more ways to get the same thing' }),
      h('div', { class: 'card-grid same-group-cards' }, g.others.map(function (o) { return card(o, level, rankOf[o.id], ctx); }))
    ]);
    if (openGroups[key]) det.open = true;
    det.addEventListener('toggle', function () { if (det.open) openGroups[key] = true; else delete openGroups[key]; });
    grid.appendChild(det);
  }

  function groupSection(id, title, note, items, rankOf, ctx) {
    var hid = 'dir-ghead-' + id;
    var head = h('h3', { class: 'group-title', id: hid, tabindex: '-1' }, [document.createTextNode(title + ' '), h('span', { class: 'group-count', text: '(' + items.length + ')' })]);
    var grid = h('div', { class: 'card-grid' });
    items.forEach(function (g) { appendGroup(grid, g, 'h4', rankOf, ctx); });
    return h('section', { class: 'dir-group', id: 'dir-group-' + id, 'aria-labelledby': hid }, [head, h('p', { class: 'group-note', text: note }), grid]);
  }

  function render() {
    var all = programs();
    var info = stateInfo();
    var afterState = L.filterPrograms(all, { state: info.st, hideOtherStates: info.hide });
    var fInfo = fitInfo(afterState);
    var pool = fInfo.hide ? L.filterPrograms(afterState, { profile: profile, hideNoFit: true, statusOf: statusOf }) : afterState;
    // Ranks are numbered within the tab, over the programs that are left after the state and answers rules.
    var rankOf = L.rankMap(state.kind === 'all' ? pool : L.filterPrograms(pool, { kind: state.kind }));
    var ctx = { sit: fInfo.sit };
    var opts = listOpts();
    var shown = L.sortPrograms(L.filterPrograms(pool, opts), state.sort);
    var collapsed = L.collapseGroups(shown);
    els.list.textContent = '';
    var frag = document.createDocumentFragment();
    if (state.sort === 'best' || state.sort === 'when') {
      var groups = state.sort === 'best'
        ? L.VERDICTS.map(function (v) { return { id: v.id, title: v.label, note: VERDICT_NOTES[v.id], items: collapsed.filter(function (g) { return L.verdict(g.lead) === v.id; }) }; })
        : L.WHEN_ORDER.map(function (w) { return { id: w, title: L.WHEN_LABELS[w], note: WHEN_NOTES[w], items: collapsed.filter(function (g) { return g.lead.when === w; }) }; })
          .concat([{ id: 'none', title: 'Timing not listed', note: WHEN_NOTES.none, items: collapsed.filter(function (g) { return L.WHEN_ORDER.indexOf(g.lead.when) === -1; }) }]);
      groups.forEach(function (g) { if (g.items.length) frag.appendChild(groupSection(g.id, g.title, g.note, g.items, rankOf, ctx)); });
      els.list.className = 'dir-groups';
    } else {
      var grid = h('div', { class: 'card-grid' });
      collapsed.forEach(function (g) { appendGroup(grid, g, 'h3', rankOf, ctx); });
      frag.appendChild(grid);
      els.list.className = 'dir-groups';
    }
    els.list.appendChild(frag);
    els.tfNote.hidden = !state.trulyFree;
    renderTabs(pool);
    renderFilterBox(fInfo);
    renderFitBox(fInfo);
    renderStateBox(info);
    renderSummary(pool, fInfo);
    renderMissBox();
    els.count.textContent = 'Showing ' + shown.length + ' of ' + pool.length + ' programs';
    els.empty.hidden = shown.length !== 0;
    shownIds = shown.map(function (p) { return p.id; });
    els.start.textContent = 'Start a guided run with these ' + shown.length;
    els.start.disabled = shown.length === 0;
  }

  // Tab labels and counts: what each tab would show with the other filters as they are now.
  function renderTabs(pool) {
    var names = { stuff: 'Free stuff', money: 'Money', care: 'Care and cover', all: 'All' };
    KIND_IDS.forEach(function (k) {
      var n = L.filterPrograms(pool, listOpts({ kind: k })).length;
      var b = els.tabBtns[k];
      b.textContent = '';
      b.appendChild(h('span', { class: 'kt-label', text: names[k] }));
      b.appendChild(document.createTextNode(' '));
      b.appendChild(h('span', { class: 'kt-count', text: '(' + n + ')' }));
      b.setAttribute('aria-pressed', state.kind === k ? 'true' : 'false');
    });
  }
  // "Sort and filter" counts the filters that are not at their default and opens itself when any is.
  function activeFilters(sit) {
    var n = 0;
    if (state.sort !== DEFAULTS.sort) n++;
    if (state.offer) n++;
    if (state.category) n++;
    ['trulyFree', 'openToAll', 'emailOnly', 'needsRegistry'].forEach(function (k) { if (state[k]) n++; });
    if (state.fitsMine && sit) n++;
    return n;
  }
  function renderFilterBox(fInfo) {
    var n = activeFilters(fInfo.sit);
    els.filterSummary.textContent = n ? 'Sort and filter (' + n + ' on)' : 'Sort and filter';
    if (n > 0) els.filterBox.open = true;
    els.fitsMine.disabled = !fInfo.sit;
    els.fitsHint.hidden = fInfo.sit;
    els.fitsMine.checked = state.fitsMine && fInfo.sit;
  }

  function onTrackerChanged() {
    if (!BFF.tracker || !els.list) return;
    var badges = els.list.querySelectorAll('.card[data-program-id]');
    for (var j = 0; j < badges.length; j++) {
      var sb = badges[j].querySelector('.card-status-badge');
      var stv = statusOf(badges[j].getAttribute('data-program-id'));
      if (sb) { sb.hidden = stv === 'todo'; sb.textContent = stv === 'todo' ? '' : statusLabel(stv); }
    }
    for (var m = 0; m < badges.length; m++) {
      var pid = badges[m].getAttribute('data-program-id');
      var oldLine = badges[m].querySelector('.miss-line');
      var prog = byProgramId(pid);
      var want = prog ? missLine(prog) : null;
      if (!oldLine && !want) continue;
      if (oldLine && want && oldLine.getAttribute('data-missing') === want.getAttribute('data-missing')) continue;
      if (oldLine) oldLine.parentNode.removeChild(oldLine);
      if (want) { var foot = badges[m].querySelector('.card-foot'); badges[m].insertBefore(want, foot); }
    }
    renderMissBox();
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
