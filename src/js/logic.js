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

  var CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 };

  function reqs(p) {
    return p && Array.isArray(p.requirements) ? p.requirements : [];
  }
  function has(p, r) {
    return reqs(p).indexOf(r) !== -1;
  }

  function isTrulyFree(p) {
    return !!p && p.costToClaim === 'free' && !has(p, 'purchase') && !has(p, 'membership');
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
  function guidedDefault(p) {
    return isTrulyFree(p) && !isEligibilityBased(p);
  }

  function filterPrograms(list, opts) {
    opts = opts || {};
    var q = String(opts.query || '').trim().toLowerCase();
    return (list || []).filter(function (p) {
      if (opts.category && p.category !== opts.category) return false;
      if (opts.trulyFree && !isTrulyFree(p)) return false;
      if (opts.emailOnly && !isEmailOnly(p)) return false;
      if (opts.needsRegistry && !needsRegistry(p)) return false;
      if (q) {
        var hay = [p.name, p.brand, p.whatYouGet, p.notes, p.eligibility].join('\n').toLowerCase();
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

  function sortPrograms(list, key) {
    var copy = (list || []).slice();
    var cmp;
    if (key === 'verified') {
      cmp = function (a, b) {
        var x = a.verifiedOn || '', y = b.verifiedOn || '';
        return x === y ? byName(a, b) : x < y ? 1 : -1;
      };
    } else if (key === 'category') {
      cmp = function (a, b) { return catIndex(a) - catIndex(b) || byName(a, b); };
    } else if (key === 'confidence') {
      cmp = function (a, b) { return confRank(a) - confRank(b) || byName(a, b); };
    } else {
      cmp = byName;
    }
    return copy.sort(cmp);
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
    isTrulyFree: isTrulyFree,
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
