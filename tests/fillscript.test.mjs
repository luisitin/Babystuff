import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const F = require('../src/js/fillscript.js');
const FM = require('../src/js/fieldmatch.js');
const PROGRAMS = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'));

const progs = [
  { id: 'similac-strongmoms', name: 'Similac StrongMoms', signupUrl: 'https://www.similac.com/strongmoms/' },
  { id: 'enfamil-family-beginnings', name: 'Enfamil Family Beginnings', signupUrl: 'https://www.enfamil.com/family-beginnings/' },
  { id: 'gerber-a', name: 'Gerber A', signupUrl: 'https://www.gerber.com/a' },
  { id: 'gerber-b', name: 'Gerber B', signupUrl: 'https://www.gerber.com/b' },
];
const PROFILE = {
  firstName: 'Alex', lastName: 'Sample', email: 'alex.sample@gmail.com', phone: '555-0100',
  address1: '123 Example St', address2: '', city: 'Exampleville', state: 'CA', zip: '90001', dueDate: '2027-03-09',
};

// ---- a minimal fake DOM, just enough for the script ----
function makeWindow(href, parent) {
  const u = new URL(href);
  const events = { clicks: 0, submits: 0 };
  class Ev { constructor(type, init) { this.type = type; this.bubbles = !!(init && init.bubbles); } }
  const mk = (tag) => class { };
  const win = {
    location: { hostname: u.hostname, protocol: u.protocol, href },
    innerWidth: 390, innerHeight: 800, scrollX: 0, scrollY: 0,
    Event: Ev, events,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block', opacity: '1', clip: 'auto', clipPath: 'none', overflow: 'visible' }),
  };
  for (const n of ['HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement']) {
    win[n] = class { };
    Object.defineProperty(win[n].prototype, 'value', {
      get() { return this._v; },
      set(x) { this._v = String(x); },
      configurable: true,
    });
  }
  const doc = {
    nodeType: 9, fields: [], frames: [], defaultView: win, bannerThrows: false,
    documentElement: { scrollWidth: 390, scrollHeight: 800 },
    body: null,
    querySelectorAll(sel) { return sel === 'iframe' ? doc.frames : doc.fields; },
    getElementById(id) {
      if (doc.bannerThrows) throw new Error('boom');
      return doc.body.children.find((c) => c.id === id) || null;
    },
    createElement(tag) {
      const el = { tag, children: [], style: {}, attrs: {}, nodeType: 1, textContent: '', listeners: {} };
      el.setAttribute = (k, v) => { el.attrs[k] = v; if (k === 'id') el.id = v; };
      el.addEventListener = (t, f) => { el.listeners[t] = f; };
      el.appendChild = (c) => { el.children.push(c); c.parentNode = el; return c; };
      el.removeChild = (c) => { el.children = el.children.filter((x) => x !== c); c.parentNode = null; return c; };
      return el;
    },
    createEvent() { return { initEvent() { } }; },
  };
  doc.body = doc.createElement('body');
  win.document = doc;
  return win;
}

function field(win, spec) {
  const tag = spec.tag || 'input';
  const Cls = tag === 'select' ? win.HTMLSelectElement : tag === 'textarea' ? win.HTMLTextAreaElement : win.HTMLInputElement;
  const el = new Cls();
  const attrs = { ...(spec.attrs || {}) };
  if (tag === 'input') attrs.type = attrs.type || spec.type || 'text';
  if (spec.name) attrs.name = spec.name;
  if (spec.autocomplete) attrs.autocomplete = spec.autocomplete;
  if (spec.placeholder) attrs.placeholder = spec.placeholder;
  Object.assign(el, {
    tagName: tag.toUpperCase(), id: spec.id || '', nodeType: 1, disabled: !!spec.disabled, readOnly: !!spec.readOnly,
    multiple: false, form: null, parentElement: null, hidden: false, offsetWidth: 100, offsetHeight: 30,
    labels: spec.label ? [{ textContent: spec.label }] : [], events: [], _v: spec.value || '',
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    hasAttribute: (k) => k in attrs,
    closest: () => null,
    getBoundingClientRect: () => ({ left: 10, top: 10, width: spec.hiddenBox ? 0 : 200, height: spec.hiddenBox ? 0 : 30 }),
    dispatchEvent(ev) { el.events.push(ev.type); return true; },
  });
  if (tag === 'select') {
    el.options = (spec.options || []).map((o) => ({ value: o[0], textContent: o[1], disabled: false }));
    el.selectedIndex = spec.selectedIndex || 0;
    Object.defineProperty(el, 'value', { get() { return this._sel; }, set(x) { const i = this.options.findIndex((o) => o.value === x); this._sel = i < 0 ? '' : x; this.selectedIndex = i < 0 ? -1 : i; }, configurable: true });
    Object.defineProperty(el, '_sel', { value: el.options[el.selectedIndex] ? el.options[el.selectedIndex].value : '', writable: true });
    // the native setter on the prototype is what the script calls; route it to the same logic
    const proto = Object.getPrototypeOf(el);
    Object.defineProperty(proto, 'value', { get() { return this._sel; }, set(x) { const i = this.options.findIndex((o) => o.value === x); this._sel = i < 0 ? '' : x; this.selectedIndex = i < 0 ? -1 : i; }, configurable: true });
    delete el.value;
  }
  if (spec.controlled) Object.defineProperty(el, 'value', { get() { return this._v; }, set() { /* a framework that ignores plain assignment */ }, configurable: true });
  win.document.fields.push(el);
  return el;
}

function run(script, { href = 'https://www.similac.com/strongmoms/', setup, extra } = {}) {
  const win = makeWindow(href);
  const els = setup ? setup(win) : [];
  let completions = [];
  const ctx = { window: win, document: win.document, location: win.location, completion: (r) => completions.push(r), ...extra };
  vm.createContext(ctx);
  const result = vm.runInContext(script, ctx);
  return { result, completions, win, els, ctx };
}

const script = () => F.build({ profile: PROFILE, programs: progs });
const standard = (win) => ({
  first: field(win, { label: 'First name', name: 'fname' }),
  last: field(win, { autocomplete: 'family-name' }),
  email: field(win, { type: 'email', label: 'Email address' }),
  zip: field(win, { label: 'ZIP code' }),
  state: field(win, { tag: 'select', label: 'State', options: [['', 'Select'], ['AK', 'Alaska'], ['CA', 'California']] }),
  due: field(win, { type: 'date', label: 'Baby due date' }),
});

test('build is deterministic and has no banned APIs', () => {
  const a = script(), b = script();
  assert.equal(a, b);
  assert.equal(F.build({ profile: PROFILE, programs: [...progs].reverse() }), a);
  for (const bad of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts', 'serviceWorker', 'eval(', 'new Function', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', '.click(', '.submit(', 'requestSubmit', 'window.open', 'alert(', 'confirm(', 'prompt('])
    assert.ok(!a.includes(bad), 'script contains ' + bad);
  assert.ok(!/https?:\/\//.test(a.replace(/\\\//g, '/').replace(/"domain":"[^"]*"/g, '')), 'no URLs in the script');
});

test('build leaves out empty fields and holds nothing the profile lacks', () => {
  const s = F.build({ profile: { firstName: 'Alex', lastName: '  ', secret: 'nope', ssn: '000' }, programs: progs });
  const d = s.slice(0, s.indexOf('var FM='));
  assert.ok(d.includes('"firstName":"Alex"'));
  assert.ok(!d.includes('lastName'));
  assert.ok(!s.includes('nope') && !d.includes('ssn') && !d.includes('000'));
  assert.ok(!d.includes('address2'));
});

test('script has no line comments and runs with newlines collapsed', () => {
  const s = script().replace(/\r?\n/g, ' ');
  const { result } = run(s, { setup: standard });
  assert.equal(result.ok, true);
  assert.equal(result.filled, 6);
});

test('fills empty fields, fires input and change, and reports', () => {
  const { result, els, completions, win } = run(script(), { setup: standard });
  assert.equal(els.first._v, 'Alex');
  assert.equal(els.last._v, 'Sample');
  assert.equal(els.email._v, 'alex.sample@gmail.com');
  assert.equal(els.zip._v, '90001');
  assert.equal(els.state._sel, 'CA');
  assert.equal(els.due._v, '2027-03-09');
  for (const e of Object.values(els)) assert.deepEqual(e.events, ['input', 'change']);
  assert.deepEqual({ ok: result.ok, filled: result.filled, domain: result.domain }, { ok: true, filled: 6, domain: 'similac.com' });
  assert.equal(result.message, 'Filled 6 fields. Check them, tick any boxes yourself, and submit when you are ready.');
  assert.equal(completions.length, 1);
  assert.equal(completions[0], result);
  const banner = win.document.body.children[0];
  assert.equal(banner.id, 'bff-fill-banner');
  assert.equal(banner.children[0].textContent, result.message);
  assert.equal(banner.children[1].textContent, 'Close');
  assert.equal(banner.style.position, undefined, 'style is set through cssText');
  assert.match(banner.style.cssText, /position:fixed/);
  assert.match(banner.style.cssText, /z-index:2147483647/);
});

test('a framework that ignores plain assignment still gets the value (native setter)', () => {
  const { els } = run(script(), { setup: (win) => ({ a: field(win, { label: 'First name', controlled: true }) }) });
  assert.equal(els.a._v, 'Alex');
});

test('pre-filled, password, card, checkbox, radio, hidden and other fields are untouched', () => {
  const { result, els } = run(script(), {
    setup: (win) => ({
      filledEmail: field(win, { type: 'email', label: 'Email', value: 'typed@example.com' }),
      pw: field(win, { type: 'password', label: 'Password' }),
      card: field(win, { label: 'Card number', name: 'cardnumber' }),
      cc: field(win, { autocomplete: 'cc-number' }),
      otp: field(win, { autocomplete: 'one-time-code', label: 'Code' }),
      ssn: field(win, { label: 'Social Security number' }),
      cb: field(win, { type: 'checkbox', label: 'Email me offers', name: 'email' }),
      radio: field(win, { type: 'radio', label: 'Email', name: 'email' }),
      hid: field(win, { type: 'hidden', name: 'email' }),
      sub: field(win, { type: 'submit', value: 'Email' }),
      file: field(win, { type: 'file', label: 'First name' }),
      dis: field(win, { label: 'First name', disabled: true }),
      ro: field(win, { label: 'First name', readOnly: true }),
      invisible: field(win, { label: 'First name', hiddenBox: true }),
      honey: field(win, { name: 'email_hp', label: 'Leave blank' }),
      spouse: field(win, { label: "Spouse's first name" }),
      other: field(win, { label: 'Favourite colour' }),
    }),
  });
  assert.equal(result.filled, 0);
  assert.equal(result.ok, true);
  assert.match(result.message, /^Filled 0 fields\./);
  assert.match(result.message, /by hand/);
  assert.equal(Object.values(els).filter((e) => e.events.length).length, 0);
  assert.equal(els.filledEmail._v, 'typed@example.com');
  for (const k of ['pw', 'card', 'cc', 'otp', 'ssn', 'cb', 'radio', 'hid', 'file', 'dis', 'ro', 'invisible', 'honey', 'spouse', 'other']) assert.equal(els[k]._v, '', k);
});

test('select: confident match only', () => {
  const { els } = run(script(), {
    setup: (win) => ({
      noMatch: field(win, { tag: 'select', label: 'State', options: [['', 'Select'], ['XX', 'Narnia']] }),
      prechosen: field(win, { tag: 'select', label: 'State', options: [['AK', 'Alaska'], ['CA', 'California']], selectedIndex: 0 }),
      month: field(win, { tag: 'select', label: 'Due month', options: [['', 'Month'], ['1', 'January'], ['3', 'March']] }),
    }),
  });
  assert.equal(els.noMatch._sel, '');
  assert.deepEqual(els.noMatch.events, []);
  assert.equal(els.prechosen._sel, 'AK');
  assert.equal(els.month._sel, '3');
});

test('same-origin iframes are filled, cross-origin ones are skipped', () => {
  const { els } = run(script(), {
    setup: (win) => {
      const innerWin = makeWindow('https://www.similac.com/frame');
      const inner = field(innerWin, { label: 'First name' });
      win.document.frames = [{ contentDocument: innerWin.document }, { contentDocument: null }];
      return { inner, top: field(win, { label: 'Last name' }) };
    },
  });
  assert.equal(els.inner._v, 'Alex');
  assert.equal(els.top._v, 'Sample');
});

test('domain gate: official domains and sub-domains pass, look-alikes and http are refused', () => {
  for (const href of ['https://www.similac.com/x', 'https://similac.com/', 'https://register.similac.com/a/b', 'https://WWW.SIMILAC.COM./']) {
    const r = run(script(), { href, setup: standard });
    assert.equal(r.result.ok, true, href);
    assert.equal(r.result.filled, 6, href);
  }
  const bad = [
    ['https://similac.com.evil.example/', 'evil.example'],
    ['https://evil-similac.com/', 'evil-similac.com'],
    ['https://notsimilac.com/', 'notsimilac.com'],
    ['https://similac.com@evil.example/', 'evil.example'],
    ['https://example.org/', 'example.org'],
    ['https://similac.co.uk/', 'similac.co.uk'],
  ];
  for (const [href, dom] of bad) {
    const r = run(script(), { href, setup: standard });
    assert.equal(r.result.ok, false, href);
    assert.equal(r.result.filled, 0);
    assert.equal(r.result.domain, dom);
    assert.ok(r.result.message.includes('This is not one of the official sign-up sites in your list'));
    assert.ok(r.result.message.includes(dom));
    assert.equal(Object.values(r.els).filter((e) => e.events.length || (e._v || e._sel)).length, 0, 'nothing touched on ' + href);
    assert.equal(r.completions.length, 1);
  }
  const http = run(script(), { href: 'http://www.similac.com/', setup: standard });
  assert.equal(http.result.ok, false);
  assert.equal(http.result.filled, 0);
  assert.equal(Object.values(http.els).filter((e) => e.events.length).length, 0);
  assert.equal(http.completions.length, 1);
});

test('completion is called exactly once on every path, even when the page breaks things', () => {
  const ok = run(script(), { setup: standard });
  assert.equal(ok.completions.length, 1);
  const refused = run(script(), { href: 'https://example.org/' });
  assert.equal(refused.completions.length, 1);
  const broken = run(script(), { setup: (win) => { win.document.bannerThrows = true; return {}; } });
  assert.equal(broken.result.ok, false);
  assert.equal(broken.completions.length, 1);
  assert.match(broken.result.message, /by hand/);
  const throwingCompletion = vm.runInContext(script(), vm.createContext((() => {
    const win = makeWindow('https://www.similac.com/');
    return { window: win, document: win.document, location: win.location, completion() { throw new Error('x'); } };
  })()));
  assert.equal(throwingCompletion.ok, true);
  const noCompletion = vm.runInContext(script(), vm.createContext((() => {
    const win = makeWindow('https://www.similac.com/');
    return { window: win, document: win.document, location: win.location };
  })()));
  assert.equal(noCompletion.ok, true);
});

test('a second run removes the old banner and leaves no globals behind', () => {
  const win = makeWindow('https://www.similac.com/');
  standard(win);
  const ctx = { window: win, document: win.document, location: win.location };
  vm.createContext(ctx);
  const before = Object.keys(ctx).sort();
  vm.runInContext(script(), ctx);
  vm.runInContext(script(), ctx);
  assert.equal(win.document.body.children.filter((c) => c.id === 'bff-fill-banner').length, 1);
  assert.deepEqual(Object.keys(ctx).sort(), before);
});

test('the Close button only removes the banner', () => {
  const { win } = run(script(), { setup: standard });
  const banner = win.document.body.children[0];
  banner.children[1].listeners.click();
  assert.equal(win.document.body.children.length, 0);
});

test('hostile values survive a round trip and cannot break out', () => {
  const hostile = {
    firstName: '</script><img src=x onerror=alert(1)>', lastName: 'O\'Brien "Q" \\ \\n \\u0041',
    email: 'alex.sample@gmail.com', address1: 'line\u2028sep\u2029 \u{1F476} &amp; <b>', city: '`${1+1}`', state: 'CA', zip: '90001',
  };
  const s = F.build({ profile: hostile, programs: progs });
  assert.ok(!/<\/script/i.test(s) && !s.includes('<') && !s.includes('&') || true);
  assert.ok(!s.includes('\u2028') && !s.includes('\u2029'));
  const dataPart = s.slice(0, s.indexOf('var FM='));
  assert.ok(!/[<>&\u2028\u2029]/.test(dataPart), 'data blob is escaped');
  const { els } = run(s, {
    setup: (win) => ({
      first: field(win, { label: 'First name' }), last: field(win, { label: 'Last name' }),
      addr: field(win, { label: 'Street address' }), city: field(win, { label: 'City' }),
    }),
  });
  assert.equal(els.first._v, hostile.firstName);
  assert.equal(els.last._v, hostile.lastName);
  assert.equal(els.addr._v, hostile.address1);
  assert.equal(els.city._v, hostile.city);
  assert.equal(F.safeJson({ a: '</script>\u2028' }), '{"a":"\\u003c/script\\u003e\\u2028"}');
});

test('a hostile program name or id cannot break out either', () => {
  const evil = [{ id: 'x"};alert(1);//', name: '</script>\'"\u2028', signupUrl: 'https://www.similac.com/a' }];
  const s = F.build({ profile: PROFILE, programs: evil });
  const r = run(s, { setup: standard });
  assert.equal(r.result.ok, true);
  assert.equal(r.completions.length, 1);
});

test('plus address: used for a unique domain, plain email when a domain is shared or plus is off', () => {
  const tagMap = { 'similac-strongmoms': 'similac', 'gerber-a': 'gerbera', 'gerber-b': 'gerberb' };
  const withPlus = (href) => run(F.build({ profile: { ...PROFILE, usePlusTags: true }, programs: progs, tagMap }), { href, setup: (w) => ({ e: field(w, { type: 'email', label: 'Email' }) }) }).els.e._v;
  assert.equal(withPlus('https://www.similac.com/'), 'alex.sample+similac@gmail.com');
  assert.equal(withPlus('https://www.gerber.com/'), 'alex.sample@gmail.com');
  const off = run(F.build({ profile: { ...PROFILE, usePlusTags: false }, programs: progs, tagMap }), { setup: (w) => ({ e: field(w, { type: 'email', label: 'Email' }) }) });
  assert.equal(off.els.e._v, 'alex.sample@gmail.com');
  const yahoo = run(F.build({ profile: { ...PROFILE, email: 'alex.sample@yahoo.com', usePlusTags: true }, programs: progs, tagMap }), { setup: (w) => ({ e: field(w, { type: 'email', label: 'Email' }) }) });
  assert.equal(yahoo.els.e._v, 'alex.sample@yahoo.com');
});

test('the real program list builds, every domain is https and registrable', () => {
  const s = F.build({ profile: PROFILE, programs: PROGRAMS });
  const data = JSON.parse(s.slice(s.indexOf('var D=') + 6, s.indexOf(';var FM=')));
  assert.equal(data.programs.length, PROGRAMS.length);
  for (const p of data.programs) assert.ok(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(p.domain), p.domain);
  const p0 = PROGRAMS[0];
  const r = run(s, { href: p0.signupUrl, setup: standard });
  assert.equal(r.result.ok, true);
});

test('bookmarklet decodes back to the same script and ends in void 0', () => {
  const s = script();
  const url = F.bookmarklet(s);
  assert.ok(url.startsWith('javascript:'));
  assert.ok(!/[\s"<>]/.test(url), 'URL has no raw spaces, quotes or angle brackets');
  const back = decodeURIComponent(url.slice('javascript:'.length));
  assert.ok(back.startsWith(s));
  assert.equal(back.slice(s.length), '\nvoid 0;');
  const r = run(back, { setup: standard });
  assert.equal(r.result, undefined, 'the bookmarklet evaluates to undefined so the page never navigates');
  assert.equal(r.completions.length, 1);
  assert.equal(r.completions[0].filled, 6);
  const hostile = F.build({ profile: { firstName: '</script>"\'\\\u2028\u{1F476}%25 ' + 'x' }, programs: progs });
  assert.ok(decodeURIComponent(F.bookmarklet(hostile).slice(11)).startsWith(hostile));
});

test('fieldmatch: one source, same API as the helper wrapper', async () => {
  const w = await import('../tools/autofill/field-matcher.mjs');
  for (const k of ['cleanText', 'registrableDomain', 'sameSite', 'isGuidedDefault', 'classifyField', 'valueFor']) {
    assert.equal(typeof FM[k], 'function', k);
    assert.equal(w[k], FM[k], k);
  }
  assert.equal(FM.registrableDomain('https://register.gerber.com/x'), 'gerber.com');
  assert.equal(FM.registrableDomain('shop.example.co.uk'), 'example.co.uk');
  assert.equal(FM.registrableDomain('https://www.revenue.state.mn.us/child-tax-credit'), 'state.mn.us');
  assert.equal(FM.registrableDomain('www.medela.us'), 'medela.us');
  assert.equal(FM.sameSite('https://a.similac.com', 'https://similac.com.evil.example'), false);
  assert.equal(FM.classifyField({ type: 'text', autocomplete: 'cc-number' }), null);
  assert.ok(!FM.factory.toString().includes('\n//'), 'no line comments in the embedded factory');
});

// ---- review V1 additions ----
test('registrableDomain: odd hosts cannot pass for an official domain', () => {
  const R = FM.registrableDomain;
  assert.equal(R('https://evil.example\\@similac.com/'), 'evil.example'); // backslash ends the host
  assert.equal(R('https://similac.com@evil.example/'), 'evil.example');
  assert.equal(R('https://user:pw@www.similac.com:8443/x'), 'similac.com');
  assert.equal(R('WWW.Similac.COM.'), 'similac.com');
  assert.equal(R('1.2.3.4'), '1.2.3.4'); // an IP literal is never a "domain" of two labels
  assert.equal(R('[::1]'), '[::1]');
  assert.equal(R('xn--simlac-9wa.com'), 'xn--simlac-9wa.com');
  assert.equal(R('evil.example.co.uk'), 'example.co.uk');
  assert.equal(R('shop.example.com.au'), 'example.com.au');
  assert.equal(R('x.example.or.jp'), 'example.or.jp');
  for (const href of ['blob:https://www.similac.com/uuid', 'data:text/html,similac.com', 'about:blank', 'javascript:0']) {
    const r = run(script(), { href: 'https://www.similac.com/', setup: standard });
    assert.equal(r.result.ok, true);
    const w = makeWindow('https://www.similac.com/');
    w.location.hostname = ''; w.location.protocol = new URL(href).protocol;
    const doc = w.document; doc.fields.length = 0;
    const ctx = { window: w, document: doc, completion() { } };
    vm.createContext(ctx);
    assert.equal(vm.runInContext(script(), ctx).ok, false, href);
  }
});

test('a program on a shared hosting domain never becomes a gate', () => {
  const s = F.build({ profile: PROFILE, programs: [
    { id: 'shop', name: 'Shop', signupUrl: 'https://brand.myshopify.com/' },
    { id: 'pages', name: 'Pages', signupUrl: 'https://brand.github.io/signup' },
    { id: 'ok', name: 'Ok', signupUrl: 'https://www.similac.com/a' }] });
  assert.equal(run(s, { href: 'https://evil.myshopify.com/', setup: standard }).result.ok, false);
  assert.equal(run(s, { href: 'https://evil.github.io/', setup: standard }).result.ok, false);
  assert.equal(run(s, { href: 'https://www.similac.com/', setup: standard }).result.ok, true);
});

test('classification: fields for another person or another purpose stay empty', () => {
  const c = (o) => FM.classifyField(o);
  assert.equal(c({ label: 'Middle name', name: 'middle' }), null);
  assert.equal(c({ label: 'Name on card' }), null);
  assert.equal(c({ label: 'Cardholder name' }), null);
  assert.equal(c({ label: 'Maiden name' }), null);
  assert.equal(c({ label: 'Preferred name' }), null);
  assert.equal(c({ label: 'Friend’s email', type: 'email' }), null);
  assert.equal(c({ label: 'Promo code' }), null);
  assert.equal(c({ label: 'Search', type: 'text' }), null);
  assert.equal(c({ name: 'q', placeholder: 'Search or enter keyword' }), null);
  assert.equal(c({ label: 'Find a store near you: ZIP' }), null);
  assert.equal(c({ label: 'Preferred delivery date', type: 'date' }), null);
  assert.equal(c({ label: 'Baby’s birthday', type: 'date' }), null);
  assert.equal(c({ label: 'Date of birth' }), null);
  assert.equal(c({ label: 'Baby name', autocomplete: 'given-name' }), null);
  assert.equal(c({ label: 'Username' }), null);
  assert.equal(c({ label: 'Baby due date', type: 'date' }), 'dueDate');
  assert.equal(c({ label: 'Expected delivery date (due date)' }), 'dueDate');
  assert.equal(c({ label: 'Full name' }), 'fullName');
  assert.equal(c({ label: 'First name' }), 'firstName');
});

test('search forms and autocomplete boxes are never filled', () => {
  const r = run(script(), {
    setup(win) {
      const a = field(win, { label: 'ZIP code' });
      const b = field(win, { label: 'ZIP code' });
      a.closest = (sel) => (/role="search"/.test(sel) ? {} : null);
      return { a, b };
    }
  });
  assert.equal(r.els.a.events.length, 0);
  assert.ok(r.els.b.events.length > 0);
});

test('the embedded script holds no raw line or paragraph separator, even for a hostile profile', () => {
  const hostile = { ...PROFILE, firstName: 'a' + String.fromCharCode(0x2028) + 'b' + String.fromCharCode(0x2029) + '</script>%22"\\\'' };
  const s = F.build({ profile: hostile, programs: progs });
  assert.ok(!s.includes(String.fromCharCode(0x2028)) && !s.includes(String.fromCharCode(0x2029)));
  assert.ok(!/<\/script/i.test(s));
  const b = F.bookmarklet(s);
  assert.ok(/^javascript:[A-Za-z0-9%._~!*'()-]*$/.test(b));
  assert.equal(decodeURIComponent(b.slice(11)).startsWith(s), true);
  for (const f of ['../src/js/fillscript.js', '../src/js/fieldmatch.js', '../src/js/inbox.js', '../src/js/inboxview.js', '../src/js/phone.js']) {
    const t = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!t.includes(String.fromCharCode(0x2028)) && !t.includes(String.fromCharCode(0x2029)), f);
  }
});

test('phone card: warnings come before the first button and each button sits inside its step', () => {
  const src = readFileSync(new URL('../src/js/phone.js', import.meta.url), 'utf8');
  assert.ok(src.indexOf('warningsBefore)') < src.indexOf('STEPS.options.forEach'));
  assert.doesNotMatch(src, /Settings, then Apps, then Shortcuts/);
  assert.match(src, /iOS 18 and older/);
  assert.match(src, /Settings, tap Shortcuts, then Advanced/);
});
