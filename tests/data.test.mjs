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
  'id', 'name', 'brand', 'category', 'whatYouGet', 'costToClaim', 'costDetail',
  'requirements', 'eligibility', 'region', 'signupUrl', 'sourceUrls', 'verifiedOn',
  'confidence', 'catches', 'notes',
];
const STRING_KEYS = EXPECTED_KEYS.filter((k) => !['requirements', 'sourceUrls'].includes(k));
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
  if (n >= 3 && labels[n - 1].length === 2 && SLD_LABELS.has(labels[n - 2])) {
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
    for (const k of ['requirements', 'sourceUrls']) {
      if (!Array.isArray(p[k]) || p[k].some((v) => typeof v !== 'string')) {
        return `${k} must be an array of strings`;
      }
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

test('signupUrl shares a registrable domain with at least one sourceUrl', () => {
  check('official domain', (p) => {
    const signup = parseHttpsUrl(p.signupUrl);
    if (signup.error) return signup.error;
    const want = registrableDomain(signup.url.hostname);
    const got = p.sourceUrls
      .map((s) => parseHttpsUrl(s).url)
      .filter(Boolean)
      .map((u) => registrableDomain(u.hostname));
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
