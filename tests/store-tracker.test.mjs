import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

function load(programs) {
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
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['store.js', 'tracker.js']) vm.runInContext(fs.readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8'), sandbox);
  return { BFF: sandbox.BFF, events };
}
const J = (v) => JSON.parse(JSON.stringify(v));
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
  assert.deepEqual(J(r), { imported: 1, skipped: 0 });
  assert.equal(other.tracker.getStatus('a'), 'received');
  assert.equal(other.store.get('profile.v1').firstName, 'Ann');
  // second import: same updatedAt is not newer
  assert.deepEqual(J(other.tracker.importJSON(withProf)), { imported: 0, skipped: 1 });
  // older incoming loses, newer wins, unknown ids are kept
  const mk = (e) => JSON.stringify({ app: 'baby-freebies-finder', version: 1, tracker: e });
  const r2 = other.tracker.importJSON(mk({
    a: { status: 'todo', note: '', updatedAt: '2000-01-01T00:00:00Z' },
    b: { status: 'skipped', note: 'x', updatedAt: '2999-01-01T00:00:00Z' },
    zzz: { status: 'received', note: '', updatedAt: '2020-01-01T00:00:00Z' }
  }));
  assert.deepEqual(J(r2), { imported: 2, skipped: 1 });
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
