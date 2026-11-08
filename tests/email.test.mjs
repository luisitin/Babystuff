import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const mod = { exports: {} };
new Function('module', readFileSync(new URL('../src/js/email.js', import.meta.url), 'utf8'))(mod);
const E = mod.exports;
const programs = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'));

test('tagFor is unique, deterministic and well formed across the real data', () => {
  const tags = programs.map((p) => E.tagFor(p, programs));
  assert.equal(new Set(tags).size, tags.length, 'duplicate tags: ' + tags.join(','));
  for (const t of tags) {
    assert.match(t, /^[a-z0-9-]+$/);
    assert.ok(t.length >= 1 && t.length <= 24, t);
    assert.doesNotMatch(t, /^-|-$/);
  }
  const reversed = [...programs].reverse();
  assert.deepEqual(E.tagMap(reversed), E.tagMap(programs), 'input order must not matter');
  assert.deepEqual(Object.keys(E.tagMap(programs)).sort(), programs.map((p) => p.id).sort());
});

test('tagFor naming rules', () => {
  const P = (id, brand) => ({ id, brand });
  const all = [P('walmart-b', 'Walmart'), P('walmart-a', 'Walmart'), P('similac-x', 'Similac (Abbott)'), P('zz', ''), P('walmart-2', 'Walmart')];
  const m = E.tagMap(all);
  assert.equal(m['similac-x'], 'similac');
  assert.equal(m['walmart-2'], 'walmart');
  assert.equal(m['walmart-a'], 'walmart-a');
  assert.equal(m['walmart-b'], 'walmart-b');
  assert.equal(m.zz, 'zz');
  assert.equal(E.tagFor(P('new-thing', 'Brand X Co'), all), 'brand');
  // all id segments equal the base: numeric suffixes
  const dup = E.tagMap([P('a', 'A'), P('a-a', 'A'), P('a-a-a', 'A')]);
  assert.deepEqual(Object.values(dup).sort(), ['a', 'a-2', 'a-3']);
  assert.ok(E.tagFor(P('x', 'A very long-winded brand name that goes on and on'), []).length <= 24);
});

test('plusAddress', () => {
  assert.equal(E.plusAddress('jane@gmail.com', 'similac'), 'jane+similac@gmail.com');
  assert.equal(E.plusAddress('jane+old@gmail.com', 'new'), 'jane+new@gmail.com');
  assert.equal(E.plusAddress('Jane.Doe@GMAIL.com', 'Similac'), 'Jane.Doe+similac@gmail.com');
  assert.equal(E.plusAddress('  jane@gmail.com ', 'x'), 'jane+x@gmail.com');
  for (const bad of ['', 'nope', 'a@b', '@gmail.com', 'jane@', '+x@gmail.com', 'a b@gmail.com', null, undefined])
    assert.equal(E.plusAddress(bad, 'x'), '', String(bad));
  assert.equal(E.plusAddress('jane@gmail.com', ''), '');
});

test('supportsPlus', () => {
  for (const d of ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'fastmail.com', 'proton.me', 'protonmail.com'])
    assert.equal(E.supportsPlus('a@' + d), true, d);
  assert.equal(E.supportsPlus('A@GMAIL.COM'), true);
  assert.equal(E.supportsPlus('a@yahoo.com'), false);
  assert.equal(E.supportsPlus('a@example.org'), null);
  assert.equal(E.supportsPlus('garbage'), null);
  assert.equal(E.supportsPlus(''), null);
});

test('gmailSearchUrl encoding', () => {
  const base = 'https://mail.google.com/mail/u/0/#search/';
  const u = E.gmailSearchUrl({ email: 'jane@gmail.com', tag: 'similac', domain: 'similac.com' });
  assert.ok(u.startsWith(base));
  assert.equal(decodeURIComponent(u.slice(base.length)), 'to:(jane+similac@gmail.com) OR from:(similac.com)');
  assert.ok(u.includes('%2B'), 'plus must be percent-encoded');
  assert.doesNotMatch(u.slice(base.length), /[\s"<>]/);
  const f = E.gmailSearchUrl({ email: 'jane@gmail.com', domain: 'similac.com' });
  assert.equal(decodeURIComponent(f.slice(base.length)), 'from:(similac.com)');
  assert.equal(E.gmailSearchUrl({ email: 'jane@gmail.com' }), '');
});

const prog = [
  { id: 'a-1', name: 'Tom & Jerry <"Box"> \'s', brand: 'Acme', signupUrl: 'https://www.acme.com/signup?x=1&y=2' },
  { id: 'b-1', name: 'Path/Name', brand: 'Bravo', signupUrl: 'https://bravo.example/x' }
];
function props(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/<apps:property name="([^"]*)" value="([^"]*)"\/>/g)].map((x) => [x[1], x[2]])));
}
test('gmailFiltersXml is well formed, escaped, and honours archive', () => {
  const xml = E.gmailFiltersXml(prog, { email: 'jane@gmail.com', usePlus: false, archive: false });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom" xmlns:apps="http:\/\/schemas\.google\.com\/apps\/2006">/);
  assert.match(xml, /<\/feed>\n$/);
  // balanced tags (rough parse)
  const open = (xml.match(/<entry>/g) || []).length, close = (xml.match(/<\/entry>/g) || []).length;
  assert.equal(open, 2); assert.equal(close, 2);
  // no raw special characters inside attribute values
  for (const m of xml.matchAll(/value="([^"]*)"/g)) assert.doesNotMatch(m[1], /[<>"']|&(?!(amp|lt|gt|quot|apos);)/);
  const p = props(xml);
  assert.equal(p[0].from, 'acme.com');
  assert.equal(p[0].label, 'Baby Freebies/Tom &amp; Jerry &lt;&quot;Box&quot;&gt; &apos;s');
  assert.equal(p[1].label, 'Baby Freebies/Path-Name');
  assert.ok(!('shouldArchive' in p[0]));
  assert.ok(!('to' in p[0]));
  const arch = props(E.gmailFiltersXml(prog, { email: 'jane@gmail.com', usePlus: false, archive: true }));
  assert.equal(arch[0].shouldArchive, 'true');
  assert.equal(arch[1].shouldArchive, 'true');
});

test('gmailFiltersXml uses plus addresses when asked', () => {
  const xml = E.gmailFiltersXml(prog, { email: 'jane@gmail.com', usePlus: true, archive: false });
  const p = props(xml);
  assert.equal(p[0].to, 'jane+acme@gmail.com');
  assert.ok(!('from' in p[0]));
  assert.equal(p[1].to, 'jane+bravo@gmail.com');
  // an invalid email falls back to the domain
  assert.equal(props(E.gmailFiltersXml(prog, { email: 'x', usePlus: true }))[0].from, 'acme.com');
  // tags come from allPrograms when given
  const sub = E.gmailFiltersXml([prog[1]], { email: 'jane@gmail.com', usePlus: true, allPrograms: [{ id: 'a-0', brand: 'Bravo' }, prog[1]] });
  assert.equal(props(sub)[0].to, 'jane+bravo-b@gmail.com');
});

test('mailtoChecklist', () => {
  const small = E.mailtoChecklist({ to: 'jane+x@gmail.com', programs: prog, statusOf: () => 'To do' });
  assert.ok(small.url.startsWith('mailto:jane%2Bx@gmail.com?subject=Baby%20freebies%20checklist&body='));
  assert.equal(small.truncated, false);
  const body = decodeURIComponent(small.url.split('&body=')[1]);
  assert.equal(body, small.fullText);
  assert.match(body, /Path\/Name \[To do\]\n  https:\/\/bravo\.example\/x/);
  const many = Array.from({ length: 80 }, (_, i) => ({ id: 'p' + i, name: 'Program number ' + i, signupUrl: 'https://example.com/signup/' + i }));
  const big = E.mailtoChecklist({ to: 'jane@gmail.com', programs: many, statusOf: () => 'Signed up' });
  assert.ok(big.url.length < 1900, String(big.url.length));
  assert.equal(big.truncated, true);
  const bb = decodeURIComponent(big.url.split('&body=')[1]);
  assert.match(bb, /…and \d+ more \(see the app\)$/);
  const shown = (bb.match(/^- /gm) || []).length;
  assert.match(bb, new RegExp('…and ' + (80 - shown) + ' more'));
  assert.equal((big.fullText.match(/^- /gm) || []).length, 80);
  assert.doesNotMatch(big.fullText, /see the app/);
  assert.equal(E.mailtoChecklist({ to: 'a@b.co', programs: [] }).truncated, false);
});

test('icsReminders', () => {
  const ics = E.icsReminders([{ id: 'a-1', name: 'Alpha, Inc; x', date: '2026-01-05' }, { id: 'b', name: 'B', date: '2026-12-10' }, { id: 'c', name: 'C', date: '2024-01-31' }, { id: 'bad', name: 'x', date: 'nope' }]);
  assert.ok(ics.endsWith('\r\n'));
  assert.doesNotMatch(ics.replace(/\r\n/g, ''), /[\r\n]/);
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /UID:a-1@baby-freebies-finder\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260202\r\n/); // 2026-01-05 + 28
  assert.match(ics, /DTSTART;VALUE=DATE:20270107\r\n/); // year end: 2026-12-10 + 28
  assert.match(ics, /DTSTART;VALUE=DATE:20240228\r\n/); // leap-year month end: 2024-01-31 + 28
  assert.match(ics, /DTEND;VALUE=DATE:20260203\r\n/);
  assert.ok(ics.includes(String.raw`SUMMARY:Check for Alpha\, Inc\; x mail or box` + "\r\n"));
  assert.equal(ics, E.icsReminders([{ id: 'a-1', name: 'Alpha, Inc; x', date: '2026-01-05' }, { id: 'b', name: 'B', date: '2026-12-10' }, { id: 'c', name: 'C', date: '2024-01-31' }, { id: 'bad', name: 'x', date: 'nope' }]), 'deterministic');
  assert.match(E.icsReminders([{ id: 'z', name: 'Z', date: '2026-02-01' }], { days: 30 }), /DTSTART;VALUE=DATE:20260303/);
  assert.match(E.icsReminders([{ id: 'z', name: 'Z', date: '2026-12-31T23:30:00.000Z' }], { days: 1 }), /DTSTART;VALUE=DATE:20270101/);
  assert.doesNotMatch(ics, /TZID|URL:|ATTACH/);
});

test('icsReminders folds long lines at 75 octets', () => {
  const name = 'Très long name é'.repeat(12);
  const ics = E.icsReminders([{ id: 'x', name, date: '2026-03-01' }]);
  const lines = ics.split('\r\n');
  for (const l of lines) assert.ok(Buffer.byteLength(l) <= 75, l);
  assert.ok(lines.some((l) => l.startsWith(' ')));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Check for ' + name + ' mail or box'));
  assert.ok(!unfolded.includes('�'));
});
