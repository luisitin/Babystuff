import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const I = require('../src/js/inbox.js');
const E = require('../src/js/email.js');

const ME = 'alex.sample@gmail.com';
const P = [
  { id: 'alpha-box', name: 'Alpha Box', brand: 'Alpha', requirements: ['email'], signupUrl: 'https://www.alphabox.com/join' },
  { id: 'beta-club', name: 'Beta Club', brand: 'Beta', requirements: ['email'], signupUrl: 'https://register.betaclub.org/x' },
  { id: 'gamma-one', name: 'Gamma One', brand: 'Gamma', requirements: ['email'], signupUrl: 'https://shared-site.net/a' },
  { id: 'gamma-two', name: 'Gamma Two', brand: 'Gamma', requirements: ['email'], signupUrl: 'https://shared-site.net/b' },
  { id: 'big-store', name: 'Big Store', brand: 'Target', requirements: ['email'], signupUrl: 'https://www.target.com/registry' },
  { id: 'agency', name: 'Agency', brand: 'Agency', requirements: ['email'], signupUrl: 'https://www.hrsa.gov/x' }
];
const TAGS = E.tagMap(P);

function msg(o = {}) {
  return Object.assign({
    id: 'm1', threadId: 't1', date: '2026-10-01T10:00:00Z', internalDate: String(Date.parse('2026-10-01T10:00:00Z')),
    labelIds: [], sender: 'hello@alphabox.com', addressDisplayNames: [], snippet: '', subject: 'Hi', toRecipients: [ME]
  }, o);
}
function thread(id, msgs, extra = {}) {
  return Object.assign({ id, messageCount: msgs.length, viewUrl: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(ME) + '#all/thread-f:' + id, messages: msgs }, extra);
}

test('plain API surface', () => {
  for (const k of ['buildQueries', 'matchThreads', 'classify', 'suggest', 'accountFromViewUrl', 'safeViewUrl', 'decodeEntities', 'checklistDraft', 'kitDraft', 'errorCopy']) {
    assert.equal(typeof I[k], 'function', k);
  }
  assert.deepEqual(I.TOOLS, ['search_threads', 'list_labels', 'create_label', 'label_thread', 'create_draft']);
});

test('source mentions no tool other than the five declared and no network API', () => {
  for (const f of ['inbox.js', 'inboxview.js']) {
    const src = readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /send_message|send_draft|trash_|delete_|archive_|\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|serviceWorker|innerHTML/, f);
  }
});

// ---- buildQueries ----
test('buildQueries: from terms only for single-owner, non-broad domains; deterministic', () => {
  const q = I.buildQueries({ programs: P, email: ME, tagMap: TAGS, usePlus: false });
  const text = q.map((x) => x.query).join('\n');
  assert.match(text, /from:alphabox\.com/);
  assert.match(text, /from:betaclub\.org/);
  assert.doesNotMatch(text, /shared-site\.net/);
  assert.doesNotMatch(text, /target\.com/);
  assert.doesNotMatch(text, /hrsa\.gov/);
  assert.doesNotMatch(text, /to:/);
  assert.match(text, /newer_than:120d/);
  assert.deepEqual(I.buildQueries({ programs: P.slice().reverse(), email: ME, tagMap: TAGS, usePlus: false }), q);
  assert.deepEqual(I.unsearchable({ programs: P, email: ME, tagMap: TAGS, usePlus: false }), ['big-store', 'gamma-one', 'gamma-two']);
});

test('buildQueries: plus tags add to: terms for every program, braces and days', () => {
  const q = I.buildQueries({ programs: P, email: ME, tagMap: TAGS, usePlus: true, days: 30 });
  assert.equal(q.length, 1);
  assert.match(q[0].query, /^\{.*\} newer_than:30d$/);
  for (const p of P.filter((x) => x.id !== 'agency')) assert.ok(q[0].query.includes('to:' + E.plusAddress(ME, TAGS[p.id])), p.id);
  assert.ok(!q[0].query.includes('to:' + E.plusAddress(ME, TAGS.agency)), 'a .gov program is not in the email features');
  assert.deepEqual(q[0].programIds, P.filter((x) => x.id !== 'agency').map((p) => p.id).sort());
  assert.deepEqual(I.unsearchable({ programs: P, email: ME, tagMap: TAGS, usePlus: true }), []);
});

test('buildQueries: Yahoo or bad email never gets plus terms; bad days fall back', () => {
  for (const email of ['a@yahoo.com', 'nope', '']) {
    const q = I.buildQueries({ programs: P, email, tagMap: TAGS, usePlus: true, days: -5 });
    assert.ok(q.length >= 1);
    assert.doesNotMatch(q.map((x) => x.query).join(' '), /to:/);
    assert.match(q[0].query, /newer_than:120d/);
  }
  assert.match(I.buildQueries({ programs: P, email: ME, days: '9999999' })[0].query, /120d/);
});

test('buildQueries: hostile input is skipped, never quoted into the query', () => {
  const evil = [
    { id: 'e1', requirements: ['email'], signupUrl: 'https://evil.example.com"} OR {from:victim.com/x' },
    { id: 'e2', requirements: ['email'], signupUrl: 'https://a b.example.com/' },
    { id: 'e3', requirements: ['email'], signupUrl: 'javascript:alert(1)' },
    { id: 'e4' }, null, 'x', { id: '' }, { id: 'e5', requirements: ['email'], signupUrl: 'https://ok-site.com/' }
  ];
  const q = I.buildQueries({ programs: evil, email: 'a"b@x.com\nfrom:evil.com', tagMap: { e5: 'x" OR a' }, usePlus: true });
  const text = q.map((x) => x.query).join('\n');
  assert.doesNotMatch(text, /["\n\r(){}]{1}.*victim/);
  assert.doesNotMatch(text, /victim|a b|javascript/);
  assert.match(text, /from:ok-site\.com/);
  assert.doesNotMatch(text, /to:/);
  const q2 = I.buildQueries({ programs: [{ id: 'z', requirements: ['email'], signupUrl: 'https://ok.example.com' }], email: ME, tagMap: { z: 'x" OR "y' }, usePlus: true });
  assert.doesNotMatch(q2[0].query, /"/);
  assert.equal(I.buildQueries({ programs: [], email: ME }).length, 0);
  assert.equal(I.buildQueries({}).length, 0);
  assert.equal(I.buildQueries().length, 0);
});

test('buildQueries: many programs split into short queries that cover everything', () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ id: 'prog-' + String(i).padStart(3, '0'), brand: 'Brand' + i, name: 'P' + i, requirements: ['email'], signupUrl: 'https://site' + i + '.example.com/' }));
  const tm = E.tagMap(many);
  const q = I.buildQueries({ programs: many, email: ME, tagMap: tm, usePlus: true });
  assert.ok(q.length > 1);
  q.forEach((x) => assert.ok(x.query.length < 1500, String(x.query.length)));
  const covered = new Set(q.flatMap((x) => x.programIds));
  assert.equal(covered.size, 300);
  assert.deepEqual(q.map((x) => x.query), I.buildQueries({ programs: many, email: ME, tagMap: tm, usePlus: true }).map((x) => x.query));
});

// ---- decodeEntities ----
test('decodeEntities', () => {
  assert.equal(I.decodeEntities('Don&#39;t &amp; won&#x27;t &quot;go&quot; &lt;b&gt;'), 'Don\'t & won\'t "go" <b>');
  assert.equal(I.decodeEntities('&amp;lt;script&amp;gt;'), '&lt;script&gt;'); // one pass only
  assert.equal(I.decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(I.decodeEntities('&#128512;'), '\u{1F600}');
  const R = String.fromCharCode(0xFFFD);
  assert.equal(I.decodeEntities('&#0;&#xD800;&#99999999;&#x110000;'), R + R + '&#99999999;' + R);
  assert.equal(I.decodeEntities('&unknown; &amp'), '&unknown; &amp');
  assert.equal(I.decodeEntities('&constructor; &__proto__;'), '&constructor; &__proto__;');
  assert.equal(I.decodeEntities(null), '');
  assert.equal(I.decodeEntities(undefined), '');
  assert.equal(I.decodeEntities(42), '42');
});

// ---- safeViewUrl / account ----
test('safeViewUrl accepts only https mail.google.com/mail/', () => {
  const ok = 'https://mail.google.com/mail/?authuser=alex.sample%40gmail.com#all/thread-f:123';
  assert.equal(I.safeViewUrl(ok), ok);
  assert.equal(I.safeViewUrl('https://mail.google.com/mail/u/0/#inbox'), 'https://mail.google.com/mail/u/0/#inbox');
  for (const bad of [
    'javascript:alert(1)', 'data:text/html,x', 'http://mail.google.com/mail/', 'https://mail.google.com.evil.example/mail/',
    'https://evil.example/mail.google.com/mail/', 'https://mail.google.com@evil.example/mail/', 'https://user:pw@mail.google.com/mail/',
    'https://mail.google.com:8443/mail/', 'https://mail.google.com/other', 'https://mail.google.com', 'https://mail.google.com\\@evil.example/mail/',
    '//mail.google.com/mail/', '/mail/', '', null, undefined, 5, {}, 'https://MAIL.GOOGLE.COM.evil.example/mail/',
    'https://mail.google.com/mailx/', 'https://notmail.google.com/mail/', 'https://mail.google.com/' + 'a'.repeat(2100)
  ]) assert.equal(I.safeViewUrl(bad), '', String(bad).slice(0, 60));
  assert.equal(I.safeViewUrl('https://MAIL.google.com/mail/x'), 'https://mail.google.com/mail/x');
});

test('accountFromViewUrl', () => {
  assert.equal(I.accountFromViewUrl('https://mail.google.com/mail/?authuser=Alex.Sample%40gmail.com#all/thread-f:1'), ME);
  assert.equal(I.accountFromViewUrl('https://mail.google.com/mail/?authuser=0#all/x'), '');
  assert.equal(I.accountFromViewUrl('https://evil.example/mail/?authuser=a%40b.com'), '');
  assert.equal(I.accountFromViewUrl('https://mail.google.com/mail/?authuser=a%40b.com%0Afrom:x'), '');
  assert.equal(I.accountFromViewUrl(''), '');
  assert.equal(I.accountFromViewUrl(undefined), '');
});

// ---- classify ----
test('classify', () => {
  const c = (subject, snippet = '') => I.classify({ subject, snippet });
  assert.equal(c('Please confirm your email address'), 'confirm');
  assert.equal(c('One more step', 'Verify your email to finish'), 'confirm');
  assert.equal(c('Welcome to Alpha Box!'), 'welcome');
  assert.equal(c('Thanks for signing up'), 'welcome');
  assert.equal(c('You&#39;re in!'), 'welcome');
  assert.equal(c('Your sample has shipped'), 'shipped');
  assert.equal(c('Your box is on its way'), 'shipped');
  assert.equal(c('Out for delivery'), 'shipped');
  assert.equal(c('Your box was delivered'), 'shipped');
  assert.equal(c('Weekly deals', 'Save 20% today'), 'other');
  // hedged or negative statements are not shipping or delivery news
  assert.equal(c('Your order will be shipped soon'), 'other');
  assert.equal(c('We will let you know when it has shipped'), 'other');
  assert.equal(c('Get diapers delivered to your door'), 'other');
  assert.equal(c('', ''), 'other');
  assert.equal(I.classify({}), 'other');
  assert.equal(I.classify(), 'other');
  assert.equal(I.classify({ subject: null, snippet: 7 }), 'other');
  assert.equal(c('Confirm your email &amp; get a welcome gift'), 'confirm'); // confirm wins over welcome
});

test('isDelivered is stricter than shipped', () => {
  assert.equal(I.isDelivered({ subject: 'Your package was delivered' }), true);
  assert.equal(I.isDelivered({ subject: 'Delivered: your box' }), true);
  assert.equal(I.isDelivered({ subject: 'Your package has shipped' }), false);
  assert.equal(I.isDelivered({ subject: 'Your package was not delivered' }), false);
  assert.equal(I.isDelivered({ subject: 'Delivery attempt failed', snippet: 'could not be delivered' }), false);
  assert.equal(I.isDelivered({ subject: 'It will be delivered Friday' }), false);
});

// ---- matchThreads ----
test('matchThreads: exact by plus address, case-insensitive, any message in the thread', () => {
  const plus = E.plusAddress(ME, TAGS['alpha-box']).toUpperCase();
  const t = thread('aaa1', [
    msg({ id: 'm1', toRecipients: ['Alex <' + plus + '>'], sender: 'noreply@random-sender.example.com', date: '2026-10-01T10:00:00Z' }),
    msg({ id: 'm2', toRecipients: [ME], sender: 'Support <noreply@random-sender.example.com>', subject: 'Welcome to Alpha &amp; friends', snippet: 'You&#39;re in', internalDate: String(Date.parse('2026-10-03T10:00:00Z')), date: '2026-10-03T10:00:00Z' })
  ]);
  const r = I.matchThreads([t], { programs: P, email: ME, tagMap: TAGS });
  assert.equal(r.length, 1);
  assert.equal(r[0].programId, 'alpha-box');
  assert.equal(r[0].certainty, 'exact');
  assert.equal(r[0].subject, 'Welcome to Alpha & friends');
  assert.equal(r[0].snippet, "You're in");
  assert.equal(r[0].kind, 'welcome');
  assert.equal(r[0].date, '2026-10-03T10:00:00.000Z');
  assert.equal(r[0].threadId, 'aaa1');
  assert.match(r[0].viewUrl, /^https:\/\/mail\.google\.com\/mail\//);
});

test('matchThreads: likely by sender domain only when the domain is unique and not broad', () => {
  const ts = [
    thread('t1', [msg({ sender: 'News <hello@mail.alphabox.com>' })]),
    thread('t2', [msg({ sender: 'x@shared-site.net' })]),
    thread('t3', [msg({ sender: 'x@target.com' })]),
    thread('t4', [msg({ sender: 'x@hrsa.gov' })]),
    thread('t5', [msg({ sender: 'x@alphabox.com.evil.example' })]),
    thread('t6', [msg({ sender: 'x@evilalphabox.com' })])
  ];
  const r = I.matchThreads(ts, { programs: P, email: ME });
  assert.deepEqual(r.map((x) => [x.threadId, x.programId, x.certainty]), [['t1', 'alpha-box', 'likely']]);
});

test('matchThreads: shared domain matches only through the plus address', () => {
  const t = thread('t9', [msg({ sender: 'x@shared-site.net', toRecipients: [E.plusAddress(ME, TAGS['gamma-two'])] })]);
  assert.deepEqual(I.matchThreads([t], { programs: P, email: ME, tagMap: TAGS }).map((x) => [x.programId, x.certainty]), [['gamma-two', 'exact']]);
  assert.deepEqual(I.matchThreads([t], { programs: P, email: ME }), []); // plus off
});

test('matchThreads: broad domain with plus address matches; wrong or stripped plus address does not', () => {
  const t = thread('t7', [msg({ sender: 'x@target.com', toRecipients: [E.plusAddress(ME, TAGS['big-store'])] })]);
  assert.equal(I.matchThreads([t], { programs: P, email: ME, tagMap: TAGS })[0].programId, 'big-store');
  const wrong = thread('t8', [msg({ sender: 'x@target.com', toRecipients: ['alex.sample+other@gmail.com', ME, 'alex.sample+' + TAGS['big-store'] + '@gmail.com.evil.example'] })]);
  assert.deepEqual(I.matchThreads([wrong], { programs: P, email: ME, tagMap: TAGS }), []);
});

test('matchThreads: exact wins over a different sender domain; two programs in one thread are dropped', () => {
  const t = thread('tt', [msg({ sender: 'x@alphabox.com', toRecipients: [E.plusAddress(ME, TAGS['beta-club'])] })]);
  assert.equal(I.matchThreads([t], { programs: P, email: ME, tagMap: TAGS })[0].programId, 'beta-club');
  const both = thread('tb', [msg({ toRecipients: [E.plusAddress(ME, TAGS['beta-club']), E.plusAddress(ME, TAGS['alpha-box'])] })]);
  assert.deepEqual(I.matchThreads([both], { programs: P, email: ME, tagMap: TAGS }), []);
});

test('matchThreads: newest first, one per thread, duplicates dropped', () => {
  const a = thread('a1', [msg({ internalDate: '1000', date: '2026-01-01T00:00:00Z' })]);
  const b = thread('b1', [msg({ internalDate: '9000', date: '2026-02-01T00:00:00Z' })]);
  const dup = thread('a1', [msg({ subject: 'dup' })]);
  const r = I.matchThreads([a, b, dup], { programs: P, email: ME });
  assert.deepEqual(r.map((x) => x.threadId), ['b1', 'a1']);
});

test('matchThreads: uses the newest message for subject, sender and date', () => {
  const t = thread('n1', [
    msg({ id: 'm1', sender: 'x@elsewhere.example.com', subject: 'old', internalDate: '1000', date: '2026-01-01T00:00:00Z' }),
    msg({ id: 'm2', sender: 'y@alphabox.com', subject: 'new', internalDate: '5000', date: '2026-03-01T00:00:00Z', addressDisplayNames: [{ displayName: 'Alpha Team', emailAddress: 'y@alphabox.com' }] })
  ]);
  const r = I.matchThreads([t], { programs: P, email: ME });
  assert.equal(r[0].subject, 'new');
  assert.equal(r[0].from, 'Alpha Team');
  assert.equal(r[0].fromAddress, 'y@alphabox.com');
});

test('matchThreads: empty payload, junk and missing fields never throw', () => {
  assert.deepEqual(I.matchThreads([], { programs: P }), []);
  assert.deepEqual(I.matchThreads(undefined), []);
  assert.deepEqual(I.matchThreads({}, {}), []);
  assert.deepEqual(I.matchThreads([null, 5, 'x', [], {}, { id: 't' }, { id: 't', messages: [] }, { id: 't', messages: [null] }, { messages: [{}] }], { programs: P, email: ME, tagMap: TAGS }), []);
  const weird = thread('w1', [{ sender: 'a@alphabox.com' }]);
  const r = I.matchThreads([weird], { programs: P });
  assert.equal(r[0].subject, '');
  assert.equal(r[0].date, '');
  assert.equal(r[0].viewUrl, 'https://mail.google.com/mail/?authuser=alex.sample%40gmail.com#all/thread-f:w1');
  const bad = thread('w2', [msg({ sender: 'a@alphabox.com', toRecipients: 'not-an-array', addressDisplayNames: 'x', date: 'garbage', internalDate: 'zzz' })], { viewUrl: 'javascript:alert(1)' });
  const r2 = I.matchThreads([bad], { programs: P });
  assert.equal(r2[0].viewUrl, '');
  assert.equal(r2[0].date, '');
  assert.deepEqual(I.matchThreads([thread('bad id!', [msg({ sender: 'a@alphabox.com' })])], { programs: P }), []);
});

test('matchThreads: hostile subjects and snippets stay plain text', () => {
  const t = thread('h1', [msg({
    sender: 'a@alphabox.com', subject: '&lt;img src=x onerror=alert(1)&gt;‮{"} OR from:me\n\r', snippet: '&#60;script&#62;alert(1)&#60;/script&#62;'.repeat(50)
  })]);
  const r = I.matchThreads([t], { programs: P })[0];
  assert.doesNotMatch(r.subject, /[\n\r‮]/);
  assert.ok(r.subject.startsWith('<img src=x onerror=alert(1)>'));
  assert.ok(r.snippet.length <= 300);
  assert.equal(r.fromAddress, 'a@alphabox.com');
  const longSender = thread('h2', [msg({ sender: 'a@alphabox.com', subject: 'x'.repeat(1000) })]);
  assert.equal(I.matchThreads([longSender], { programs: P })[0].subject.length, 200);
});

// ---- suggest ----
function m(programId, kind, extra = {}) {
  return Object.assign({ programId, threadId: 't' + programId + kind, subject: kind, snippet: '', certainty: 'exact', kind }, extra);
}
test('suggest: welcome and confirm move todo to signed-up only', () => {
  const st = { a: 'todo', b: 'signed-up', c: 'received', d: 'skipped' };
  const r = I.suggest([m('a', 'welcome'), m('b', 'welcome'), m('c', 'confirm'), m('d', 'welcome')], (id) => st[id]);
  assert.deepEqual(r.map((x) => [x.programId, x.from, x.to]), [['a', 'todo', 'signed-up']]);
  const r2 = I.suggest([m('a', 'confirm')], () => 'todo');
  assert.equal(r2[0].to, 'signed-up');
});

test('suggest: received needs an exact match that says delivered; otherwise a note on signed-up', () => {
  const del = { subject: 'Your package was delivered' };
  let r = I.suggest([m('a', 'shipped', del)], () => 'signed-up');
  assert.deepEqual([r[0].to, r[0].noteOnly], ['received', false]);
  r = I.suggest([m('a', 'shipped', Object.assign({ certainty: 'likely' }, del))], () => 'signed-up');
  assert.equal(r[0].to, 'signed-up');
  assert.equal(r[0].noteOnly, true);
  r = I.suggest([m('a', 'shipped', { subject: 'Your order has shipped' })], () => 'signed-up');
  assert.deepEqual([r[0].to, r[0].noteOnly, r[0].note], ['signed-up', true, 'Shipped, per Gmail']);
  r = I.suggest([m('a', 'shipped', { subject: 'Your order has shipped' })], () => 'todo');
  assert.deepEqual([r[0].to, r[0].noteOnly], ['signed-up', false]);
  r = I.suggest([m('a', 'shipped', del)], () => 'todo');
  assert.equal(r[0].to, 'received');
});

test('suggest: never backwards, never skipped, at most one per program, robust to junk', () => {
  const list = [m('a', 'welcome'), m('a', 'shipped', { subject: 'was delivered' }), m('a', 'confirm')];
  const r = I.suggest(list, () => 'todo');
  assert.equal(r.length, 1);
  assert.equal(r[0].to, 'received');
  assert.deepEqual(I.suggest(list, () => 'received'), []);
  assert.deepEqual(I.suggest(list, () => 'skipped'), []);
  assert.deepEqual(I.suggest([], () => 'todo'), []);
  assert.deepEqual(I.suggest(undefined), []);
  assert.deepEqual(I.suggest([null, {}, 3, m('z', 'other')], () => 'todo'), []);
  assert.equal(I.suggest([m('a', 'welcome')]).length, 1); // statusOf optional
});

// ---- drafts ----
const FROM_B64 = (s) => Buffer.from(s, 'base64').toString('utf8');
test('utf8Base64 round-trips ASCII and non-ASCII like Buffer does', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'Baby freebies', 'Zoë – naïve café', '日本語のテスト', 'emoji \u{1F476}\u{1F37C}', 'line1\r\nline2\n', '\u0000\u007f', 'x'.repeat(1000) + 'é']) {
    assert.equal(I.utf8Base64(s), Buffer.from(s, 'utf8').toString('base64'), s.slice(0, 20));
    assert.equal(FROM_B64(I.utf8Base64(s)), s);
  }
  assert.equal(I.utf8Base64(null), '');
});

test('checklistDraft: to is exactly the person, body lists programs', () => {
  const d = I.checklistDraft({ email: ' ' + ME + ' ', programs: P.slice(0, 2), statusOf: (p) => (p.id === 'alpha-box' ? 'Signed up' : '') });
  assert.deepEqual(d.to, [ME]);
  assert.equal(d.subject, 'Baby freebies checklist');
  assert.match(d.body, /- Alpha Box \[Signed up\]\n {2}https:\/\/www\.alphabox\.com\/join/);
  assert.match(d.body, /- Beta Club\n/);
  assert.doesNotMatch(d.body, /\bsent\b/);
  assert.deepEqual(I.checklistDraft({ email: ME, programs: [] }).to, [ME]);
  assert.match(I.checklistDraft({ email: ME }).body, /No programs/);
});

test('checklistDraft and kitDraft refuse anything that is not one plain address', () => {
  for (const bad of ['', null, undefined, 'a@b', 'a@b.com, c@d.com', 'a@b.com\nBcc: c@d.com', 'a b@c.com', '<a@b.com>', 'Alex <a@b.com>', 'a@b.com;c@d.com', '"a"@b.com', 'a@b.c', 'x'.repeat(300) + '@b.com', 'a@@b.com', 'a@b.com>']) {
    assert.equal(I.checklistDraft({ email: bad, programs: P }), null, String(bad));
    assert.equal(I.kitDraft({ email: bad, files: [{ name: 'a.ics', text: 'x' }] }), null, String(bad));
  }
  assert.equal(I.checklistDraft(), null);
  assert.equal(I.kitDraft(), null);
});

test('kitDraft: attachments are base64 of the UTF-8 text with safe names and types', () => {
  const ics = 'BEGIN:VCALENDAR\r\nSUMMARY:Check for Café box\r\nEND:VCALENDAR\r\n';
  const d = I.kitDraft({ email: ME, files: [
    { name: 'baby-freebies-reminders.ics', text: ics },
    { name: '../../evil name.xml', text: '<feed>é</feed>' },
    { name: 'empty.xml', text: '' },
    { name: '', text: 'x' },
    null, { name: 'x.txt' }
  ] });
  assert.deepEqual(d.to, [ME]);
  assert.equal(d.attachments.length, 2);
  assert.equal(d.attachments[0].filename, 'baby-freebies-reminders.ics');
  assert.equal(d.attachments[0].mimeType, 'text/calendar');
  assert.equal(FROM_B64(d.attachments[0].content), ics);
  assert.equal(d.attachments[1].filename, 'evil-name.xml');
  assert.doesNotMatch(d.attachments[1].filename, /[\/\\ ]/);
  assert.equal(d.attachments[1].mimeType, 'application/xml');
  assert.equal(FROM_B64(d.attachments[1].content), '<feed>é</feed>');
  assert.doesNotMatch(d.body, /\bsent\b|Gmail filters/);
  assert.equal(I.kitDraft({ email: ME, files: [] }).attachments.length, 0);
});

test('kitDraft works with the real Phase E generators', () => {
  const xml = E.gmailFiltersXml(P, { email: ME, usePlus: true, tagMap: TAGS, allPrograms: P });
  const ics = E.icsReminders([{ id: 'alpha-box', name: 'Alpha Box', date: '2026-10-01' }], { days: 28 });
  const d = I.kitDraft({ email: ME, files: [{ name: 'f.xml', text: xml }, { name: 'r.ics', text: ics }] });
  assert.equal(FROM_B64(d.attachments[0].content), xml);
  assert.equal(FROM_B64(d.attachments[1].content), ics);
});

// ---- errors ----
const GROUPS = {
  'said-no': ['consent_required', 'approval_required', 'not_granted', 'not_in_manifest'],
  connect: ['needs_reauth', 'server_not_connected', 'server_not_found', 'selection_required'],
  later: ['rate_limited', 'server_unavailable', 'upstream_error'],
  unavailable: ['blocked_by_policy', 'capability_disabled', 'capability_removed', 'self_only', 'user_changed'],
  failed: ['tool_error', 'bad_request', 'cancelled', 'transform_error']
};
test('errorCopy: every code has one short sentence, one per group', () => {
  const seen = new Set();
  for (const [g, codes] of Object.entries(GROUPS)) {
    const first = I.errorCopy(codes[0]);
    for (const c of codes) {
      assert.equal(I.errorGroup(c), g, c);
      assert.equal(I.errorCopy(c), first, c);
      assert.ok(first.length > 20 && first.length < 260, c);
    }
    assert.ok(!seen.has(first));
    seen.add(first);
  }
  assert.match(I.errorCopy('server_not_connected'), /Connectors/);
  assert.match(I.errorCopy('rate_limited'), /try again/i);
  for (const c of Object.values(GROUPS).flat()) assert.doesNotMatch(I.errorCopy(c), /\b(send|sent|sends)\b|Gmail filters/i, c);
});

test('errorCopy: unknown codes read as unavailable; missing code is a plain failure', () => {
  assert.equal(I.errorCopy('something_new'), I.errorCopy('blocked_by_policy'));
  assert.equal(I.errorCopy('toString'), I.errorCopy('blocked_by_policy'));
  assert.equal(I.errorCopy('__proto__'), I.errorCopy('blocked_by_policy'));
  assert.equal(I.errorCopy(undefined), I.errorCopy('tool_error'));
  assert.equal(I.errorCopy(42), I.errorCopy('tool_error'));
});

test('clearsData: said-no, connect and unavailable clear mailbox data; later and failed do not', () => {
  for (const c of [...GROUPS['said-no'], ...GROUPS.connect, ...GROUPS.unavailable, 'brand_new']) assert.equal(I.clearsData(c), true, c);
  for (const c of [...GROUPS.later, ...GROUPS.failed, undefined]) assert.equal(I.clearsData(c), false, String(c));
});

test('validAddress and clean', () => {
  assert.equal(I.validAddress('  a.b+c@example.com '), 'a.b+c@example.com');
  assert.equal(I.validAddress('a@b'), '');
  assert.equal(I.validAddress(null), '');
  assert.equal(I.clean('a\u0000b‮c\n d', 10), 'a b c d');
  assert.equal(I.clean('x\u{1F600}', 2), 'x');
});

test('marketing and baby-is-coming wording is not shipping or delivery news', () => {
  const c = (subject, snippet = '') => I.classify({ subject, snippet });
  assert.equal(c('Your baby is on the way', 'Congratulations, mama'), 'other');
  assert.equal(c('Delivered right to your door', 'Save 20% on diapers'), 'other');
  assert.equal(c('Fresh diapers just delivered to you'), 'other');
  assert.equal(c('Now delivered nationwide'), 'other');
  assert.equal(c('Your order is on the way'), 'shipped');
  assert.equal(c('Delivered: your sample box'), 'shipped');
  assert.equal(I.isDelivered({ subject: 'Delivered right to your door', snippet: 'Free shipping' }), false);
  // so a marketing email to the program's own plus address cannot suggest "received"
  const th = thread('tm1', [msg({ subject: 'Delivered right to your door', snippet: 'Shop now', toRecipients: [E.plusAddress(ME, TAGS['alpha-box'])] })]);
  const m = I.matchThreads([th], { programs: P, email: ME, tagMap: TAGS });
  assert.deepEqual(I.suggest(m, () => 'todo'), []);
});

test('errorGroup: a page that was switched off for this view reads as not allowed, not as broken', () => {
  assert.equal(I.errorGroup('not_in_manifest'), 'said-no');
  assert.equal(I.clearsData('not_in_manifest'), true);
  assert.match(I.errorCopy('not_in_manifest'), /not allowed/);
});

test('copy never promises that labels or drafts work, and never says mail was sent', () => {
  const src = readFileSync(new URL('../src/js/inboxview.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/js/inbox.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src.replace('Nothing was sent.', ''), /\bwas sent\b|\bhas been sent\b|\bwe sent\b|\bsent to you\b/i);
  assert.match(readFileSync(new URL('../src/js/inboxview.js', import.meta.url), 'utf8'), /THREAD_VIEW_SUMMARY/);
});

test('buildQueries: a +tag already on the address is not stacked, and a Yahoo address gets no to: terms', () => {
  const tagged = 'sam.rivera+old@gmail.com';
  const qs = I.buildQueries({ programs: P, email: tagged, tagMap: E.tagMap(P), usePlus: true });
  qs.forEach((q) => assert.doesNotMatch(q.query, /\+old\+/));
  const y = I.buildQueries({ programs: P, email: 'sam.rivera@yahoo.com', tagMap: E.tagMap(P), usePlus: true });
  y.forEach((q) => assert.doesNotMatch(q.query, /to:/));
  assert.deepEqual(I.buildQueries({ programs: [], email: ME, tagMap: {}, usePlus: true }), []);
});

// ---- the email-features rule at scale ----
function synth(n) {
  return Array.from({ length: n }, (_, i) => {
    const id = 'prog-' + String(i).padStart(3, '0');
    const kind = i % 5; // 0,1,2: brand with email; 3: .gov with email; 4: brand, no email (a phone or insurer program)
    const host = kind === 3 ? 'office' + i + '.example-agency.gov' : 'long-brand-name-number-' + i + '.com';
    return { id, brand: 'Brand' + i, name: 'Program ' + i, requirements: kind === 4 ? ['phone', 'insurance'] : ['email', 'address'], signupUrl: 'https://www.' + host + '/join' };
  });
}

test('150 programs: only email brand sign-ups are searched, in short chunks, none lost', () => {
  const many = synth(150), inc = many.filter(E.inEmailFeatures);
  assert.equal(inc.length, 90);
  const tm = E.tagMap(many);
  for (const usePlus of [true, false]) {
    const q = I.buildQueries({ programs: many, email: ME, tagMap: tm, usePlus });
    assert.ok(q.length >= 2);
    q.forEach((x) => {
      assert.ok(x.query.length <= 1400, 'query length ' + x.query.length);
      assert.ok((x.query.match(/(?:to|from):/g) || []).length <= 25);
    });
    const covered = new Set(q.flatMap((x) => x.programIds));
    assert.deepEqual([...covered].sort(), inc.map((p) => p.id).sort());
    const text = q.map((x) => x.query).join(' ');
    assert.doesNotMatch(text, /example-agency\.gov/);
    assert.equal(usePlus ? /to:/.test(text) : /to:/.test(text), usePlus);
    assert.deepEqual(I.unsearchable({ programs: many, email: ME, tagMap: tm, usePlus }), []);
  }
});

test('matchThreads ignores a program that is outside the email features, even by plus address or sender', () => {
  const gov = { id: 'gov-prog', name: 'Gov', brand: 'Gov', requirements: ['email'], signupUrl: 'https://www.benefit.gov/x' };
  const noMail = { id: 'no-mail', name: 'No mail', brand: 'Nomail', requirements: ['phone'], signupUrl: 'https://www.nomail.com/x' };
  const progs = [P[0], gov, noMail];
  const tm = E.tagMap(progs);
  const th = [
    thread('t-gov', [msg({ id: 'a', threadId: 't-gov', sender: 'x@benefit.gov', toRecipients: [E.plusAddress(ME, tm['gov-prog'])] })]),
    thread('t-nm', [msg({ id: 'b', threadId: 't-nm', sender: 'x@nomail.com', toRecipients: [E.plusAddress(ME, tm['no-mail'])] })]),
    thread('t-ok', [msg({ id: 'c', threadId: 't-ok' })])
  ];
  const m = I.matchThreads(th, { programs: progs, email: ME, tagMap: tm });
  assert.deepEqual(m.map((x) => x.programId), ['alpha-box']);
});
