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
