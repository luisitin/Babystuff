import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function load(programs, localStorage) {
  const events = [];
  const sandbox = {
    document: {
      getElementById: (id) => (id === 'programs-data' ? { textContent: JSON.stringify(programs) } : null),
      dispatchEvent: (e) => events.push(e),
      addEventListener() {}
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console
  };
  if (localStorage) sandbox.localStorage = localStorage;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['store.js', 'tracker.js']) vm.runInContext(fs.readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8'), sandbox);
  return { BFF: sandbox.BFF, events };
}
const J = (v) => JSON.parse(JSON.stringify(v));
const strip = (r) => ({ imported: r.imported, skipped: r.skipped });
const progs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('store falls back to memory and parses programs', () => {
  const { BFF } = load(progs);
  assert.equal(BFF.store.persistent, false);
  assert.equal(BFF.programs.length, 3);
  BFF.store.set('x', { n: 1 });
  assert.deepEqual(J(BFF.store.get('x')), { n: 1 });
  assert.equal(BFF.store.get('nope', 7), 7);
  BFF.store.remove('x');
  assert.equal(BFF.store.get('x', null), null);
});

test('status, note, counts, events', () => {
  const { BFF, events } = load(progs);
  const t = BFF.tracker;
  assert.equal(t.getStatus('a'), 'todo');
  t.setStatus('a', 'signed-up');
  t.setStatus('b', 'skipped');
  t.setNote('c', 'hi');
  t.setStatus('a', 'bogus');
  assert.equal(t.getStatus('a'), 'signed-up');
  assert.equal(t.getNote('c'), 'hi');
  const c = t.counts();
  assert.equal(c.done, 1); assert.equal(c.active, 2); assert.equal(c.skipped, 1);
  assert.equal(events.filter((e) => e.type === 'bff:tracker-changed').length, 3);
});

test('export/import roundtrip and merge by updatedAt', () => {
  const { BFF } = load(progs);
  const t = BFF.tracker;
  t.setStatus('a', 'received'); t.setNote('a', 'n');
  BFF.store.set('profile.v1', { firstName: 'Ann' });
  const noProf = JSON.parse(t.exportJSON({ includeProfile: false }));
  assert.equal(noProf.app, 'baby-freebies-finder'); assert.equal(noProf.version, 1);
  assert.equal(noProf.profile, undefined);
  const withProf = t.exportJSON({ includeProfile: true });
  assert.equal(JSON.parse(withProf).profile.firstName, 'Ann');

  const other = load(progs).BFF;
  const r = other.tracker.importJSON(withProf);
  assert.deepEqual(strip(J(r)), { imported: 1, skipped: 0 });
  assert.equal(other.tracker.getStatus('a'), 'received');
  assert.equal(other.store.get('profile.v1').firstName, 'Ann');
  // second import: same updatedAt is not newer
  assert.deepEqual(strip(J(other.tracker.importJSON(withProf))), { imported: 0, skipped: 1 });
  // older incoming loses, newer wins, unknown ids are kept
  const mk = (e) => JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: e });
  const r2 = other.tracker.importJSON(mk({
    a: { status: 'todo', note: '', updatedAt: '2000-01-01T00:00:00Z' },
    b: { status: 'skipped', note: 'x', updatedAt: '2999-01-01T00:00:00Z' },
    zzz: { status: 'received', note: '', updatedAt: '2020-01-01T00:00:00Z' }
  }));
  assert.deepEqual(strip(J(r2)), { imported: 2, skipped: 1 });
  assert.equal(other.tracker.getStatus('a'), 'received');
  assert.equal(other.tracker.getStatus('b'), 'skipped');
  assert.equal(other.tracker.all().zzz.status, 'received');
});

test('import rejects bad input with readable errors', () => {
  const { BFF } = load(progs);
  const t = BFF.tracker;
  const bad = [
    'not json',
    '[]',
    JSON.stringify({ app: 'other', version: 1, tracker: {} }),
    JSON.stringify({ app: 'baby-freebies-finder', version: 2, tracker: {} }),
    JSON.stringify({ app: 'baby-freebies-finder', version: 1 }),
    JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: { a: { status: 'nope' } } }),
    JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: { a: { status: 'todo', note: 5 } } })
  ];
  for (const b of bad) assert.throws(() => t.importJSON(b), (e) => typeof e.message === 'string' && e.message.length > 10);
  assert.deepEqual(J(t.all()), {});
});

test('limits: size, entry count, proto keys, note truncation, profile keys', () => {
  const t = load(progs).BFF.tracker;
  assert.throws(() => t.importJSON('x'.repeat(1024 * 1024 + 1)), /too large/);
  const many = {};
  for (let i = 0; i < 5001; i++) many['id' + i] = { status: 'todo', note: '', updatedAt: '2020-01-01T00:00:00Z' };
  assert.throws(() => t.importJSON(JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: many })), /too many/);
  const r = t.importJSON('{"app":"baby-freebies-finder","version":1,"tracker":{"__proto__":{"status":"todo"},"a":{"status":"todo","note":"' + 'n'.repeat(3000) + '"}},"profile":{"firstName":"A","evil":"x","dueDate":"03/05/2027"}}');
  assert.equal(r.imported, 1);
  assert.equal(t.getNote('a').length, 2000);
});

test('normalizeDate', () => {
  const { BFF } = load(progs);
  const n = BFF.util.normalizeDate;
  assert.equal(n('2027-03-05'), '2027-03-05');
  assert.equal(n('3/5/2027'), '2027-03-05');
  assert.equal(n('03/05/27'), '2027-03-05');
  assert.equal(n('March 5, 2027'), '2027-03-05');
  assert.equal(n('2027-02-30'), '');
  assert.equal(n('soon'), '');
});

test('failed write: reads stay in memory, persistent flips, event fires, set returns false', () => {
  const data = { 'bff.tracker.v1': JSON.stringify({ a: { status: 'received', note: '', updatedAt: '2020-01-01T00:00:00Z' } }) };
  let broken = false;
  const ls = {
    get length() { return Object.keys(data).length; },
    key: (i) => Object.keys(data)[i],
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { if (broken && !k.endsWith('__probe')) throw new Error('quota'); data[k] = v; },
    removeItem: (k) => { delete data[k]; }
  };
  const { BFF, events } = load(progs, ls);
  assert.equal(BFF.store.persistent, true);
  assert.equal(BFF.tracker.getStatus('a'), 'received');
  broken = true;
  assert.equal(BFF.tracker.setStatus('a', 'skipped'), false);
  assert.equal(BFF.store.persistent, false);
  assert.equal(BFF.tracker.getStatus('a'), 'skipped');
  assert.ok(events.some((e) => e.type === 'bff:storage-failed'));
  assert.equal(JSON.parse(data['bff.tracker.v1']).a.status, 'received');
  const r = BFF.tracker.importJSON('{"app":"baby-freebies-finder","version":1,"tracker":{"b":{"status":"received","updatedAt":"2030-01-01T00:00:00Z"}}}');
  assert.equal(r.saved, false);
  assert.equal(BFF.tracker.getStatus('b'), 'received');
});

test('valueLine: nothing without signed-up programs, estimate with a count of unvalued ones', () => {
  const { BFF } = load([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  const t = BFF.tracker;
  const mod = { exports: {} };
  new Function('module', fs.readFileSync(new URL('../src/js/logic.js', import.meta.url), 'utf8'))(mod);
  BFF.logic = mod.exports;
  BFF.programs[0].valueLow = 100; BFF.programs[0].valueHigh = 200;
  BFF.programs[1].valueLow = 20; BFF.programs[1].valueHigh = 110;
  assert.equal(t.valueLine(), null);
  t.setStatus('a', 'skipped');
  assert.equal(t.valueLine(), null);
  t.setStatus('a', 'signed-up'); t.setStatus('b', 'received');
  assert.equal(t.valueLine(), 'Estimated value of what you have signed up for: about $120 to $310 (our estimate)');
  t.setStatus('c', 'signed-up');
  assert.match(t.valueLine(), /about \$120 to \$310 \(our estimate; 1 program with no known value is not counted\)$/);
});

test('tracker source: plus address and Gmail search follow the email-scope rule', () => {
  const src = fs.readFileSync(new URL('../src/js/tracker.js', import.meta.url), 'utf8');
  assert.match(src, /E\.inEmailFeatures\(p\)/);
  assert.match(src, /gmailSearchUrl\(\{[^}]*program: p \}\)/);
  assert.ok(src.includes('Government and benefit programs are left out of the filters and searches.'));
});

test('guided and phone source: plus tags follow the email-scope rule', () => {
  const g = fs.readFileSync(new URL('../src/js/guided.js', import.meta.url), 'utf8');
  assert.match(g, /E\.inEmailFeatures && !E\.inEmailFeatures\(prog\)\) return ''/);
  const ph = fs.readFileSync(new URL('../src/js/phone.js', import.meta.url), 'utf8');
  assert.match(ph, /E\.inEmailFeatures\(q\)/);
});

// ---- Phase H: "Your situation" answers in the profile ----
import { createRequire } from 'node:module';
const requireH = createRequire(import.meta.url);

test('h situation: stored with the profile, old profiles load, clear removes them', () => {
  const { BFF } = load(progs);
  // An old profile without the four keys loads fine.
  BFF.store.set('profile.v1', { firstName: 'Ann', state: 'TX' });
  const old = BFF.store.get('profile.v1', {});
  assert.equal(old.cover, undefined);
  assert.equal(old.job, undefined);
  BFF.store.set('profile.v1', Object.assign({}, old, { cover: 'private', insurer: 'Aetna', lowIncome: 'no', job: 'yes' }));
  const now = BFF.store.get('profile.v1', {});
  assert.deepEqual([now.cover, now.insurer, now.lowIncome, now.job], ['private', 'Aetna', 'no', 'yes']);
  BFF.store.remove('profile.v1');
  assert.deepEqual(J(BFF.store.get('profile.v1', {})), {});
});

test('h situation: backup round trip, blanks only, bad values dropped', () => {
  const a = load(progs).BFF;
  a.store.set('profile.v1', { firstName: 'Ann', cover: 'medicaid', insurer: 'Aetna', lowIncome: 'yes', job: 'no' });
  const text = a.tracker.exportJSON({ includeProfile: true });
  const exported = JSON.parse(text).profile;
  assert.deepEqual([exported.cover, exported.insurer, exported.lowIncome, exported.job], ['medicaid', 'Aetna', 'yes', 'no']);
  const b = load(progs).BFF;
  b.tracker.importJSON(text);
  const got = b.store.get('profile.v1', {});
  assert.deepEqual([got.cover, got.insurer, got.lowIncome, got.job], ['medicaid', 'Aetna', 'yes', 'no']);
  // Existing answers are not overwritten; blanks are filled.
  const c = load(progs).BFF;
  c.store.set('profile.v1', { cover: 'none' });
  c.tracker.importJSON(text);
  const merged = c.store.get('profile.v1', {});
  assert.equal(merged.cover, 'none');
  assert.equal(merged.job, 'no');
  // Unknown values are dropped.
  const d = load(progs).BFF;
  d.tracker.importJSON(JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: {}, profile: { cover: 'gold', lowIncome: 'maybe', job: 5, firstName: 'Z' } }));
  const bad = d.store.get('profile.v1', {});
  assert.equal(bad.firstName, 'Z');
  assert.equal(bad.cover, undefined);
  assert.equal(bad.lowIncome, undefined);
  assert.equal(bad.job, undefined);
  // A backup without the keys still imports.
  const e = load(progs).BFF;
  e.tracker.importJSON(JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: {}, profile: { firstName: 'Y' } }));
  assert.equal(e.store.get('profile.v1', {}).firstName, 'Y');
});

test('h situation: the fill-script payload never contains the answers', () => {
  const F = requireH('../src/js/fillscript.js');
  const profile = { firstName: 'Jane', lastName: 'Doe', email: 'jane@gmail.com', state: 'TX', cover: 'medicaid', insurer: 'SecretPlanXyz', lowIncome: 'yes', job: 'no' };
  const script = F.build({ profile, programs: [{ id: 'p', name: 'P', requirements: ['email'], signupUrl: 'https://www.similac.com/x' }], tagMap: {} });
  assert.ok(script.includes('jane@gmail.com'));
  const D = JSON.parse(/var D=(.*?);var FM=/s.exec(script)[1]);
  assert.deepEqual(Object.keys(D.profile).sort(), ['email', 'firstName', 'lastName', 'state']);
  for (const bad of ['SecretPlanXyz', 'lowIncome']) assert.ok(!script.includes(bad), bad);
});

test('tracker.js loads without DOM or BFF.logic and still exposes the view entry points', () => {
  const { BFF } = load(progs);
  assert.equal(typeof BFF.views.tracker.init, 'function');
  assert.equal(typeof BFF.views.tracker.show, 'function');
  assert.equal(BFF.logic, undefined);
  assert.equal(BFF.tracker.valueLine(), null);
});

test('setStatus: the sign-up date rules', () => {
  const { BFF } = load(progs);
  const t = BFF.tracker;
  const at = (id) => (t.getEntry(id) || {}).signedUpAt;
  t.setStatus('a', 'signed-up');
  const x = at('a');
  assert.ok(x);
  // received, then untick Received: the date stays
  t.setStatus('a', 'received');
  assert.equal(at('a'), x);
  t.setStatus('a', 'signed-up');
  assert.equal(at('a'), x);
  // going back to received and to do keeps the stored date; a plain re-sign-up from todo starts a new one
  t.setStatus('a', 'received');
  t.setStatus('a', 'todo');
  assert.equal(at('a'), x);
  // a given date is kept for signed-up or received
  const old = '2026-01-01T00:00:00.000Z';
  t.setStatus('b', 'skipped');
  t.setStatus('b', 'signed-up', { signedUpAt: old });
  assert.equal(at('b'), old);
  t.setStatus('b', 'received', { signedUpAt: '2026-02-02T00:00:00.000Z' });
  assert.equal(at('b'), '2026-02-02T00:00:00.000Z');
  // an invalid one is ignored: not a date, too long, not a string
  t.setStatus('c', 'signed-up', { signedUpAt: 'nope' });
  assert.ok(!isNaN(Date.parse(at('c'))) && at('c') !== 'nope');
  const c1 = at('c');
  t.setStatus('c', 'todo');
  t.setStatus('c', 'signed-up', { signedUpAt: '2026-01-01T00:00:00.000Z' + 'x'.repeat(40) });
  assert.ok(at('c') !== undefined && at('c').length <= 40);
  t.setStatus('c', 'todo');
  t.setStatus('c', 'signed-up', { signedUpAt: 5 });
  assert.equal(typeof at('c'), 'string');
  // a given date is not used for other statuses
  t.setStatus('c', 'skipped', { signedUpAt: old });
  assert.notEqual(at('c'), old);
  assert.ok(c1);
});
