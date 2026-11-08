// Pure helpers: decide what a form field is for, and how to format the value.
// No Playwright import, so this file can be unit-tested on its own.

const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Input types we never touch.
const SKIP_TYPES = new Set(['hidden', 'password', 'search', 'checkbox', 'radio',
  'file', 'submit', 'button', 'reset', 'image', 'color', 'range']);

// Words that mean "do not fill this", checked against label/name/id/placeholder.
const SKIP_WORDS = /\b(password|passwd|pwd|passcode|pin|card|credit|debit|cc|ccnum|cvv|cvc|cvn|csc|security code|expir\w*|ssn|social security|insurance|insurer|member id|member number|policy|subscriber|medicaid|medicare|wic|case number|bank|routing|account number|search|captcha|promo|coupon|referral)\b/;
// Names that belong to someone else or something else.
const OTHER_NAME = /\b(baby|child|children|infant|newborn|spouse|partner|friend|referr\w*|recipient|company|business|organization|employer|username|user name|nickname|pet|hospital|doctor|physician|provider)\b/;

// Fields about other people, other roles or other things: never filled, whatever
// else the field looks like (applies to every kind, not just names).
const OTHER_PERSON = /\b(spouse|partner|husband|wife|fianc\w*|doctor|dr|physician|ob|obgyn|midwife|doula|provider|hospital|clinic|pediatrician|gift|recipient|friend|referr\w*|referral|emergency|contact person|guardian|grandparent\w*|grandmother|grandfather|sibling|sister|brother|relative|caregiver|nanny|sponsor|witness|manager|supervisor|teacher|employer|company|business|organization|work|other parent|second parent|mother s|father s|mom s|dad s)\b/;
// Not the value we have, even though a keyword matches.
const OTHER_THING = /\b(last menstrual\w*|menstrual|lmp|first time|phone type|mobile type|cell type|phone carrier|carrier|contact preference|preferred contact|best time|email type|address type|how did you hear)\b/;
// Honeypot / bot-trap names.
const HONEYPOT = /\b(honeypot|honey pot|hp|hpot|leave blank|leave empty|do not fill|dont fill|bot trap|trap|url2|website2|fax)\b/;

const AUTOCOMPLETE = {
  'given-name': 'firstName',
  'family-name': 'lastName',
  name: 'fullName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-line1': 'address1',
  'street-address': 'address1',
  'address-line2': 'address2',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'zip',
};

// Lowercase, split camelCase and punctuation into plain words.
function norm(s) {
  return String(s ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

function fromText(text, type) {
  const t = text;
  if (!t) return null;
  const has = (re) => re.test(t);
  const dueCtx = has(/\b(due|expected|edd|delivery|baby s birth|birth date of baby)\b/);

  if (dueCtx) {
    if (type === 'date') return 'dueDate';
    if (has(/\bmonth\b|\bmm\b/)) return 'dueMonth';
    if (has(/\bday\b|\bdd\b/)) return 'dueDay';
    if (has(/\byear\b|\byyyy\b/)) return 'dueYear';
    if (has(/\bdate\b|\bedd\b|\bdue\b|\bexpected\b/)) return 'dueDate';
  }
  if (has(/\be mail\b|\bemail\b/)) return 'email';
  if (has(/\b(phone|mobile|cell|telephone|tel)\b/)) return 'phone';
  if (has(/\b(zip|zipcode|postal|postcode)\b/)) return 'zip';
  if (has(/\bcity\b|\btown\b/)) return 'city';
  if (has(/\b(state|province)\b/) && !has(/\bstatement\b/)) return 'state';
  if (has(/\b(address|addr|street)\b.*\b(2|two|line 2)\b|\baddress2\b|\baddr2\b|\b(apt|apartment|suite|unit)\b|\bline 2\b|\bline2\b/)) return 'address2';
  if (has(/\b(address|addr|street)\b/)) return 'address1';
  if (OTHER_NAME.test(t)) return null;
  if (has(/\b(first name|firstname|fname|given name|forename)\b|^first$/)) return 'firstName';
  if (has(/\b(last name|lastname|lname|surname|family name)\b|^last$/)) return 'lastName';
  if (has(/\b(full name|your name|name)\b/)) return 'fullName';
  return null;
}

// ---- Pure helpers used by the CLI (kept here so they can be tested) ----

/** Remove ANSI/OSC escapes and control characters, trim, truncate. */
export function cleanText(s, max = 80) {
  let t = String(s ?? '')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g, '')
    .replace(/\u001b\[[0-9;?]*[ -\/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > max) t = t.slice(0, max - 3) + '...';
  return t;
}

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
/** Registrable domain, approximated: last two labels (three for co.uk style). */
export function registrableDomain(urlOrHost) {
  let host = String(urlOrHost || '');
  try { host = new URL(host).hostname; } catch { /* already a host */ }
  const labels = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1];
  const take = tld.length === 2 && SECOND_LEVEL.has(labels[labels.length - 2]) ? 3 : 2;
  return labels.slice(-take).join('.');
}
export function sameSite(a, b) {
  const x = registrableDomain(a);
  return x !== '' && x === registrableDomain(b);
}

/** Same rule as guidedDefault in src/js/logic.js (truly free, not eligibility based). */
export function isGuidedDefault(p) {
  if (!p || p.costToClaim !== 'free') return false;
  const r = Array.isArray(p.requirements) ? p.requirements : [];
  if (r.includes('purchase') || r.includes('membership')) return false;
  if (p.category === 'health-benefits' || p.category === 'assistance') return false;
  return !(r.includes('eligibility') || r.includes('insurance'));
}

export function classifyField(f = {}) {
  const type = String(f.type || 'text').toLowerCase();
  if (SKIP_TYPES.has(type)) return null;

  const ac = String(f.autocomplete || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (ac.some((t) => t.startsWith('cc-') || t.includes('password') || t === 'one-time-code' || t === 'username')) return null;
  const acToken = ac.filter((t) => !/^(section-|shipping|billing|home|work|mobile|fax|pager)/.test(t)).pop();
  const acKind = acToken ? AUTOCOMPLETE[acToken] : undefined;
  // Skip rules still win over a mislabelled autocomplete token.
  const parts = [f.label, f.ariaLabel, f.name, f.id, f.placeholder].map(norm).filter(Boolean);
  const all = parts.join(' ');
  if (SKIP_WORDS.test(all) || OTHER_PERSON.test(all) || OTHER_THING.test(all) || HONEYPOT.test(all)) return null;

  if (acKind) return acKind;
  if (acToken === 'bday' || acToken?.startsWith('bday-')) return null;

  if (type === 'email') return 'email';
  if (type === 'tel') return 'phone';
  if (type === 'date') {
    // Only a due/expected date; a plain birthday is the parent's own.
    return /\b(due|expected|edd|delivery|baby)\b/.test(all) ? 'dueDate' : null;
  }
  if (type === 'number' && !/\b(zip|postal|due|month|day|year|phone)\b/.test(all)) return null;

  // Label first, then name, id, placeholder, aria-label.
  const order = [f.label, f.ariaLabel, f.name, f.id, f.placeholder];
  for (const raw of order) {
    const k = fromText(norm(raw), type);
    if (k) return k;
  }
  // Context spread over several attributes (e.g. label "Due date", name "month").
  return fromText(all, type);
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  return { y: m[1], m: m[2], d: m[3] };
}

function optList(options) {
  return (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : { value: String(o.value ?? ''), label: String(o.label ?? o.text ?? o.value ?? '') }));
}

function pickOption(options, predicate) {
  const hit = optList(options).find((o) => o.value !== '' && (predicate(norm(o.value), o.value) || predicate(norm(o.label), o.label)));
  return hit ? hit.value : null;
}

/**
 * Format the profile value for a field kind.
 * Returns a string to fill/select, or null if nothing sensible fits.
 * For selects pass opts.options ([{value,label}] or strings); the returned
 * string is then an option value.
 */
export function valueFor(kind, profile = {}, opts = {}) {
  const { inputType = 'text', options = null } = opts;
  const isSelect = Array.isArray(options);
  const p = profile || {};
  const str = (v) => (v == null ? '' : String(v).trim());
  const out = (v) => (str(v) === '' ? null : str(v));

  switch (kind) {
    case 'firstName': case 'lastName': case 'email': case 'phone':
    case 'address1': case 'address2': case 'city': case 'zip':
      return out(p[kind]);
    case 'fullName':
      return out([p.firstName, p.lastName].map(str).filter(Boolean).join(' '));
    case 'state': {
      const raw = str(p.state);
      if (!raw) return null;
      const upper = raw.toUpperCase();
      const code = STATES[upper] ? upper : Object.keys(STATES).find((c) => STATES[c].toLowerCase() === raw.toLowerCase());
      if (!code) return isSelect ? null : raw;
      if (!isSelect) return code;
      const full = STATES[code].toLowerCase();
      return pickOption(options, (n, orig) => n === code.toLowerCase() || n === full || norm(orig) === full);
    }
    case 'dueDate': {
      const d = parseDate(p.dueDate);
      if (!d || isSelect) return null;
      return inputType === 'date' ? `${d.y}-${d.m}-${d.d}` : `${d.m}/${d.d}/${d.y}`;
    }
    case 'dueMonth': {
      const d = parseDate(p.dueDate);
      if (!d) return null;
      const n = Number(d.m);
      if (!isSelect) return d.m;
      const name = MONTHS[n - 1].toLowerCase();
      return pickOption(options, (x) => x === name || x === name.slice(0, 3) || x.startsWith(name + ' ') || (/^\d+$/.test(x) && Number(x) === n));
    }
    case 'dueDay': {
      const d = parseDate(p.dueDate);
      if (!d) return null;
      if (!isSelect) return d.d;
      return pickOption(options, (x) => /^\d+$/.test(x) && Number(x) === Number(d.d));
    }
    case 'dueYear': {
      const d = parseDate(p.dueDate);
      if (!d) return null;
      if (!isSelect) return d.y;
      return pickOption(options, (x) => x === d.y);
    }
    default:
      return null;
  }
}
