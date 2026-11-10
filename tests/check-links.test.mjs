import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrableDomain, isExpectedRedirect, classify } from '../scripts/check-links.mjs';

test('registrableDomain', () => {
  assert.equal(registrableDomain('www.similac.com'), 'similac.com');
  assert.equal(registrableDomain('help.babylist.com'), 'babylist.com');
  assert.equal(registrableDomain('cert.safekids.org'), 'safekids.org');
  assert.equal(registrableDomain('www.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('www.revenue.state.mn.us'), 'state.mn.us');
  assert.equal(registrableDomain('www.medela.us'), 'medela.us');
  assert.equal(registrableDomain('shop.example.com.au'), 'example.com.au');
  assert.equal(registrableDomain('211.org'), '211.org');
  assert.equal(registrableDomain('WWW.Pampers.COM'), 'pampers.com');
});

test('isExpectedRedirect', () => {
  assert.ok(isExpectedRedirect('www.babylist.com', 'help.babylist.com'));
  assert.ok(isExpectedRedirect('fns.usda.gov', 'fna.usda.gov')); // same registrable domain, no allowlist needed
  assert.ok(isExpectedRedirect('www.byramhealthcare.com', 'byrambaby.com'));
  assert.ok(isExpectedRedirect('pgeveryday.com', 'www.pgbrandsaver.com'));
  assert.ok(!isExpectedRedirect('similac.com', 'evil-coupons.com'));
});

const start = 'https://www.similac.com/rewards.html';

test('classify OK', () => {
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>MySimilac Rewards</title>' }), 'OK');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: 'https://similac.com/x', bodySnippet: '' }), 'OK');
});

test('classify NOT-FOUND', () => {
  assert.equal(classify({ status: 404, startUrl: start, finalUrl: start }), 'NOT-FOUND');
  assert.equal(classify({ status: 410, startUrl: start, finalUrl: start }), 'NOT-FOUND');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>Page Not Found | Brand</title>' }), 'NOT-FOUND');
});

test('classify OFF-DOMAIN', () => {
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: 'https://coupons.example.net/', bodySnippet: '<title>Hi</title>' }), 'OFF-DOMAIN');
});

test('classify BLOCKED', () => {
  for (const status of [403, 429, 503]) {
    assert.equal(classify({ status, startUrl: start, finalUrl: start }), 'BLOCKED');
  }
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>Just a moment...</title>' }), 'BLOCKED');
  assert.equal(classify({ startUrl: start, error: 'fetch failed' }), 'BLOCKED');
  assert.equal(classify({ startUrl: start, error: 'Timeout' }), 'BLOCKED');
});

test('domain and status win over body markers (#14)', () => {
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: 'https://evil.example/', bodySnippet: 'captcha <title>Just a moment</title>' }), 'OFF-DOMAIN');
  assert.equal(classify({ status: 404, startUrl: start, finalUrl: start, bodySnippet: '<title>Just a moment...</title>' }), 'NOT-FOUND');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<script src="recaptcha">captcha</script><title>Rewards</title>' }), 'OK');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>Attention Required! | Cloudflare</title>' }), 'BLOCKED');
});

test('classify DEAD (#15)', () => {
  for (const errorCode of ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'CERT_HAS_EXPIRED']) {
    assert.equal(classify({ startUrl: start, error: 'fetch failed', errorCode }), 'DEAD');
  }
  assert.equal(classify({ startUrl: start, error: 'reset', errorCode: 'ECONNRESET' }), 'BLOCKED');
  assert.equal(classify({ startUrl: start, error: 'Timeout' }), 'BLOCKED');
});

test('allowlist pairs other than usda still work, unrelated do not (#18)', () => {
  assert.ok(isExpectedRedirect('byramhealthcare.com', 'www.byrambaby.com'));
  assert.ok(!isExpectedRedirect('byrambaby.com', 'byramhealthcare.com'));
  assert.ok(!isExpectedRedirect('pgbrandsaver.com', 'pgeveryday.com'));
});

test('insecure redirects are BLOCKED, not failures (#19)', () => {
  const r = { status: 200, startUrl: start, finalUrl: 'http://www.similac.com/rewards.html', bodySnippet: '<title>x</title>' };
  assert.equal(classify(r), 'BLOCKED');
  assert.equal(classify({ ...r, finalUrl: start, insecureHop: true }), 'BLOCKED');
});

// ---------- Phase F4: every URL, SUSPECT, polite checking, report ----------
import http from 'node:http';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyDetailed, collectUrls, normalizeUrl, isHomePath, suspectReason, runChecks, buildReport, buildJson,
  summarize, parseArgs, main, USER_AGENT,
} from '../scripts/check-links.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/check-links.mjs', import.meta.url));
const FAST = { gapMs: 2, retryDelayMs: 5, allowHttp: true, timeoutMs: 3000 };

async function withServer(fn) {
  const hits = {};
  let active = 0; let maxActive = 0; const agents = new Set();
  const server = http.createServer((req, res) => {
    const path = req.url.split('?')[0];
    hits[path] = (hits[path] || 0) + 1;
    agents.add(req.headers['user-agent']);
    const send = (code, body = '', headers = {}) => { res.writeHead(code, { 'content-type': 'text/html', ...headers }); res.end(body); };
    const port = server.address().port;
    if (path.startsWith('/serial/')) {
      active++; maxActive = Math.max(maxActive, active);
      return setTimeout(() => { active--; send(200, '<title>Serial</title>'); }, 20);
    }
    switch (path) {
      case '/': return send(200, '<title>Home</title>');
      case '/en-us/': return send(200, '<title>Home</title>');
      case '/fine': return send(200, '<title>Rewards</title><h1>Welcome</h1>');
      case '/same': return send(302, '', { location: '/fine' });
      case '/gone': return send(404, 'nope');
      case '/soft404': return send(200, '<title>Page Not Found | Brand</title>');
      case '/deep/offer': return send(302, '', { location: '/' });
      case '/deep/offer2': return send(302, '', { location: '/en-us/' });
      case '/deep/index': return send(302, '', { location: '/index.html' });
      case '/title-gone': return send(200, '<title>This offer is no longer available</title>');
      case '/h1-gone': return send(200, "<title>Brand</title><h1>We couldn't find that page</h1>");
      case '/mentions': return send(200, '<title>Rewards</title><h1>Welcome</h1><p>Error 404 and page not found are handled; no longer available items hide.</p>');
      case '/late-h1': return send(200, '<title>Brand</title>' + 'x'.repeat(70000) + '<h1>Page not found</h1>');
      case '/off': return send(302, '', { location: `http://localhost:${port}/fine` });
      case '/forbidden': return send(403, 'blocked');
      case '/limited': return send(429, 'slow down');
      case '/flaky': if (hits[path] === 1) return req.socket.destroy(); return send(200, '<title>Back</title>');
      case '/err500': return send(500, 'oops');
      case '/loop': return send(302, '', { location: '/loop' });
      default: return send(200, '<title>Other</title>');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { return await fn({ base, hits, agents, maxActive: () => maxActive, port: server.address().port }); }
  finally { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
}

const run1 = async (base, path, extra = {}) => {
  const [r] = await runChecks(new Map([[base + path, [{ programId: 'p', role: 'signup' }]]]), { ...FAST, ...extra });
  return r;
};

test('normalizeUrl drops the fragment and keeps the query', () => {
  assert.equal(normalizeUrl('https://a.com/x?y=1#top'), 'https://a.com/x?y=1');
  assert.equal(normalizeUrl('https://a.com#z'), 'https://a.com/');
  assert.equal(normalizeUrl('not a url'), '');
});

test('collectUrls dedupes across programs and roles, keeps every use', () => {
  const programs = [
    { id: 'a', signupUrl: 'https://a.com/join#form', sourceUrls: ['https://a.com/join', 'https://a.com/faq#q', 'https://a.com/faq'] },
    { id: 'b', signupUrl: 'https://b.com/', sourceUrls: ['https://a.com/faq?x=1', 'https://a.com/join'] },
  ];
  const m = collectUrls(programs);
  assert.deepEqual([...m.keys()], ['https://a.com/join', 'https://a.com/faq', 'https://b.com/', 'https://a.com/faq?x=1']);
  assert.deepEqual(m.get('https://a.com/join'), [
    { programId: 'a', role: 'signup' }, { programId: 'a', role: 'source' }, { programId: 'b', role: 'source' }]);
  assert.deepEqual(m.get('https://a.com/faq'), [{ programId: 'a', role: 'source' }]);
});

test('collectUrls honours role and ids', () => {
  const programs = [
    { id: 'a', signupUrl: 'https://a.com/s', sourceUrls: ['https://a.com/src'] },
    { id: 'b', signupUrl: 'https://b.com/s', sourceUrls: ['https://b.com/src'] },
  ];
  assert.deepEqual([...collectUrls(programs, { role: 'signup' }).keys()], ['https://a.com/s', 'https://b.com/s']);
  assert.deepEqual([...collectUrls(programs, { role: 'source', ids: ['b'] }).keys()], ['https://b.com/src']);
  assert.deepEqual([...collectUrls(programs, { ids: ['a'] }).keys()], ['https://a.com/s', 'https://a.com/src']);
});

test('real data: every signupUrl and sourceUrls entry is covered once', () => {
  const programs = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'));
  const m = collectUrls(programs);
  const all = new Set();
  for (const p of programs) for (const u of [p.signupUrl, ...(p.sourceUrls || [])]) all.add(normalizeUrl(u));
  assert.equal(m.size, all.size);
  for (const p of programs) assert.ok(m.get(normalizeUrl(p.signupUrl)).some((u) => u.programId === p.id && u.role === 'signup'));
});

test('isHomePath', () => {
  for (const p of ['/', '/index.html', '/index.php', '/en-us/', '/en_US', '/us/en/', '/en/index.html', '']) assert.ok(isHomePath(p), p);
  for (const p of ['/rewards', '/en-us/rewards', '/baby/free', '/about-us/', '/join/now']) assert.ok(!isHomePath(p), p);
});

test('SUSPECT: deep link redirected to a home or locale home', () => {
  const s = 'https://www.brand.com/baby/free-samples';
  assert.equal(classifyDetailed({ status: 200, startUrl: s, finalUrl: 'https://www.brand.com/' }).cls, 'SUSPECT');
  assert.equal(classifyDetailed({ status: 200, startUrl: s, finalUrl: 'https://www.brand.com/index.html' }).cls, 'SUSPECT');
  assert.equal(classifyDetailed({ status: 200, startUrl: s, finalUrl: 'https://www.brand.com/en-us/' }).cls, 'SUSPECT');
  // non-matches
  assert.equal(classifyDetailed({ status: 200, startUrl: s, finalUrl: 'https://www.brand.com/baby/samples' }).cls, 'OK');
  assert.equal(classifyDetailed({ status: 200, startUrl: 'https://www.brand.com/', finalUrl: 'https://www.brand.com/' }).cls, 'OK');
  assert.equal(classifyDetailed({ status: 200, startUrl: 'https://www.brand.com/en-us/', finalUrl: 'https://www.brand.com/en-us/' }).cls, 'OK');
  assert.equal(classifyDetailed({ status: 200, startUrl: 'https://www.brand.com/en-us/', finalUrl: 'https://www.brand.com/' }).cls, 'OK');
});

test('SUSPECT: not-found wording in title or first h1 only', () => {
  const s = 'https://www.brand.com/x';
  const c = (bodySnippet) => classifyDetailed({ status: 200, startUrl: s, finalUrl: s, bodySnippet }).cls;
  assert.equal(c('<title>Offer no longer available</title>'), 'SUSPECT');
  assert.equal(c('<title>Page unavailable</title>'), 'SUSPECT');
  assert.equal(c('<title>404</title>'), 'NOT-FOUND'); // existing hard rule
  assert.equal(c('<title>Error 404 - Brand</title>'), 'SUSPECT');
  assert.equal(c('<title>Brand</title><h1 class="x"><span>Sorry, we couldn’t find that</span></h1>'), 'SUSPECT');
  assert.equal(c("<title>Brand</title><h1>This page can't be found</h1>"), 'SUSPECT');
  assert.equal(c('<title>Brand</title><h1>Welcome</h1><h2>Page not found</h2>'), 'OK');
  assert.equal(c('<title>Brand</title><h1>Welcome</h1><h1>Page not found</h1>'), 'OK'); // only the first h1
  assert.equal(c('<title>Rewards</title><p>Error 404, page not found, no longer available</p>'), 'OK');
  assert.equal(c('<title>Save $404 on diapers</title>'), 'OK');
  assert.equal(c('<title>Rewards</title>' + ' '.repeat(70000) + '<h1>Page not found</h1>'), 'OK'); // beyond 64 KB
  // a hard not-found title keeps its stronger class, and status beats SUSPECT
  assert.equal(c('<title>Page Not Found | Brand</title>'), 'NOT-FOUND');
  assert.equal(classifyDetailed({ status: 403, startUrl: s, finalUrl: s, bodySnippet: '<title>no longer available</title>' }).cls, 'BLOCKED');
  assert.equal(suspectReason({ startUrl: s, finalUrl: s, bodySnippet: '<title>Fine</title>' }), '');
});

test('local server: each class end to end', async () => {
  await withServer(async ({ base, hits, agents, port }) => {
    const cls = async (p, extra) => (await run1(base, p, extra)).class;
    assert.equal(await cls('/fine'), 'OK');
    assert.equal(await cls('/'), 'OK'); // a real home-page link
    assert.equal(await cls('/en-us/'), 'OK');
    assert.equal(await cls('/same'), 'OK');
    assert.equal((await run1(base, '/same')).finalUrl, base + '/fine');
    assert.equal(await cls('/gone'), 'NOT-FOUND');
    assert.equal(await cls('/soft404'), 'NOT-FOUND');
    assert.equal(await cls('/off'), 'OFF-DOMAIN');
    assert.equal(await cls('/forbidden'), 'BLOCKED');
    assert.equal(await cls('/limited'), 'BLOCKED');
    assert.equal(await cls('/loop', { maxRedirects: 3 }), 'BLOCKED');
    assert.equal(await cls('/deep/offer'), 'SUSPECT');
    assert.equal(await cls('/deep/offer2'), 'SUSPECT');
    assert.equal(await cls('/deep/index'), 'SUSPECT');
    assert.equal(await cls('/title-gone'), 'SUSPECT');
    assert.equal(await cls('/h1-gone'), 'SUSPECT');
    assert.equal(await cls('/mentions'), 'OK'); // body text mentions 404 only
    assert.equal(await cls('/late-h1'), 'OK');
    assert.equal(hits['/loop'], 4);
    assert.ok([...agents].every((a) => a === USER_AGENT), 'one honest user agent for every request');
    // DEAD: nothing listens on a port that was just closed
    const s = http.createServer(); await new Promise((r) => s.listen(0, '127.0.0.1', r));
    const dead = s.address().port; await new Promise((r) => s.close(r));
    assert.equal((await runChecks(new Map([[`http://127.0.0.1:${dead}/x`, []]]), FAST))[0].class, 'DEAD');
    assert.ok(port > 0);
  });
});

test('no retry on 403 or 429; one retry on a dropped connection or 5xx', async () => {
  await withServer(async ({ base, hits }) => {
    await run1(base, '/forbidden');
    await run1(base, '/limited');
    assert.equal(hits['/forbidden'], 1);
    assert.equal(hits['/limited'], 1);
    const flaky = await run1(base, '/flaky');
    assert.equal(hits['/flaky'], 2);
    assert.equal(flaky.class, 'OK');
    const e = await run1(base, '/err500');
    assert.equal(hits['/err500'], 2);
    assert.equal(e.class, 'BLOCKED');
  });
});

test('per-host serialisation: never two overlapping requests to one host', async () => {
  await withServer(async ({ base, maxActive }) => {
    const m = new Map();
    for (let i = 0; i < 8; i++) m.set(`${base}/serial/${i}`, [{ programId: `p${i}`, role: 'source' }]);
    const results = await runChecks(m, { ...FAST, concurrency: 6 });
    assert.equal(results.length, 8);
    assert.ok(results.every((r) => r.class === 'OK'));
    assert.equal(maxActive(), 1);
  });
});

test('report ordering, summary counts and JSON shape', () => {
  const U = (programId, role) => ({ programId, role });
  const results = [
    { url: 'https://a.com/fine', class: 'OK', status: 200, finalUrl: 'https://a.com/fine', detail: '', uses: [U('a', 'signup'), U('b', 'source')] },
    { url: 'https://b.com/blocked', class: 'BLOCKED', status: 403, finalUrl: 'https://b.com/blocked', detail: 'HTTP 403', uses: [U('b', 'signup')] },
    { url: 'https://c.com/sus', class: 'SUSPECT', status: 200, finalUrl: 'https://c.com/', detail: 'Deep link redirected', uses: [U('c', 'source')] },
    { url: 'https://d.com/gone', class: 'NOT-FOUND', status: 404, finalUrl: 'https://d.com/gone', detail: 'HTTP 404', uses: [U('d', 'signup')] },
    { url: 'https://e.com/dead', class: 'DEAD', status: 0, finalUrl: 'https://e.com/dead', detail: 'ENOTFOUND', uses: [U('e', 'source')] },
  ];
  const md = buildReport(results, '2026-11-10');
  const at = (s) => md.indexOf(s);
  assert.ok(at('## Needs attention') < at('## SUSPECT') && at('## SUSPECT') < at('## BLOCKED') && at('## BLOCKED') < at('## OK'));
  assert.ok(at('https://d.com/gone') < at('## SUSPECT'));
  assert.ok(at('https://e.com/dead') < at('## SUSPECT'));
  assert.ok(at('https://c.com/sus') > at('## SUSPECT') && at('https://c.com/sus') < at('## BLOCKED'));
  assert.ok(at('https://b.com/blocked') > at('## BLOCKED') && at('https://b.com/blocked') < at('## OK'));
  assert.ok(at('https://a.com/fine') > at('## OK'));
  assert.match(md, /\| SUSPECT \| 200 \| https:\/\/c\.com\/sus \| https:\/\/c\.com\/ \| c \(source\) \|/);
  assert.match(md, /5 unique URLs\. OK 1, NOT-FOUND 1, OFF-DOMAIN 0, DEAD 1, SUSPECT 1, BLOCKED 1/);
  assert.match(md, /signup URLs 3: 1 OK, 1 blocked, 0 suspect, 1 broken/);
  assert.match(md, /source URLs 3: 1 OK, 0 blocked, 1 suspect, 1 broken/);
  assert.match(md, /a\.com\/fine \(a \(signup\), b \(source\)\)|a \(signup\), b \(source\)/);
  const s = summarize(results);
  assert.equal(s.total, 5);
  assert.equal(s.byRole.signup.total, 3);
  assert.equal(s.byRole.source['NOT-FOUND'], 0);
  const j = buildJson(results, '2026-11-10');
  assert.equal(j.checkedOn, '2026-11-10');
  assert.deepEqual(j.results.map((r) => r.class), ['NOT-FOUND', 'DEAD', 'SUSPECT', 'BLOCKED', 'OK']);
  assert.deepEqual(Object.keys(j.results[0]).sort(), ['class', 'detail', 'finalUrl', 'status', 'url', 'uses']);
  assert.deepEqual(j.results[4].uses, [U('a', 'signup'), U('b', 'source')]);
});

test('parseArgs', () => {
  assert.equal(parseArgs([]).role, 'all');
  assert.deepEqual(parseArgs(['--ids', 'a, b,,c', '--role', 'signup']).ids, ['a', 'b', 'c']);
  assert.deepEqual(parseArgs(['--only', 'a']).ids, ['a']);
  assert.throws(() => parseArgs(['--role', 'nope']));
  assert.throws(() => parseArgs(['--wat']));
  assert.throws(() => parseArgs(['--out']));
});

test('CLI main: --role, --ids, JSON file and exit codes', async () => {
  await withServer(async ({ base }) => {
    const dir = mkdtempSync(join(tmpdir(), 'cl-'));
    const data = join(dir, 'programs.json');
    const prog = (id, signupUrl, sourceUrls) => ({ id, signupUrl, sourceUrls });
    const write = (arr) => writeFileSync(data, JSON.stringify(arr));
    const args = (...a) => ['--data', data, '--allow-http', '--gap', '2', '--retry-delay', '5', '--out', join(dir, 'r.md'), '--json', join(dir, 'r.json'), ...a];
    const json = () => JSON.parse(readFileSync(join(dir, 'r.json'), 'utf8'));

    write([prog('good', `${base}/fine#a`, [`${base}/fine`, `${base}/same`]), prog('shaky', `${base}/title-gone`, [`${base}/forbidden`])]);
    assert.equal(await main(args(), { quiet: true }), 0); // OK, SUSPECT, BLOCKED never fail
    let j = json();
    assert.equal(j.summary.total, 4);
    assert.equal(j.summary.byClass.SUSPECT, 1);
    assert.equal(j.summary.byClass.BLOCKED, 1);
    assert.deepEqual(j.results.find((r) => r.url === `${base}/fine`).uses, [
      { programId: 'good', role: 'signup' }, { programId: 'good', role: 'source' }]);

    assert.equal(await main(args('--role', 'signup'), { quiet: true }), 0);
    j = json();
    assert.equal(j.summary.total, 2);
    assert.ok(j.results.every((r) => r.uses.every((u) => u.role === 'signup')));

    assert.equal(await main(args('--ids', 'good'), { quiet: true }), 0);
    j = json();
    assert.deepEqual(new Set(j.results.flatMap((r) => r.uses.map((u) => u.programId))), new Set(['good']));

    write([prog('good', `${base}/fine`, []), prog('broken', `${base}/fine`, [`${base}/gone`])]);
    assert.equal(await main(args(), { quiet: true }), 1); // a source link is NOT-FOUND
    assert.equal(await main(args('--ids', 'good'), { quiet: true }), 0); // recheck only the good one
    assert.match(readFileSync(join(dir, 'r.md'), 'utf8'), /ids good/);
    await assert.rejects(main(args('--ids', 'missing'), { quiet: true }), /Unknown program id/);
  });
});

test('CLI process exits 2 when the checker itself fails', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--role', 'bogus'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Checker failed/);
  const r2 = spawnSync(process.execPath, [SCRIPT, '--data', '/nonexistent/x.json'], { encoding: 'utf8' });
  assert.equal(r2.status, 2);
});
