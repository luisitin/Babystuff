import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

// BFF.ticks.apply runs without a DOM: the real logic.js, store.js, tracker.js and ticks.js in one sandbox.
function load(localStorage) {
  const listeners = {};
  const sandbox = {
    document: {
      getElementById: (id) => (id === 'programs-data' ? { textContent: JSON.stringify([{ id: 'a' }, { id: 'b' }]) } : null),
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach((f) => f(e)); },
      addEventListener: (type, f) => { (listeners[type] = listeners[type] || []).push(f); }
    },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    console
  };
  if (localStorage) sandbox.localStorage = localStorage;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['logic.js', 'store.js', 'tracker.js', 'ticks.js']) vm.runInContext(fs.readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8'), sandbox);
  sandbox.BFF.__ctx = sandbox;
  return sandbox.BFF;
}
const date = (BFF, id) => (BFF.tracker.getEntry(id) || {}).signedUpAt;
const OLD = '2026-01-01T00:00:00.000Z';
function seed(BFF, id, status) {
  BFF.store.set('tracker.v1', { [id]: { status, note: '', updatedAt: OLD, signedUpAt: OLD } });
}

test('apply: Received (date X) -> Not for me -> untick goes back to Received with X', () => {
  const BFF = load();
  seed(BFF, 'a', 'received');
  const r1 = BFF.ticks.apply('a', 'notForMe', true);
  assert.equal(r1.status, 'skipped');
  assert.equal(r1.prev, 'received');
  const r2 = BFF.ticks.apply('a', 'notForMe', false);
  assert.equal(r2.status, 'received');
  assert.equal(r2.undo, true);
  assert.equal(date(BFF, 'a'), OLD);
});

test('apply: Received -> untick Done -> tick Done is Received again, and untick Received keeps the date', () => {
  const BFF = load();
  seed(BFF, 'a', 'received');
  assert.equal(BFF.ticks.apply('a', 'done', false).status, 'todo');
  assert.equal(BFF.ticks.apply('a', 'done', true).status, 'received');
  assert.equal(date(BFF, 'a'), OLD);
  assert.equal(BFF.ticks.apply('a', 'received', false).status, 'signed-up');
  assert.equal(date(BFF, 'a'), OLD);
});

test('apply: Done (X) -> Not for me -> tick Done is Done with X; To do -> Done is now', () => {
  const BFF = load();
  seed(BFF, 'a', 'signed-up');
  BFF.ticks.apply('a', 'notForMe', true);
  assert.equal(BFF.ticks.apply('a', 'done', true).status, 'signed-up');
  assert.equal(date(BFF, 'a'), OLD);
  BFF.ticks.apply('b', 'done', true);
  assert.ok(date(BFF, 'b') && date(BFF, 'b') > OLD);
});

test('apply: a note edited between the tick and the undo survives', () => {
  const BFF = load();
  seed(BFF, 'a', 'received');
  BFF.ticks.apply('a', 'notForMe', true);
  BFF.tracker.setNote('a', 'called them');
  assert.equal(BFF.ticks.apply('a', 'notForMe', false).status, 'received');
  assert.equal(BFF.tracker.getNote('a'), 'called them');
});

test('apply: the memory is stale once something else changed the status, and a bulk change forgets it', () => {
  const BFF = load();
  seed(BFF, 'a', 'signed-up');
  BFF.ticks.apply('a', 'notForMe', true);
  BFF.tracker.setStatus('a', 'todo');                 // changed elsewhere
  const r = BFF.ticks.apply('a', 'notForMe', false);  // plain rule: unticking from todo changes nothing
  assert.equal(r.status, 'todo');
  assert.equal(r.undo, false);
  seed(BFF, 'b', 'received');
  BFF.ticks.apply('b', 'notForMe', true);
  BFF.store.set('tracker.v1', { b: { status: 'skipped', note: '', updatedAt: OLD } });
  document_emit(BFF);
  assert.equal(BFF.ticks.apply('b', 'notForMe', false).status, 'todo');   // not back to received
});
function document_emit(BFF) {
  // the same bulk event the import and clear actions send
  BFF.__ctx.document.dispatchEvent(new BFF.__ctx.CustomEvent('bff:tracker-changed', { detail: { id: null } }));
}

test('apply: a failed save still changes the status for the visit and says ok: false', () => {
  const blocked = { getItem: () => null, setItem: () => { throw new Error('blocked'); }, removeItem() {}, key: () => null, length: 0 };
  const BFF = load(blocked);
  const r = BFF.ticks.apply('a', 'done', true);
  assert.equal(r.ok, false);
  assert.equal(r.status, 'signed-up');
  assert.equal(BFF.tracker.getStatus('a'), 'signed-up');
  const r2 = BFF.ticks.apply('a', 'done', false);
  assert.equal(r2.status, 'todo');
  assert.equal(r2.undo, true);
});

test('apply: around(save) wraps the save', () => {
  const BFF = load();
  let inside = false, sawStatusInside = null;
  BFF.ticks.apply('a', 'done', true, (run) => { inside = true; run(); sawStatusInside = BFF.tracker.getStatus('a'); });
  assert.equal(inside, true);
  assert.equal(sawStatusInside, 'signed-up');
});
