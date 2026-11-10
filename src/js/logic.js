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
      effortRank(a) - effortRank(b) || confRank(a) - confRank(b) || byName(a, b) ||
      (String(a.id || '') < String(b.id || '') ? -1 : String(a.id || '') > String(b.id || '') ? 1 : 0);
  }
  function rankPrograms(list) {
    return (list || []).filter(function (p) { return !!p; }).sort(rankCmp);
  }
  function groupKey(p) { return (p && (p.sameAs || p.id)) || ''; }
  // Programs that are the same thing share one rank number.
  function rankMap(list) {
    var map = {};
    var seen = {};
    var n = 0;
    rankPrograms(list).forEach(function (p) {
      var k = groupKey(p);
      if (!Object.prototype.hasOwnProperty.call(seen, k)) seen[k] = ++n;
      map[p.id] = seen[k];
    });
    return map;
  }
  // [{ lead, others }] in order of first appearance; lead is the first member met.
  function collapseGroups(list) {
    var out = [];
    var at = {};
    (list || []).forEach(function (p) {
      if (!p) return;
      var k = groupKey(p);
      if (Object.prototype.hasOwnProperty.call(at, k)) out[at[k]].others.push(p);
      else { at[k] = out.length; out.push({ lead: p, others: [] }); }
    });
    return out;
  }
  // The sentence for a program whose freeStuff text is empty.
  function freeNote(p) {
    p = p || {};
    var offers = Array.isArray(p.offers) ? p.offers : [];
    var reqs = Array.isArray(p.requirements) ? p.requirements : [];
    var first = offers[0];
    if (p.certainty === 'chance' || first === 'sweepstakes' || first === 'testing') return 'Nothing arrives unless you are picked.';
    if (reqs.indexOf('purchase') !== -1 || p.costToClaim === 'purchase-required') return 'Nothing arrives free without a purchase.';
    if (reqs.indexOf('membership') !== -1 || p.costToClaim === 'membership-required') return 'Nothing arrives free without a paid membership.';
    if (p.costToClaim === 'shipping-fee') return 'Not fully free. You pay a shipping fee.';
    if (first === 'cash') return 'This pays money. No product is sent.';
    if (first === 'coverage') return 'This covers a cost. No product is sent.';
    if (first === 'service') return 'This is a free service. No product is sent.';
    if (first === 'coupons') return 'This gives coupons or discounts. Nothing arrives free without a purchase.';
    if (first === 'points') return 'This gives points for purchases. Nothing arrives free without a purchase.';
    return 'What arrives is not stated.';
  }

  function stateOf(x) {
    return typeof x === 'string' ? x.trim().toUpperCase() : '';
  }
  function statesOf(p) {
    return p && Array.isArray(p.states) ? p.states : [];
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

  // ---- kinds (tabs) ----
  var KINDS = [
    { id: 'stuff', label: 'Free stuff' },
    { id: 'money', label: 'Money' },
    { id: 'care', label: 'Care and cover' }
  ];
  // By the first offer. Unknown or missing offers count as stuff.
  function kindOf(p) {
    var first = firstOffer(p);
    if (first === 'cash') return 'money';
    if (first === 'service' || first === 'coverage') return 'care';
    return 'stuff';
  }

  // ---- fit: the person's answers in My info against a program's audience ----
  var COVERS = ['private', 'marketplace', 'medicaid', 'tricare', 'none'];
  function ans(profile, key) {
    var v = profile && typeof profile === 'object' && typeof profile[key] === 'string' ? profile[key].trim() : '';
    return v;
  }
  function coverOf(profile) {
    var c = ans(profile, 'cover');
    return COVERS.indexOf(c) === -1 ? '' : c;
  }
  function yesNo(profile, key) {
    var v = ans(profile, key);
    return v === 'yes' || v === 'no' ? v : '';
  }
  // 'yes', 'no' or '' (unknown) for one audience tag.
  function tagFit(tag, p, profile) {
    var cover = coverOf(profile);
    var low = yesNo(profile, 'lowIncome');
    var job = yesNo(profile, 'job');
    var ins = ans(profile, 'insurer');
    switch (tag) {
      case 'medicaid': return !cover ? '' : cover === 'medicaid' ? 'yes' : 'no';
      case 'wic':
      case 'low-income':
        if (low) return low;
        return cover === 'medicaid' ? 'yes' : '';
      case 'insured': return !cover ? '' : cover === 'none' ? 'no' : 'yes';
      case 'marketplace': return !cover ? '' : cover === 'marketplace' ? 'yes' : 'no';
      case 'military': return !cover ? '' : cover === 'tricare' ? 'yes' : 'no';
      case 'employer': return job === 'no' ? 'no' : '';
      case 'worker': return job;
      case 'member':
        if (ins) return p && ins === p.insurer ? 'yes' : 'no';
        return cover === 'none' ? 'no' : '';
      default: return '';
    }
  }
  function fit(p, profile) {
    var tags = p && Array.isArray(p.audience) ? p.audience : [];
    if (!tags.length) return 'yes';
    var allYes = true;
    for (var i = 0; i < tags.length; i++) {
      var f = tagFit(tags[i], p, profile);
      if (f === 'no') return 'no';
      if (f !== 'yes') allYes = false;
    }
    return allYes ? 'yes' : 'maybe';
  }
  function hasSituation(profile) {
    return !!(coverOf(profile) || ans(profile, 'insurer') || yesNo(profile, 'lowIncome') || yesNo(profile, 'job'));
  }
  // True when the answers rule the program out. A program the person is already
  // working on (a status other than todo) is never hidden.
  function hiddenByAnswers(p, profile, status) {
    if (status && status !== 'todo') return false;
    return fit(p, profile) === 'no';
  }
  function hiddenByAnswersCount(list, profile, statusOf) {
    return (list || []).filter(function (p) {
      return p && hiddenByAnswers(p, profile, typeof statusOf === 'function' ? statusOf(p.id) : '');
    }).length;
  }

  // ---- what My info is missing for a program ----
  var MISSING_KEYS = ['state', 'cover', 'insurer', 'lowIncome', 'job'];
  var MISSING_LABELS = { state: 'your state', cover: 'your health cover', insurer: 'your health plan', lowIncome: 'your income answer', job: 'your paid job answer' };
  var MISSING_SHORT = { state: 'Your state', cover: 'Health cover', insurer: 'Health plan', lowIncome: 'Income', job: 'Paid job' };
  // Keys (in MISSING_KEYS order) of the My info answers that would settle whether the program applies.
  // [] when nothing is missing or the program is already ruled out.
  function missingInfo(p, profile) {
    if (!p || typeof p !== 'object') return [];
    var st = statesOf(p);
    var mine = profile && typeof profile === 'object' ? stateOf(profile.state) : '';
    if (st.length && mine && !st.some(function (x) { return stateOf(x) === mine; })) return [];
    if (fit(p, profile) === 'no') return [];
    var need = {};
    if (st.length && !mine) need.state = true;
    var cover = coverOf(profile), low = yesNo(profile, 'lowIncome'), job = yesNo(profile, 'job'), ins = ans(profile, 'insurer');
    var tags = Array.isArray(p.audience) ? p.audience : [];
    tags.forEach(function (t) {
      if ((t === 'medicaid' || t === 'insured' || t === 'marketplace' || t === 'military') && !cover) need.cover = true;
      else if ((t === 'wic' || t === 'low-income') && !low && cover !== 'medicaid') need.lowIncome = true;
      else if ((t === 'worker' || t === 'employer') && !job) need.job = true;
      else if (t === 'member' && !ins && cover !== 'none') need.insurer = true;
    });
    return MISSING_KEYS.filter(function (k) { return need[k] === true; });
  }
  // { total, keys: {state, cover, ...} }. With statusOf, programs already acted on (not todo) are skipped.
  function missingInfoCounts(list, profile, statusOf) {
    var out = { total: 0, keys: {} };
    MISSING_KEYS.forEach(function (k) { out.keys[k] = 0; });
    (list || []).forEach(function (p) {
      if (!p) return;
      if (typeof statusOf === 'function') {
        var s = statusOf(p.id);
        if (s && s !== 'todo') return;
      }
      var m = missingInfo(p, profile);
      if (!m.length) return;
      out.total++;
      m.forEach(function (k) { out.keys[k]++; });
    });
    return out;
  }
  function joinAnd(items) {
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  function missingInfoText(keys) {
    return joinAnd((keys || []).map(function (k) { return MISSING_LABELS[k]; }).filter(Boolean));
  }
  function onlyInText(p) {
    var st = statesOf(p);
    return st.length ? 'Only in ' + joinAnd(st.map(String)) : '';
  }

  // ---- the Tracker's own list ----
  // One pass over the programs in rank order. Anything the person has acted on is its own row.
  // To-do programs for other states, ruled out by the answers, or covered by a same-thing sign-up
  // are left out (and counted) unless opts.all is set. To-do alternates fold under their lead.
  function trackerScope(list, opts) {
    opts = opts || {};
    var statusOf = typeof opts.statusOf === 'function' ? opts.statusOf : function () { return 'todo'; };
    var ranked = rankPrograms(list);
    var out = { rows: [], left: { otherState: 0, noFit: 0, covered: 0 }, total: ranked.length };
    var covered = {};
    var leads = {};
    var sit = hasSituation(opts.profile);
    ranked.forEach(function (p) {
      var st = statusOf(p.id);
      if (st === 'signed-up' || st === 'received') covered[groupKey(p)] = true;
    });
    ranked.forEach(function (p) {
      var st = statusOf(p.id) || 'todo';
      if (st !== 'todo') { out.rows.push({ p: p, status: st, others: [] }); return; }
      var k = groupKey(p);
      if (!opts.all) {
        if (hiddenByState(p, opts.state) && !opts.showOtherStates) { out.left.otherState++; return; }
        if (sit && hiddenByAnswers(p, opts.profile, 'todo') && !opts.showNoFit) { out.left.noFit++; return; }
        if (Object.prototype.hasOwnProperty.call(covered, k)) { out.left.covered++; return; }
      }
      if (Object.prototype.hasOwnProperty.call(leads, k)) leads[k].others.push(p);
      else { leads[k] = { p: p, status: 'todo', others: [] }; out.rows.push(leads[k]); }
    });
    return out;
  }
  // weeks is what weeksUntil returns (whole weeks, or null without a due date).
  function readyNow(p, weeks) {
    var w = typeof weeks === 'number' && isFinite(weeks) ? weeks : null;
    if (w !== null && w < 0) return true;
    var when = p ? p.when : '';
    if (when === 'pregnancy' || when === 'anytime') return true;
    return w !== null && w <= 8 && when === 'late-pregnancy';
  }
  function isOptionalVerdict(p) {
    var v = verdict(p);
    return v === 'conditional' || v === 'longshot';
  }
  // To-do rows only: { now, later, optional }, each in rank order (later: last weeks before after birth).
  function trackerSections(rows, weeks) {
    var sec = { now: [], later: [], optional: [] };
    (rows || []).forEach(function (r) {
      if (!r || r.status !== 'todo') return;
      if (isOptionalVerdict(r.p)) sec.optional.push(r);
      else if (readyNow(r.p, weeks)) sec.now.push(r);
      else sec.later.push(r);
    });
    var order = sec.later.map(function (r, i) { return { r: r, i: i }; });
    order.sort(function (a, b) {
      var x = a.r.p.when === 'late-pregnancy' ? 0 : 1, y = b.r.p.when === 'late-pregnancy' ? 0 : 1;
      return x - y || a.i - b.i;
    });
    sec.later = order.map(function (o) { return o.r; });
    return sec;
  }
  // What is still to claim: to-do rows that are not optional, lead programs only.
  function toClaim(rows) {
    var free = [], cash = [];
    (rows || []).forEach(function (r) {
      if (!r || r.status !== 'todo' || isOptionalVerdict(r.p)) return;
      (kindOf(r.p) === 'money' ? cash : free).push(r.p);
    });
    return { free: totalValue(free), money: totalValue(cash) };
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
      if (opts.kind && opts.kind !== 'all' && kindOf(p) !== opts.kind) return false;
      if (opts.hideNoFit && hiddenByAnswers(p, opts.profile, typeof opts.statusOf === 'function' ? opts.statusOf(p.id) : '')) return false;
      if (opts.fitsMine && fit(p, opts.profile) !== 'yes') return false;
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
    var seenKeys = {};
    var keyCount = 0;
    (list || []).forEach(function (p, i) {
      if (!p) return;
      var lo = num(p.valueLow), hi = num(p.valueHigh);
      var key = (p.sameAs || '') || p.id || ('#' + i);
      if (!Object.prototype.hasOwnProperty.call(seenKeys, key)) { seenKeys[key] = true; keyCount++; }
      if (lo === null || hi === null) return;
      var g = groups[key];
      if (!g) { groups[key] = { low: lo, high: hi }; order.push(key); }
      else if (hi > g.high) { g.low = lo; g.high = hi; }
    });
    var t = { low: 0, high: 0, count: order.length, missing: keyCount - order.length };
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
    groupKey: groupKey,
    collapseGroups: collapseGroups,
    freeNote: freeNote,
    hiddenByState: hiddenByState,
    otherStateCount: otherStateCount,
    needsQualifying: needsQualifying,
    KINDS: KINDS,
    kindOf: kindOf,
    fit: fit,
    hasSituation: hasSituation,
    hiddenByAnswers: hiddenByAnswers,
    hiddenByAnswersCount: hiddenByAnswersCount,
    money: money,
    roundTotal: roundTotal,
    valueText: valueText,
    totalValue: totalValue,
    weeksUntil: weeksUntil,
    isEmailOnly: isEmailOnly,
    needsRegistry: needsRegistry,
    isEligibilityBased: isEligibilityBased,
    guidedDefault: guidedDefault,
    MISSING_KEYS: MISSING_KEYS,
    MISSING_LABELS: MISSING_LABELS,
    MISSING_SHORT: MISSING_SHORT,
    missingInfo: missingInfo,
    missingInfoCounts: missingInfoCounts,
    missingInfoText: missingInfoText,
    onlyInText: onlyInText,
    trackerScope: trackerScope,
    readyNow: readyNow,
    trackerSections: trackerSections,
    toClaim: toClaim,
    filterPrograms: filterPrograms,
    sortPrograms: sortPrograms,
    domainOf: domainOf,
    escapeHtml: escapeHtml
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.BFF = root.BFF || {}; root.BFF.logic = api; }
})(typeof window !== 'undefined' ? window : globalThis);
