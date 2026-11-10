(function (root) {
  'use strict';

  var CATEGORIES = [
    { id: 'formula', label: 'Formula' },
    { id: 'diapers-wipes', label: 'Diapers & wipes' },
    { id: 'registry-box', label: 'Registry welcome boxes' },
    { id: 'feeding', label: 'Feeding gear' },
    { id: 'baby-care', label: 'Baby care' },
    { id: 'rewards', label: 'Rewards' },
    { id: 'health-benefits', label: 'Health benefits' },
    { id: 'assistance', label: 'Assistance programs' },
    { id: 'money', label: 'Money and savings' },
    { id: 'product-testing', label: 'Product testing' }
  ];

  var COST_LABELS = {
    'free': 'Free',
    'shipping-fee': 'Shipping fee',
    'purchase-required': 'Purchase needed',
    'membership-required': 'Membership needed'
  };

  var REQUIREMENT_LABELS = {
    email: 'Email',
    address: 'Mailing address',
    phone: 'Phone number',
    'due-date': 'Due date or birth date',
    registry: 'Baby registry',
    app: 'App',
    purchase: 'Purchase',
    membership: 'Membership',
    insurance: 'Insurance',
    eligibility: 'Meets eligibility rules'
  };

  var OFFER_LABELS = {
    product: 'Free product',
    coupons: 'Coupons and discounts',
    points: 'Reward points',
    sweepstakes: 'Prize draw',
    service: 'Free service',
    coverage: 'Health coverage',
    cash: 'Cash',
    testing: 'Product testing'
  };

  var CERTAINTY_LABELS = {
    guaranteed: 'Everyone who signs up gets it',
    likely: 'Most people get it, supplies vary',
    'if-eligible': 'Only if you qualify',
    chance: 'Only if you are picked or win'
  };

  var EFFORT_LABELS = {
    quick: 'About 5 minutes',
    some: 'Takes some setup',
    involved: 'Application or appointment'
  };

  var WHEN_LABELS = {
    pregnancy: 'Now, while pregnant',
    'late-pregnancy': 'In the last weeks before the due date',
    'after-birth': 'After the baby arrives',
    anytime: 'Any time'
  };
  var WHEN_ORDER = ['pregnancy', 'late-pregnancy', 'after-birth', 'anytime'];

  var VERDICTS = [
    { id: 'top', label: 'Top pick' },
    { id: 'good', label: 'Worth doing' },
    { id: 'small', label: 'Also free' },
    { id: 'conditional', label: 'Only if you would buy anyway' },
    { id: 'longshot', label: 'Long shot' }
  ];

  var CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 };
  var EFFORT_RANK = { quick: 0, some: 1, involved: 2 };
  var CERTAINTY_WEIGHT = { guaranteed: 1, 'if-eligible': 1, likely: 0.7, chance: 0.1 };

  function reqs(p) {
    return p && Array.isArray(p.requirements) ? p.requirements : [];
  }
  function has(p, r) {
    return reqs(p).indexOf(r) !== -1;
  }

  function offers(p) {
    return p && Array.isArray(p.offers) ? p.offers : [];
  }
  function firstOffer(p) {
    return offers(p)[0];
  }
  function num(x) {
    return typeof x === 'number' && isFinite(x) ? x : null;
  }

  function isTrulyFree(p) {
    return !!p && p.costToClaim === 'free' && !has(p, 'purchase') && !has(p, 'membership') &&
      firstOffer(p) === 'product' && p.certainty !== 'chance';
  }
  function isEmailOnly(p) {
    var r = reqs(p);
    return has(p, 'email') && r.every(function (x) { return x === 'email' || x === 'due-date'; });
  }
  function needsRegistry(p) {
    return has(p, 'registry');
  }
  function isEligibilityBased(p) {
    return !!p && (p.category === 'health-benefits' || p.category === 'assistance' ||
      has(p, 'eligibility') || has(p, 'insurance'));
  }
  function isOpenToAll(p) {
    return !!p && p.certainty !== 'if-eligible' && !isEligibilityBased(p);
  }
  function guidedDefault(p) {
    return isTrulyFree(p) && !isEligibilityBased(p);
  }

  function valueMid(p) {
    var lo = p ? num(p.valueLow) : null, hi = p ? num(p.valueHigh) : null;
    return lo === null || hi === null ? null : (lo + hi) / 2;
  }
  function expectedValue(p) {
    var mid = valueMid(p);
    if (mid === null) return null;
    var w = CERTAINTY_WEIGHT[p.certainty];
    // An unknown or missing certainty is treated like "likely".
    return mid * (w === undefined ? 0.7 : w);
  }

  function verdict(p) {
    var first = firstOffer(p);
    if (!p || p.certainty === 'chance' || first === 'sweepstakes' || first === 'testing') return 'longshot';
    if (p.costToClaim !== 'free' || has(p, 'purchase') || has(p, 'membership') ||
      first === 'coupons' || first === 'points') return 'conditional';
    var ev = expectedValue(p);
    if (ev !== null && ev >= 100) return 'top';
    if (ev !== null && ev >= 20) return 'good';
    if (ev === null && first === 'coverage') return 'good';
    return 'small';
  }
  function verdictIndex(p) {
    var v = verdict(p);
    for (var i = 0; i < VERDICTS.length; i++) if (VERDICTS[i].id === v) return i;
    return VERDICTS.length;
  }
  function effortRank(p) {
    var r = p ? EFFORT_RANK[p.effort] : undefined;
    return r === undefined ? 3 : r;
  }
  function rankCmp(a, b) {
    var ea = expectedValue(a), eb = expectedValue(b);
    var evOrder = ea === eb ? 0 : ea === null ? 1 : eb === null ? -1 : eb - ea;
    return verdictIndex(a) - verdictIndex(b) || evOrder ||
      effortRank(a) - effortRank(b) || confRank(a) - confRank(b) || byName(a, b);
  }
  function rankPrograms(list) {
    return (list || []).filter(function (p) { return !!p; }).sort(rankCmp);
  }
  function rankMap(list) {
    var map = {};
    rankPrograms(list).forEach(function (p, i) { map[p.id] = i + 1; });
    return map;
  }

  function stateOf(x) {
    return typeof x === 'string' ? x.trim().toUpperCase() : '';
  }
  function statesOf(p) {
    return p && Array.isArray(p.states) ? p.states : [];
  }
  function isOtherState(p, state) {
    var st = statesOf(p);
    var s = stateOf(state);
    return !!s && st.length > 0 && !st.some(function (x) { return stateOf(x) === s; });
  }
  // True when the program is limited to some states and the person's state is
  // unknown or not one of them.
  function hiddenByState(p, state) {
    var st = statesOf(p);
    if (!p || st.length === 0) return false;
    var s = stateOf(state);
    return !s || !st.some(function (x) { return stateOf(x) === s; });
  }
  function otherStateCount(list, state) {
    return (list || []).filter(function (p) { return hiddenByState(p, state); }).length;
  }
  function needsQualifying(p) {
    return !isOpenToAll(p);
  }

  function filterPrograms(list, opts) {
    opts = opts || {};
    var q = String(opts.query || '').trim().toLowerCase();
    return (list || []).filter(function (p) {
      if (!p) return false;
      if (opts.category && p.category !== opts.category) return false;
      if (opts.trulyFree && !isTrulyFree(p)) return false;
      if (opts.emailOnly && !isEmailOnly(p)) return false;
      if (opts.needsRegistry && !needsRegistry(p)) return false;
      if (opts.offer && offers(p).indexOf(opts.offer) === -1) return false;
      if (opts.openToAll && !isOpenToAll(p)) return false;
      if (opts.hideOtherStates && hiddenByState(p, opts.state)) return false;
      if (q) {
        var hay = [p.name, p.brand, p.whatYouGet, p.notes, p.eligibility, p.freeStuff].join('\n').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function byName(a, b) {
    var x = String(a.name || ''), y = String(b.name || '');
    return x.localeCompare(y, 'en', { sensitivity: 'base' }) || (x < y ? -1 : x > y ? 1 : 0);
  }
  function catIndex(p) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === p.category) return i;
    return CATEGORIES.length;
  }
  function confRank(p) {
    var r = CONFIDENCE_RANK[p.confidence];
    return r === undefined ? 3 : r;
  }

  function whenIndex(p) {
    var i = WHEN_ORDER.indexOf(p.when);
    return i === -1 ? WHEN_ORDER.length : i;
  }

  function sortPrograms(list, key) {
    var copy = (list || []).slice();
    var cmp;
    if (key === 'verified') {
      cmp = function (a, b) {
        var x = a.verifiedOn || '', y = b.verifiedOn || '';
        return x === y ? byName(a, b) : x < y ? 1 : -1;
      };
    } else if (key === 'best' || key === 'recommended') {
      cmp = rankCmp;
    } else if (key === 'when') {
      cmp = function (a, b) { return whenIndex(a) - whenIndex(b) || rankCmp(a, b); };
    } else if (key === 'category') {
      cmp = function (a, b) { return catIndex(a) - catIndex(b) || byName(a, b); };
    } else if (key === 'confidence') {
      cmp = function (a, b) { return confRank(a) - confRank(b) || byName(a, b); };
    } else {
      cmp = byName;
    }
    return copy.sort(cmp);
  }

  function money(n) {
    var r = Math.round(Number(n) || 0);
    var neg = r < 0;
    var digits = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '$' + digits;
  }
  // For combined figures only: nearest 10 under 1,000, otherwise nearest 100.
  function roundTotal(n) {
    var x = Number(n) || 0;
    var step = Math.abs(x) < 1000 ? 10 : 100;
    return Math.round(x / step) * step;
  }
  function valueText(p) {
    var lo = p ? num(p.valueLow) : null, hi = p ? num(p.valueHigh) : null;
    if (lo === null || hi === null) return 'Value not known';
    var src = p.valueSource === 'official' ? "the program's figure" : 'our estimate';
    var range = Math.round(lo) === Math.round(hi) ? money(lo) : money(lo) + ' to ' + money(hi);
    return 'Worth about ' + range + ' (' + src + ')';
  }
  function totalValue(list) {
    var groups = {};
    var order = [];
    (list || []).forEach(function (p, i) {
      var lo = p ? num(p.valueLow) : null, hi = p ? num(p.valueHigh) : null;
      if (lo === null || hi === null) return;
      var key = (p.sameAs || '') || p.id || ('#' + i);
      var g = groups[key];
      if (!g) { groups[key] = { low: lo, high: hi }; order.push(key); }
      else if (hi > g.high) { g.low = lo; g.high = hi; }
    });
    var t = { low: 0, high: 0, count: order.length };
    order.forEach(function (k) { t.low += groups[k].low; t.high += groups[k].high; });
    return t;
  }

  function dayNumber(x) {
    var y, m, d;
    if (x instanceof Date) {
      if (isNaN(x.getTime())) return null;
      y = x.getFullYear(); m = x.getMonth() + 1; d = x.getDate();
    } else {
      var r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof x === 'string' ? x.trim() : '');
      if (!r) return null;
      y = +r[1]; m = +r[2]; d = +r[3];
    }
    var t = Date.UTC(y, m - 1, d);
    var chk = new Date(t);
    if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null;
    return Math.round(t / 86400000);
  }
  // Whole weeks from today to the date, rounded down (a date 3 days past gives -1).
  function weeksUntil(dueDate, today) {
    var due = dayNumber(dueDate);
    var now = dayNumber(today === undefined || today === null ? new Date() : today);
    if (due === null || now === null) return null;
    return Math.floor((due - now) / 7);
  }

  function domainOf(url) {
    var s = String(url || '');
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#]*)/i.exec(s);
    if (!m) return '';
    var host = m[1].replace(/^[^@]*@/, '').replace(/:\d*$/, '').toLowerCase();
    return host.replace(/^www\./, '');
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var api = {
    CATEGORIES: CATEGORIES,
    COST_LABELS: COST_LABELS,
    REQUIREMENT_LABELS: REQUIREMENT_LABELS,
    OFFER_LABELS: OFFER_LABELS,
    CERTAINTY_LABELS: CERTAINTY_LABELS,
    EFFORT_LABELS: EFFORT_LABELS,
    WHEN_LABELS: WHEN_LABELS,
    WHEN_ORDER: WHEN_ORDER,
    VERDICTS: VERDICTS,
    isTrulyFree: isTrulyFree,
    isOpenToAll: isOpenToAll,
    valueMid: valueMid,
    expectedValue: expectedValue,
    verdict: verdict,
    rankPrograms: rankPrograms,
    rankMap: rankMap,
    isOtherState: isOtherState,
    hiddenByState: hiddenByState,
    otherStateCount: otherStateCount,
    needsQualifying: needsQualifying,
    money: money,
    roundTotal: roundTotal,
    valueText: valueText,
    totalValue: totalValue,
    weeksUntil: weeksUntil,
    isEmailOnly: isEmailOnly,
    needsRegistry: needsRegistry,
    isEligibilityBased: isEligibilityBased,
    guidedDefault: guidedDefault,
    filterPrograms: filterPrograms,
    sortPrograms: sortPrograms,
    domainOf: domainOf,
    escapeHtml: escapeHtml
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.logic = api; }
})(typeof window !== 'undefined' ? window : globalThis);
