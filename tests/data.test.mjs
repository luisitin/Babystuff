// Schema and link checks for data/programs.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = readFileSync(join(root, 'data', 'programs.json'), 'utf8');
const programs = JSON.parse(raw);

const EXPECTED_KEYS = [
  'id', 'name', 'brand', 'category', 'whatYouGet', 'offers', 'certainty', 'freeStuff',
  'valueLow', 'valueHigh', 'valueSource', 'valueBasis', 'costToClaim', 'costDetail',
  'requirements', 'eligibility', 'region', 'states', 'effort', 'when', 'whenNote',
  'signupUrl', 'sourceUrls', 'verifiedOn', 'confidence', 'catches', 'notes', 'sameAs',
];
const ARRAY_KEYS = ['offers', 'requirements', 'states', 'sourceUrls'];
const NUMBER_KEYS = ['valueLow', 'valueHigh'];
const STRING_KEYS = EXPECTED_KEYS.filter((k) => !ARRAY_KEYS.includes(k) && !NUMBER_KEYS.includes(k));
const CATEGORIES = ['formula', 'diapers-wipes', 'registry-box', 'feeding', 'baby-care', 'rewards',
  'health-benefits', 'assistance', 'money', 'product-testing'];
const COST_TO_CLAIM = ['free', 'shipping-fee', 'purchase-required', 'membership-required'];
const CONFIDENCE = ['high', 'medium', 'low'];
const REQUIREMENTS = ['email', 'address', 'phone', 'due-date', 'registry', 'app', 'purchase',
  'membership', 'insurance', 'eligibility'];
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BLOCKED_SIGNUP_DOMAINS = ['hip2save.com', 'coupons.com', 'thekrazycouponlady.com', 'freebieshark.com',
  'yotpo.com', 'reddit.com', 'facebook.com', 'pinterest.com', 'bit.ly', 'tinyurl.com'];

// Approximate registrable domain: last two labels, or last three when the
// second-to-last label is a known SLD under a two-letter country code.
const SLD_LABELS = new Set(['gov', 'org', 'com', 'co', 'net', 'edu', 'ac']);
function registrableDomain(hostname) {
  const labels = hostname.toLowerCase().split('.');
  const n = labels.length;
  const stateUs = n >= 3 && labels[n - 1] === 'us' && labels[n - 2].length === 2;
  if (stateUs || (n >= 3 && labels[n - 1].length === 2 && SLD_LABELS.has(labels[n - 2]))) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

// Collects a message per failing entry so one test lists every problem.
function check(label, predicate) {
  const problems = [];
  for (const p of programs) {
    const msg = predicate(p);
    if (msg) problems.push(`${p && p.id ? p.id : '(no id)'}: ${msg}`);
  }
  assert.deepEqual(problems, [], label);
}

function parseHttpsUrl(value) {
  if (typeof value !== 'string') return { error: 'not a string' };
  let u;
  try {
    u = new URL(value);
  } catch {
    return { error: `does not parse: ${value}` };
  }
  if (u.protocol !== 'https:') return { error: `not https: ${value}` };
  if (u.username || u.password) return { error: `has credentials: ${value}` };
  return { url: u };
}

test('data parses and is a non-empty array', () => {
  assert.ok(Array.isArray(programs), 'top level must be an array');
  assert.ok(programs.length > 0, 'array must not be empty');
});

test('every entry has exactly the schema keys with the right types', () => {
  const expected = [...EXPECTED_KEYS].sort();
  check('keys', (p) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'not an object';
    const keys = Object.keys(p).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      const missing = expected.filter((k) => !keys.includes(k));
      const extra = keys.filter((k) => !expected.includes(k));
      return `keys mismatch (missing: [${missing}], extra: [${extra}])`;
    }
    for (const k of STRING_KEYS) {
      if (typeof p[k] !== 'string') return `${k} must be a string`;
    }
    for (const k of ARRAY_KEYS) {
      if (!Array.isArray(p[k]) || p[k].some((v) => typeof v !== 'string')) {
        return `${k} must be an array of strings`;
      }
    }
    for (const k of NUMBER_KEYS) {
      if (p[k] !== null && !Number.isInteger(p[k])) return `${k} must be an integer or null`;
    }
    return null;
  });
});

test('ids are unique and kebab-case', () => {
  check('id format', (p) => (typeof p.id === 'string' && KEBAB.test(p.id)) ? null : `bad id "${p.id}"`);
  const seen = new Map();
  for (const p of programs) seen.set(p.id, (seen.get(p.id) || 0) + 1);
  const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  assert.deepEqual(dupes, [], 'duplicate ids');
});

test('name, brand, whatYouGet and signupUrl are non-empty', () => {
  for (const k of ['name', 'brand', 'whatYouGet', 'signupUrl']) {
    check(k, (p) => (typeof p[k] === 'string' && p[k].trim() !== '') ? null : `${k} is empty`);
  }
});

test('enumerated fields use allowed values', () => {
  check('category', (p) => CATEGORIES.includes(p.category) ? null : `category "${p.category}"`);
  check('costToClaim', (p) => COST_TO_CLAIM.includes(p.costToClaim) ? null : `costToClaim "${p.costToClaim}"`);
  check('confidence', (p) => CONFIDENCE.includes(p.confidence) ? null : `confidence "${p.confidence}"`);
});

test('requirements use only allowed values, with no duplicates', () => {
  check('requirements', (p) => {
    const bad = p.requirements.filter((r) => !REQUIREMENTS.includes(r));
    if (bad.length) return `unknown requirement(s): ${bad.join(', ')}`;
    const dupes = p.requirements.filter((r, i) => p.requirements.indexOf(r) !== i);
    if (dupes.length) return `duplicate requirement(s): ${dupes.join(', ')}`;
    return null;
  });
});

test('verifiedOn is a real calendar date and not in the future', () => {
  const today = new Date().toISOString().slice(0, 10);
  check('verifiedOn', (p) => {
    if (typeof p.verifiedOn !== 'string' || !DATE.test(p.verifiedOn)) return `format "${p.verifiedOn}"`;
    const [y, m, d] = p.verifiedOn.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
      return `not a real date "${p.verifiedOn}"`;
    }
    if (p.verifiedOn > today) return `in the future "${p.verifiedOn}" (today ${today})`;
    return null;
  });
});

test('signupUrl and every sourceUrl are https URLs without credentials', () => {
  check('signupUrl', (p) => parseHttpsUrl(p.signupUrl).error ?? null);
  check('sourceUrls', (p) => {
    if (!Array.isArray(p.sourceUrls) || p.sourceUrls.length === 0) return 'sourceUrls is empty';
    for (const s of p.sourceUrls) {
      const r = parseHttpsUrl(s);
      if (r.error) return r.error;
    }
    return null;
  });
});

// Known exception: Bright Start (brightstartsavings.com) is the Illinois Treasurer's 529 site, and
// the Treasurer's own pages (the sources) send families there. Revisit when a source on that domain
// is added; no other entry is exempt.
const SIGNUP_DOMAIN_EXCEPTIONS = { 'il-first-steps': 'brightstartsavings.com' };

test('signupUrl shares a registrable domain with at least one sourceUrl', () => {
  check('official domain', (p) => {
    const signup = parseHttpsUrl(p.signupUrl);
    if (signup.error) return signup.error;
    const want = registrableDomain(signup.url.hostname);
    const got = p.sourceUrls
      .map((s) => parseHttpsUrl(s).url)
      .filter(Boolean)
      .map((u) => registrableDomain(u.hostname));
    if (SIGNUP_DOMAIN_EXCEPTIONS[p.id] === want) return null;
    return got.includes(want) ? null : `signupUrl domain ${want} not matched by any source (${[...new Set(got)].join(', ')})`;
  });
});

test('signupUrl is not on a coupon, blog or aggregator domain', () => {
  check('blocklist', (p) => {
    const r = parseHttpsUrl(p.signupUrl);
    if (r.error) return null; // reported by the URL test above
    const host = r.url.hostname.toLowerCase();
    const hit = BLOCKED_SIGNUP_DOMAINS.find((d) => host === d || host.endsWith('.' + d));
    return hit ? `signupUrl on blocked domain ${hit}` : null;
  });
});

test('costToClaim implies the matching requirement', () => {
  check('cost/requirement', (p) => {
    if (p.costToClaim === 'purchase-required' && !p.requirements.includes('purchase')) {
      return 'purchase-required but requirements lack "purchase"';
    }
    if (p.costToClaim === 'membership-required' && !p.requirements.includes('membership')) {
      return 'membership-required but requirements lack "membership"';
    }
    return null;
  });
});

// ---- Phase G: offers, certainty, value, timing, states ----

// Load the finished logic the same way tests/logic.test.mjs does.
const logicMod = { exports: {} };
new Function('module', readFileSync(join(root, 'src', 'js', 'logic.js'), 'utf8'))(logicMod);
const L = logicMod.exports;

const OFFERS = ['product', 'coupons', 'points', 'sweepstakes', 'service', 'coverage', 'cash', 'testing'];
const CERTAINTY = ['guaranteed', 'likely', 'if-eligible', 'chance'];
const VALUE_SOURCE = ['official', 'estimate', 'none'];
const EFFORT = ['quick', 'some', 'involved'];
const WHEN = ['pregnancy', 'late-pregnancy', 'after-birth', 'anytime'];
const USPS = new Set(['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']);

test('keys appear in the documented order', () => {
  check('key order', (p) => JSON.stringify(Object.keys(p)) === JSON.stringify(EXPECTED_KEYS) ? null : 'key order differs');
});

test('offers, certainty, valueSource, effort and when use allowed values', () => {
  check('offers', (p) => {
    if (p.offers.length === 0) return 'offers is empty';
    const bad = p.offers.filter((o) => !OFFERS.includes(o));
    if (bad.length) return `unknown offer(s): ${bad.join(', ')}`;
    const dupes = p.offers.filter((o, i) => p.offers.indexOf(o) !== i);
    return dupes.length ? `repeated offer(s): ${dupes.join(', ')}` : null;
  });
  check('certainty', (p) => CERTAINTY.includes(p.certainty) ? null : `certainty "${p.certainty}"`);
  check('valueSource', (p) => VALUE_SOURCE.includes(p.valueSource) ? null : `valueSource "${p.valueSource}"`);
  check('effort', (p) => EFFORT.includes(p.effort) ? null : `effort "${p.effort}"`);
  check('when', (p) => WHEN.includes(p.when) ? null : `when "${p.when}"`);
});

test('value fields agree with valueSource and valueBasis', () => {
  check('values', (p) => {
    const bothNull = p.valueLow === null && p.valueHigh === null;
    const bothNum = Number.isInteger(p.valueLow) && Number.isInteger(p.valueHigh);
    if (!bothNull && !bothNum) return 'valueLow and valueHigh must both be integers or both null';
    if (bothNum && (p.valueLow < 0 || p.valueLow > p.valueHigh)) return `bad range ${p.valueLow} to ${p.valueHigh}`;
    if ((p.valueSource === 'none') !== bothNull) return `valueSource "${p.valueSource}" does not match the values`;
    if ((p.valueBasis.trim() === '') !== (p.valueSource === 'none')) return 'valueBasis must be empty exactly when valueSource is none';
    return null;
  });
});

test('states are uppercase USPS codes without repeats, and a state-only program says so in region', () => {
  check('states', (p) => {
    const bad = p.states.filter((s) => !USPS.has(s));
    if (bad.length) return `bad state code(s): ${bad.join(', ')}`;
    if (new Set(p.states).size !== p.states.length) return 'repeated state code';
    if (p.states.length && p.region.trim().toUpperCase() === 'US') return 'states set but region says only "US"';
    return null;
  });
});

test('the money category is allowed and has programs', () => {
  assert.ok(CATEGORIES.includes('money'));
  assert.ok(L.CATEGORIES.some((c) => c.id === 'money'));
  assert.ok(programs.some((p) => p.category === 'money'), 'no money programs');
});

test('programs are ordered by category, then name', () => {
  const idx = (p) => L.CATEGORIES.findIndex((c) => c.id === p.category);
  check('order', (p) => {
    const i = programs.indexOf(p);
    const prev = programs[i - 1];
    if (!prev) return null;
    if (idx(prev) > idx(p)) return `category ${p.category} comes after ${prev.category}`;
    if (idx(prev) === idx(p) && prev.name.localeCompare(p.name, 'en', { sensitivity: 'base' }) > 0) {
      return `name sorts before previous entry "${prev.name}"`;
    }
    return null;
  });
});

test('a program needing a purchase or membership says so and has no freeStuff', () => {
  check('paid conditions', (p) => {
    const paid = p.requirements.includes('purchase') || p.requirements.includes('membership');
    if (paid && p.freeStuff !== '') return 'needs a purchase or membership but freeStuff is not empty';
    if (p.costToClaim === 'purchase-required' && !p.requirements.includes('purchase')) return 'purchase-required without purchase';
    if (p.costToClaim === 'membership-required' && !p.requirements.includes('membership')) return 'membership-required without membership';
    if (paid && p.costToClaim === 'free') return 'purchase or membership required but costToClaim is free';
    return null;
  });
});

test('selection-based programs are marked as a chance', () => {
  check('chance', (p) => ['sweepstakes', 'testing'].includes(p.offers[0]) && p.certainty !== 'chance'
    ? `first offer ${p.offers[0]} but certainty ${p.certainty}` : null);
});

test('text fields have no line-separator, replacement or non-ASCII characters', () => {
  const bad = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0xfffd) + ']');
  assert.ok(!bad.test(raw), 'raw U+2028, U+2029 or U+FFFD in data');
  assert.ok(!/[^\x00-\x7f]/.test(raw), 'non-ASCII character in data');
});

test('no program whose first offer is sweepstakes, coupons, points or testing is truly free', () => {
  check('truly free', (p) => ['sweepstakes', 'coupons', 'points', 'testing'].includes(p.offers[0]) && L.isTrulyFree(p)
    ? `first offer ${p.offers[0]} passes isTrulyFree` : null);
});

test('every program that is truly free has a non-empty freeStuff', () => {
  check('freeStuff', (p) => L.isTrulyFree(p) && p.freeStuff.trim() === '' ? 'truly free but freeStuff is empty' : null);
  assert.ok(programs.filter((p) => L.isTrulyFree(p)).length > 0, 'no truly free programs at all');
});

test('sameAs is a string; when set it names another main program', () => {
  const byId = new Map(programs.map((p) => [p.id, p]));
  check('sameAs', (p) => {
    if (typeof p.sameAs !== 'string') return 'sameAs must be a string';
    if (p.sameAs === '') return null;
    if (p.sameAs === p.id) return 'sameAs names itself';
    const main = byId.get(p.sameAs);
    if (!main) return `sameAs names a missing id "${p.sameAs}"`;
    if (main.sameAs !== '') return `main program "${main.id}" has its own sameAs`;
    return null;
  });
});

test('the insurance-covered breast pump suppliers point to the one main benefit', () => {
  const ids = ['edgepark-breast-pump-insurance', 'byram-healthcare-breast-pumps-insurance',
    '1-natural-way-breast-pump-insurance', 'aeroflow-breastpumps-insurance', 'tricare-breast-pump-and-supplies'];
  for (const id of ids) {
    assert.equal(programs.find((p) => p.id === id).sameAs, 'healthcare-gov-insurance-covered-breast-pump', id);
  }
});

test('every registry completion discount is valued as an estimate', () => {
  const ids = ['amazon-baby-registry-completion-discount', 'macys-baby-registry-completion-discount',
    'babylist-registry-completion-discount', 'crate-and-kids-registry-completion-discount',
    'pottery-barn-kids-registry-completion-discount', 'target-registry-completion-discount',
    'bloomingdales-baby-registry-completion-discount'];
  for (const id of ids) {
    const p = programs.find((x) => x.id === id);
    assert.ok(p, `missing ${id}`);
    assert.equal(p.valueSource, 'estimate', id);
    assert.ok(/\$200 to \$600/.test(p.valueBasis), `${id} valueBasis should name the $200 to $600 scale`);
  }
});

test('a program whose only value is a partial refund of a cost needs a purchase', () => {
  const p = programs.find((x) => x.id === 'irs-child-dependent-care-credit-fsa');
  assert.equal(p.costToClaim, 'purchase-required');
  assert.ok(p.requirements.includes('purchase'));
});

test('merged-out ids are gone and the per-state paid leave entries exist', () => {
  const ids = new Set(programs.map((p) => p.id));
  assert.ok(!ids.has('state-paid-family-leave-programs'));
  assert.ok(!ids.has('baby-dove-newsletter-samples'));
  for (const id of ['ca-paid-family-leave-sdi', 'ny-paid-family-leave', 'wa-paid-family-medical-leave']) assert.ok(ids.has(id), id);
  assert.ok(!programs.find((p) => p.id === 'caresource-babies-first-rewards').states.includes('GA'));
});
