(function () {
  'use strict';
  window.BFF = window.BFF || {};
  BFF.views = BFF.views || {};

  var L = BFF.logic;
  var DEFAULTS = { query: '', category: '', trulyFree: false, emailOnly: false, needsRegistry: false, sort: 'name' };
  var SORTS = [
    ['name', 'Name A-Z'],
    ['verified', 'Recently verified'],
    ['category', 'Category'],
    ['confidence', 'Confidence']
  ];
  var STATUSES = [['todo', 'To do'], ['signed-up', 'Signed up'], ['received', 'Received'], ['skipped', 'Skipped']];

  var state = Object.assign({}, DEFAULTS);
  var els = {};
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
      state.trulyFree = !!f.trulyFree;
      state.emailOnly = !!f.emailOnly;
      state.needsRegistry = !!f.needsRegistry;
      state.sort = SORTS.some(function (s) { return s[0] === f.sort; }) ? f.sort : 'name';
    }
  }
  function savePrefs() {
    if (!BFF.store) return;
    var prefs = BFF.store.get('prefs.v1', {});
    if (!prefs || typeof prefs !== 'object') prefs = {};
    prefs.filters = Object.assign({}, state);
    BFF.store.set('prefs.v1', prefs);
  }

  function programs() { return Array.isArray(BFF.programs) ? BFF.programs : []; }

  function buildControls(root) {
    var all = programs();
    var counts = {};
    all.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    var id = 'dir' + (++uid);
    els.search = h('input', { type: 'search', id: id + '-q', autocomplete: 'off', placeholder: 'Name, brand or what you get' });
    els.category = h('select', { id: id + '-cat' }, [h('option', { value: '', text: 'All categories (' + all.length + ')' })]
      .concat(L.CATEGORIES.map(function (c) { return h('option', { value: c.id, text: c.label + ' (' + (counts[c.id] || 0) + ')' }); })));
    els.sort = h('select', { id: id + '-sort' }, SORTS.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));

    function check(key, label) {
      var input = h('input', { type: 'checkbox' });
      input.addEventListener('change', function () { state[key] = input.checked; savePrefs(); render(); });
      els[key] = input;
      return h('label', { class: 'check' }, [input, h('span', { text: label })]);
    }

    els.clear = h('button', { type: 'button', class: 'btn', text: 'Clear filters' });
    els.clear.addEventListener('click', clearFilters);

    var timer = null;
    els.search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.query = els.search.value; savePrefs(); render(); }, 150);
    });
    els.category.addEventListener('change', function () { state.category = els.category.value; savePrefs(); render(); });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; savePrefs(); render(); });

    var filters = h('div', { class: 'filters', role: 'search', 'aria-label': 'Filter programs' }, [
      h('div', { class: 'field' }, [h('label', { for: id + '-q', text: 'Search' }), els.search]),
      h('div', { class: 'field-row' }, [
        h('div', { class: 'field' }, [h('label', { for: id + '-cat', text: 'Category' }), els.category]),
        h('div', { class: 'field' }, [h('label', { for: id + '-sort', text: 'Sort by' }), els.sort])
      ]),
      h('div', { class: 'checks' }, [
        check('trulyFree', 'Truly free'),
        check('emailOnly', 'Email only'),
        check('needsRegistry', 'Needs a registry')
      ]),
      h('div', { class: 'filter-actions' }, [els.clear])
    ]);

    els.count = h('p', { class: 'result-count', 'aria-live': 'polite', 'aria-atomic': 'true' });
    els.list = h('div', { class: 'card-grid' });
    els.empty = h('div', { class: 'empty', hidden: true }, [
      h('p', { text: 'No programs match those filters.' })
    ]);
    var emptyClear = h('button', { type: 'button', class: 'btn btn-primary', text: 'Clear filters' });
    emptyClear.addEventListener('click', clearFilters);
    els.empty.appendChild(emptyClear);

    root.appendChild(filters);
    root.appendChild(els.count);
    root.appendChild(els.list);
    root.appendChild(els.empty);
  }

  function syncControls() {
    els.search.value = state.query;
    els.category.value = state.category;
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

  function card(p) {
    var cost = p.costToClaim;
    var badges = h('div', { class: 'badges' }, [
      h('span', { class: 'badge badge-category', text: categoryLabel(p.category) }),
      h('span', { class: 'badge badge-cost-' + String(cost).replace(/[^a-z-]/g, ''), text: L.COST_LABELS[cost] || String(cost || 'Unknown') })
    ]);

    var kids = [
      h('div', { class: 'card-head' }, [h('h3', { text: p.name }), h('p', { class: 'card-brand', text: p.brand })]),
      badges
    ];
    if (p.costDetail) kids.push(h('p', { class: 'cost-detail', text: p.costDetail }));
    if (p.whatYouGet) kids.push(h('p', { text: p.whatYouGet }));

    var reqs = Array.isArray(p.requirements) ? p.requirements : [];
    if (reqs.length) {
      kids.push(h('div', null, [
        h('p', { class: 'card-section-title', text: 'What you need' }),
        h('ul', { class: 'chips' }, reqs.map(function (r) { return h('li', { class: 'chip', text: L.REQUIREMENT_LABELS[r] || r }); }))
      ]));
    }

    var meta = [];
    if (p.eligibility) meta.push(h('div', null, [h('dt', { text: 'Who: ' }), h('dd', { text: p.eligibility })]));
    if (p.region) meta.push(h('div', null, [h('dt', { text: 'Where: ' }), h('dd', { text: p.region })]));
    if (meta.length) kids.push(h('dl', { class: 'meta' }, meta));

    if (p.catches && String(p.catches).trim()) {
      kids.push(h('div', { class: 'catches', role: 'note' }, [
        h('strong', { text: 'Catches' }),
        h('span', { text: p.catches })
      ]));
    }

    var sources = Array.isArray(p.sourceUrls) ? p.sourceUrls : [];
    if (p.notes || sources.length) {
      var d = [h('summary', { text: 'Notes and sources' })];
      if (p.notes) d.push(h('p', { text: p.notes }));
      if (sources.length) {
        d.push(h('ul', { class: 'source-list' }, sources.map(function (u) {
          return h('li', null, [h('a', { href: u, target: '_blank', rel: 'noopener noreferrer', text: L.domainOf(u) + ' page' + ' ↗' })]);
        })));
      }
      kids.push(h('details', null, d));
    }

    var foot = [
      h('a', { class: 'btn btn-primary', href: p.signupUrl, target: '_blank', rel: 'noopener noreferrer',
        text: 'Sign up on ' + L.domainOf(p.signupUrl) + ' ↗' }),
      h('p', { class: 'verified', text: 'Verified ' + (p.verifiedOn || 'date unknown') + ' · ' + (p.confidence || 'unknown') + ' confidence' })
    ];
    if (BFF.tracker) {
      var sid = 'st-' + p.id;
      var sel = h('select', { id: sid, 'data-program-id': p.id }, STATUSES.map(function (s) { return h('option', { value: s[0], text: s[1] }); }));
      sel.value = BFF.tracker.getStatus(p.id) || 'todo';
      sel.addEventListener('change', function () { BFF.tracker.setStatus(p.id, sel.value); });
      foot.push(h('div', { class: 'status-row' }, [h('label', { for: sid, text: 'My status' }), sel]));
    }
    kids.push(h('div', { class: 'card-foot' }, foot));

    return h('article', { class: 'card', 'data-program-id': p.id }, kids);
  }

  function render() {
    var all = programs();
    var shown = L.sortPrograms(L.filterPrograms(all, state), state.sort);
    els.list.textContent = '';
    var frag = document.createDocumentFragment();
    shown.forEach(function (p) { frag.appendChild(card(p)); });
    els.list.appendChild(frag);
    els.count.textContent = 'Showing ' + shown.length + ' of ' + all.length + ' programs';
    els.empty.hidden = shown.length !== 0;
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
      buildControls(el);
      syncControls();
      render();
      document.addEventListener('bff:tracker-changed', onTrackerChanged);
    },
    show: function () { onTrackerChanged(); }
  };
})();
