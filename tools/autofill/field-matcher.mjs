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
  if (has(/\b(first name|firstname|fname|given name|forename|first)\b/)) return 'firstName';
  if (has(/\b(last name|lastname|lname|surname|family name|last)\b/)) return 'lastName';
  if (has(/\b(full name|your name|name)\b/)) return 'fullName';
  return null;
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
  if (SKIP_WORDS.test(all)) return null;

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
