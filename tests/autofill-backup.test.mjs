import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseBackup, selectTodo, profileForProgram, parseAnswer, applyAnswers, defaultOutPath } from '../tools/autofill/backup.mjs';

const email = createRequire(import.meta.url)('../src/js/email.js');
const programs = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'));
const NOW = '2026-11-08T12:00:00.000Z';

const mk = (over = {}) => ({
  app: 'baby-freebies-finder', version: 1, exportedAt: '2026-11-01T00:00:00.000Z',
  tracker: { a: { status: 'received', note: 'n', updatedAt: '2026-10-01T00:00:00.000Z' } },
  profile: { firstName: 'Jane', email: 'jane@gmail.com', dueDate: '3/5/2027', usePlusTags: true },
  ...over,
});
const text = (o) => JSON.stringify(o);

test('parseBackup accepts a valid backup and normalizes the profile', () => {
  const b = parseBackup(text(mk()));
  assert.equal(b.tracker.a.status, 'received');
  assert.equal(b.profile.dueDate, '2027-03-05');
  assert.equal(b.profile.usePlusTags, true);
  assert.equal(parseBackup(text(mk({ profile: undefined }))).profile, null);
});

test('parseBackup rejects bad input like the app does', () => {
  assert.throws(() => parseBackup('nope'), /not valid JSON/);
  assert.throws(() => parseBackup('[]'), /not a Baby Freebies/);
  assert.throws(() => parseBackup(text(mk({ app: 'other' }))), /wrong app name/);
  assert.throws(() => parseBackup(text(mk({ version: 2 }))), /unsupported version/);
  assert.throws(() => parseBackup(text(mk({ tracker: undefined }))), /no tracker/);
  assert.throws(() => parseBackup(text(mk({ tracker: { a: { status: 'bogus' } } }))), /unknown status/);
  assert.throws(() => parseBackup(text(mk({ tracker: { a: { status: 'todo', note: 5 } } }))), /note/);
  assert.throws(() => parseBackup('x'.repeat(1024 * 1024 + 1)), /too large/);
});

test('selectTodo: missing counts as todo, guided rule, include-all, only, data order', () => {
  const free = programs.filter((p) => selectTodo([p], {}).length);
  assert.ok(free.length > 0 && free.length < programs.length);
  const all = selectTodo(programs, {});
  assert.deepEqual(all.map((p) => p.id), programs.filter((p) => all.includes(p)).map((p) => p.id));
  const first = all[0].id;
  const t = { [first]: { status: 'signed-up' }, [all[1].id]: { status: 'todo' } };
  const sel = selectTodo(programs, t);
  assert.ok(!sel.some((p) => p.id === first));
  assert.ok(sel.some((p) => p.id === all[1].id));
  assert.ok(selectTodo(programs, {}, { includeAllTodo: true }).length > all.length);
  assert.deepEqual(selectTodo(programs, {}, { only: [all[2].id] }).map((p) => p.id), [all[2].id]);
  assert.deepEqual(selectTodo(programs, {}, { only: ['not-an-id'] }), []);
});

test('profileForProgram matches email.js', () => {
  const id = programs[0].id;
  const p = { email: 'jane@gmail.com', usePlusTags: true };
  const r = profileForProgram(p, programs, id);
  assert.equal(r.plus, true);
  assert.equal(r.profile.email, email.plusAddress('jane@gmail.com', email.tagMap(programs)[id]));
  assert.equal(p.email, 'jane@gmail.com');
  assert.equal(profileForProgram({ email: 'jane@gmail.com' }, programs, id).plus, false);
  assert.equal(profileForProgram({ email: 'jane@gmail.com' }, programs, id, { plusTags: true }).plus, true);
  assert.equal(profileForProgram({ email: 'j@yahoo.com', usePlusTags: true }, programs, id).profile.email, 'j@yahoo.com');
  assert.match(profileForProgram({ email: 'j@unknown-host.org', usePlusTags: true }, programs, id).profile.email, /^j\+.+@unknown-host\.org$/);
  assert.equal(profileForProgram({ usePlusTags: true }, programs, id).plus, false);
});

test('parseAnswer', () => {
  assert.equal(parseAnswer(''), 'leave');
  assert.equal(parseAnswer(' D '), 'done');
  assert.equal(parseAnswer('s'), 'skip');
  assert.equal(parseAnswer('p'), 'problem');
  assert.equal(parseAnswer('q'), 'quit');
  assert.equal(parseAnswer('x'), null);
});

test('applyAnswers updates only answered entries and keeps the rest', () => {
  const raw = mk({ tracker: {
    a: { status: 'received', note: 'n', updatedAt: '2026-10-01T00:00:00.000Z' },
    b: { status: 'todo', note: 'keep', updatedAt: '' },
    c: { status: 'todo', note: '', updatedAt: '' },
    d: { status: 'todo', note: '', updatedAt: '' },
  } });
  const before = JSON.stringify(raw);
  const out = applyAnswers(raw, {
    b: { result: 'done' }, c: { result: 'skip' }, d: { result: 'problem', note: 'CAPTCHA loop' },
    e: { result: 'leave' }, f: { result: 'done' },
  }, NOW);
  assert.equal(JSON.stringify(raw), before, 'input is not mutated');
  assert.deepEqual(out.tracker.a, raw.tracker.a);
  assert.deepEqual(out.tracker.b, { status: 'signed-up', note: 'keep', updatedAt: NOW });
  assert.equal(out.tracker.c.status, 'skipped');
  assert.deepEqual(out.tracker.d, { status: 'todo', note: 'Problem: CAPTCHA loop', updatedAt: NOW });
  assert.equal(out.tracker.f.status, 'signed-up');
  assert.ok(!('e' in out.tracker));
  assert.deepEqual(out.profile, raw.profile);
  assert.equal(out.app, 'baby-freebies-finder');
  assert.equal(out.version, 1);
  assert.doesNotThrow(() => parseBackup(JSON.stringify(out)));
});

test('defaultOutPath', () => {
  assert.equal(defaultOutPath('/home/u/Downloads/baby-freebies-backup-2026-11-08.json'), '/home/u/Downloads/baby-freebies-backup-2026-11-08-updated.json');
});
