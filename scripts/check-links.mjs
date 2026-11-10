#!/usr/bin/env node
// Link checker for every URL the app can show: signupUrl and each sourceUrls entry
// of data/programs.json, normalised and deduplicated. Node 20+, no dependencies.
// Polite: honest User-Agent, one request at a time per host with a gap, small global
// concurrency, timeouts, redirect cap, body cap. One retry for network errors and 5xx
// only; never a retry with another user agent or headers. BLOCKED and SUSPECT never fail.
// Exit codes: 0 nothing needs attention, 1 something does, 2 the checker itself failed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const USER_AGENT =
  'BabyFreebiesFinder-linkcheck/1.0 (+https://github.com/luisitin/Babystuff)';

const SECOND_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'gov.au',
  'co.nz', 'co.jp', 'co.in', 'com.br', 'com.mx', 'co.za', 'com.sg', 'com.hk',
]);

const REDIRECT_ALLOWLIST = [
  ['byramhealthcare.com', 'byrambaby.com'],
  ['pgeveryday.com', 'pgbrandsaver.com'],
];

export function registrableDomain(host) {
  let h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
  h = h.replace(/^www\./, '');
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  const n = SECOND_LEVEL.has(lastTwo) ? 3 : 2;
  return labels.slice(-n).join('.');
}

export function isExpectedRedirect(fromHost, toHost) {
  const from = registrableDomain(fromHost);
  const to = registrableDomain(toHost);
  if (from === to) return true;
  return REDIRECT_ALLOWLIST.some(([a, b]) => a === from && b === to);
}

const DEAD_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID',
]);
// Body markers only matter for an otherwise-OK 200 page.
const CHALLENGE_TITLE_RE = /just a moment|attention required|access denied|checking your browser|verify you are (a )?human|are you a robot/i;
const CHALLENGE_BODY_RE = /cf-browser-verification|challenge-platform|_cf_chl|px-captcha|request could not be satisfied/i;
const NOT_FOUND_RE = /page not found|404 not found|not found\s*[|\-\u2013]|^\s*404\b|we can.?t find (that|this) page|page (does not|doesn.?t) exist/i;

// Wording that suggests a page is gone even though the server said 200.
const GONE_RE = /(^|[^\w])404(?=\s*(error|not found|page|[-|:\u2013\u2014]|$))|^\s*error\s*404|page (not found|can.?t be found|cannot be found|unavailable)|no longer available|we (couldn.?t|could not|can.?t|cannot) find/i;
const LOCALE_RE = /^[a-z]{2}([-_][a-z]{2,4})?$/i;

// True for "/", "/index.html", "/en-us/", "/us/en/", "/en/index.html".
export function isHomePath(pathname) {
  const segs = String(pathname || '/').split('/').filter(Boolean);
  if (segs.length && /^index(\.\w+)?$/i.test(segs[segs.length - 1])) segs.pop();
  return segs.length === 0 || (segs.length <= 2 && segs.every((s) => LOCALE_RE.test(s)));
}

const stripTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// A 200 page that looks gone: redirected deep link landing on a home page, or a
// not-found <title> / first <h1> in the first 64 KB. Returns a detail string or ''.
export function suspectReason({ startUrl, finalUrl, bodySnippet } = {}) {
  try {
    const a = new URL(startUrl);
    const b = new URL(finalUrl || startUrl);
    if (!isHomePath(a.pathname) && isHomePath(b.pathname) && a.pathname !== b.pathname) {
      return `Deep link redirected to the home page (${b.pathname}${b.search ? '?...' : ''})`;
    }
  } catch { /* no URL, no redirect rule */ }
  const body = String(bodySnippet || '').slice(0, 64 * 1024);
  const title = stripTags((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1]);
  if (title && GONE_RE.test(title)) return `Page title reads like not found: "${title.slice(0, 100)}"`;
  const h1 = stripTags((body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]);
  if (h1 && GONE_RE.test(h1)) return `First heading reads like not found: "${h1.slice(0, 100)}"`;
  return '';
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Returns { cls, note }. Classes: OK, NOT-FOUND, OFF-DOMAIN, DEAD, SUSPECT, BLOCKED.
// allowHttp is for tests against a local http server only.
export function classifyDetailed({ status, finalUrl, startUrl, error, errorCode, insecureHop, bodySnippet, allowHttp } = {}) {
  const body = bodySnippet || '';
  if (error) {
    if (errorCode && DEAD_CODES.has(errorCode)) return { cls: 'DEAD', note: `${errorCode}: ${error}` };
    return { cls: 'BLOCKED', note: `Network error: ${error}` };
  }
  // 1. Domain
  if (finalUrl && startUrl) {
    const from = hostOf(startUrl);
    const to = hostOf(finalUrl);
    if (to && from && !isExpectedRedirect(from, to)) {
      return { cls: 'OFF-DOMAIN', note: `Redirected from ${registrableDomain(from)} to ${registrableDomain(to)}` };
    }
  }
  // 2. Status
  if (status === 404 || status === 410) return { cls: 'NOT-FOUND', note: `HTTP ${status}` };
  // 3. Insecure hop or final URL (not a failure, but reported)
  const insecure = !allowHttp && (insecureHop || (finalUrl && !/^https:/i.test(finalUrl)));
  if (insecure) return { cls: 'BLOCKED', note: 'insecure redirect (http: hop on the way or at the end); check by hand' };
  if (status === 403 || status === 429 || status === 503) {
    return { cls: 'BLOCKED', note: `HTTP ${status}${CHALLENGE_TITLE_RE.test(body) || CHALLENGE_BODY_RE.test(body) ? ' (bot challenge)' : ''}` };
  }
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1];
  if (NOT_FOUND_RE.test(title)) return { cls: 'NOT-FOUND', note: 'Page title says not found' };
  if (typeof status === 'number' && status >= 400) return { cls: 'BLOCKED', note: `HTTP ${status}` };
  // 4. Body markers only turn an otherwise-OK page into BLOCKED
  if (CHALLENGE_TITLE_RE.test(title) || CHALLENGE_BODY_RE.test(body)) {
    return { cls: 'BLOCKED', note: 'Bot challenge page' };
  }
  if (typeof status === 'number' && status >= 200 && status < 400) {
    const why = suspectReason({ startUrl, finalUrl, bodySnippet: body });
    if (why) return { cls: 'SUSPECT', note: why };
  }
  return { cls: 'OK', note: '' };
}

export function classify(input) {
  return classifyDetailed(input).cls;
}

// ---------- network part ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readSnippet(res, limit = 64 * 1024) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, limit).toString('utf8');
}

const codeOf = (e) => (e && e.cause && e.cause.code) || (e && e.code) || '';
const NO_RETRY_CODES = new Set(['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID']);

// Key that decides which requests must queue behind each other: the registrable
// domain (www and bare host share servers), or host:port for IP literals and ports.
export function hostKey(url) {
  try {
    const u = new URL(url);
    if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(':') || u.port) return `${u.hostname}:${u.port}`;
    return registrableDomain(u.hostname);
  } catch { return ''; }
}

// At most one request at a time per key, with a gap after each one finishes.
export class HostGate {
  constructor(gapMs = 1000) { this.gapMs = gapMs; this.tails = new Map(); }
  async run(key, fn) {
    const prev = this.tails.get(key) || Promise.resolve();
    let release;
    this.tails.set(key, new Promise((r) => { release = r; }));
    await prev;
    try { return await fn(); } finally { setTimeout(release, this.gapMs); }
  }
}

export async function checkUrl(startUrl, {
  maxRedirects = 8, timeoutMs = 20000, gate = new HostGate(0), retryDelayMs = 1500, allowHttp = false,
} = {}) {
  let url = startUrl;
  let insecureHop = !allowHttp && /^http:/i.test(startUrl);
  // One request, including reading the (capped) body, inside the host gate.
  const once = (u) => gate.run(hostKey(u), async () => {
    const res = await fetch(u, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      return { status: res.status, location: res.headers.get('location') };
    }
    return { status: res.status, snippet: await readSnippet(res) };
  });
  // One retry, same request, only for network-level errors and 5xx. Never for 4xx.
  const get = async (u) => {
    let r;
    try {
      r = await once(u);
    } catch (e) {
      if (NO_RETRY_CODES.has(codeOf(e))) throw e;
      await sleep(retryDelayMs);
      return once(u);
    }
    if (r.status >= 500) { await sleep(retryDelayMs); try { r = await once(u); } catch { /* keep the 5xx */ } }
    return r;
  };
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const r = await get(url);
      if (r.location) {
        const next = new URL(r.location, url).href;
        if (/^http:/i.test(next) && !allowHttp) insecureHop = true;
        url = next;
        continue;
      }
      return { status: r.status, finalUrl: url, startUrl, insecureHop, bodySnippet: r.snippet, allowHttp };
    }
    return { status: 0, finalUrl: url, startUrl, error: `Too many redirects (more than ${maxRedirects})`, allowHttp };
  } catch (e) {
    const code = codeOf(e);
    return { status: 0, finalUrl: url, startUrl, errorCode: code, allowHttp, error: `${e.name === 'TimeoutError' ? 'Timeout' : (e.message || e)}${code ? ` (${code})` : ''}` };
  }
}

// ---------- URL collection ----------

// Drop the #fragment, keep the query. Returns '' for anything that is not an absolute URL.
export function normalizeUrl(raw) {
  try { const u = new URL(String(raw).trim()); u.hash = ''; return u.href; } catch { return ''; }
}

// Map of normalised url -> [{programId, role}] (role: signup | source), deduplicated.
export function collectUrls(programs, { role = 'all', ids } = {}) {
  const map = new Map();
  const add = (raw, programId, r) => {
    if (role !== 'all' && role !== r) return;
    const url = normalizeUrl(raw);
    if (!url) return;
    if (!map.has(url)) map.set(url, []);
    const uses = map.get(url);
    if (!uses.some((x) => x.programId === programId && x.role === r)) uses.push({ programId, role: r });
  };
  for (const p of programs) {
    if (ids && !ids.includes(p.id)) continue;
    add(p.signupUrl, p.id, 'signup');
    for (const s of p.sourceUrls || []) add(s, p.id, 'source');
  }
  return map;
}

function titleOf(snippet) {
  const m = (snippet || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 100) : '';
}

// Check every URL of the map. Hosts are interleaved so the global concurrency is useful
// while each host still sees one request at a time. Returns results in input order.
export async function runChecks(urlMap, {
  concurrency = 5, gapMs = 1000, timeoutMs = 20000, maxRedirects = 8, retryDelayMs = 1500, allowHttp = false, onProgress,
} = {}) {
  const entries = [...urlMap.entries()];
  const byHost = new Map();
  entries.forEach((e, i) => {
    const k = hostKey(e[0]);
    if (!byHost.has(k)) byHost.set(k, []);
    byHost.get(k).push(i);
  });
  const order = [];
  for (let round = 0; order.length < entries.length; round++) {
    for (const list of byHost.values()) if (round < list.length) order.push(list[round]);
  }
  const gate = new HostGate(gapMs);
  const results = new Array(entries.length);
  let next = 0; let done = 0;
  const worker = async () => {
    while (next < order.length) {
      const i = order[next++];
      const [url, uses] = entries[i];
      const r = await checkUrl(url, { gate, timeoutMs, maxRedirects, retryDelayMs, allowHttp });
      const { cls, note } = classifyDetailed(r);
      const t = titleOf(r.bodySnippet);
      results[i] = {
        url, class: cls, status: r.status || 0, finalUrl: r.finalUrl || url,
        detail: [note, t && (cls === 'NOT-FOUND' || cls === 'SUSPECT') && !note.includes(t) ? `Title "${t}"` : ''].filter(Boolean).join('; '),
        uses,
      };
      done++;
      if (onProgress) onProgress(done, entries.length, results[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, entries.length)) }, worker));
  return results;
}

// ---------- report ----------

export const CLASSES = ['OK', 'NOT-FOUND', 'OFF-DOMAIN', 'DEAD', 'SUSPECT', 'BLOCKED'];
export const ATTENTION = ['NOT-FOUND', 'DEAD', 'OFF-DOMAIN'];
const emptyCounts = () => Object.fromEntries(CLASSES.map((c) => [c, 0]));

export function summarize(results) {
  const byClass = emptyCounts();
  const byRole = { signup: { total: 0, ...emptyCounts() }, source: { total: 0, ...emptyCounts() } };
  for (const r of results) {
    byClass[r.class]++;
    for (const role of new Set(r.uses.map((u) => u.role))) { byRole[role].total++; byRole[role][r.class]++; }
  }
  return { total: results.length, byClass, byRole };
}

export function needsAttention(results) {
  return results.some((r) => ATTENTION.includes(r.class));
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const usesText = (uses) => uses.map((u) => `${u.programId} (${u.role})`).join(', ');
const roleLine = (name, c) => `${name} ${c.total}: ${c.OK} OK, ${c.BLOCKED} blocked, ${c.SUSPECT} suspect, ${c['NOT-FOUND'] + c.DEAD + c['OFF-DOMAIN']} broken`;

export function buildReport(results, date, opts = {}) {
  const sum = summarize(results);
  const rank = (c) => CLASSES.indexOf(c);
  const sorted = [...results].sort((a, b) => a.url.localeCompare(b.url));
  const pick = (f) => sorted.filter((r) => f(r.class)).sort((a, b) => rank(a.class) - rank(b.class));
  const lines = [];
  const scope = [opts.role && opts.role !== 'all' ? `role ${opts.role}` : '', opts.ids ? `ids ${opts.ids.join(', ')}` : ''].filter(Boolean).join('; ');
  lines.push('# Link check: every URL the app shows (signupUrl and sourceUrls)', '');
  lines.push(`Checked ${date} by scripts/check-links.mjs${scope ? ` (${scope})` : ''}. Honest User-Agent, one request at a time per host, one retry only for network errors and 5xx.`, '');
  lines.push(`**Summary: ${sum.total} unique URLs. ` + CLASSES.map((c) => `${c} ${sum.byClass[c]}`).join(', ') + '.**', '');
  lines.push(`**Signup links: ${roleLine('signup URLs', sum.byRole.signup)}.**`);
  lines.push(`Source links: ${roleLine('source URLs', sum.byRole.source)}.`, '');
  const table = (rows) => {
    lines.push('| class | HTTP | URL | final URL | used by | detail |', '|---|---|---|---|---|---|');
    for (const r of rows) {
      lines.push(`| ${r.class} | ${r.status || '-'} | ${cell(r.url)} | ${r.finalUrl !== r.url ? cell(r.finalUrl) : ''} | ${cell(usesText(r.uses))} | ${cell(r.detail)} |`);
    }
    lines.push('');
  };
  lines.push('## Needs attention (NOT-FOUND, DEAD, OFF-DOMAIN)', '');
  const bad = pick((c) => ATTENTION.includes(c));
  if (bad.length) table(bad); else lines.push('None.', '');
  lines.push('## SUSPECT (answers 200 but looks gone; a person should look, does not fail the run)', '');
  const sus = pick((c) => c === 'SUSPECT');
  if (sus.length) table(sus); else lines.push('None.', '');
  lines.push('## BLOCKED (could not be checked automatically; open by hand)', '');
  const blk = pick((c) => c === 'BLOCKED');
  if (blk.length) table(blk); else lines.push('None.', '');
  lines.push('## OK', '');
  const ok = pick((c) => c === 'OK');
  if (!ok.length) lines.push('None.');
  for (const r of ok) lines.push(`- ${r.status} ${r.url}${r.finalUrl !== r.url ? ` -> ${r.finalUrl}` : ''} (${usesText(r.uses)})`);
  return lines.join('\n') + '\n';
}

export function buildJson(results, date) {
  const rank = (c) => CLASSES.indexOf(c);
  const sorted = [...results].sort((a, b) => a.url.localeCompare(b.url));
  const order = (c) => (ATTENTION.includes(c) ? 0 : c === 'SUSPECT' ? 1 : c === 'BLOCKED' ? 2 : 3);
  sorted.sort((a, b) => order(a.class) - order(b.class) || rank(a.class) - rank(b.class));
  return { checkedOn: date, summary: summarize(results), results: sorted.map(({ url, class: c, status, finalUrl, detail, uses }) => ({ url, class: c, status, finalUrl, detail, uses })) };
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const o = { role: 'all' };
  const need = (i, name) => { if (i >= argv.length) throw new Error(`${name} needs a value`); return argv[i]; };
  const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = need(++i, a);
    else if (a === '--json') o.json = need(++i, a);
    else if (a === '--role') o.role = need(++i, a);
    else if (a === '--ids' || a === '--only') o.ids = list(need(++i, a));
    else if (a === '--data') o.data = need(++i, a);
    else if (a === '--delay' || a === '--gap') o.gapMs = Number(need(++i, a));
    else if (a === '--concurrency') o.concurrency = Number(need(++i, a));
    else if (a === '--timeout') o.timeoutMs = Number(need(++i, a));
    else if (a === '--retry-delay') o.retryDelayMs = Number(need(++i, a));
    else if (a === '--allow-http') o.allowHttp = true; // tests against a local server only
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!['signup', 'source', 'all'].includes(o.role)) throw new Error('--role must be signup, source or all');
  if (o.ids && !o.ids.length) o.ids = undefined;
  return o;
}

// Returns the exit code. Writes the report to --out or stdout.
export async function main(argv, { quiet = false } = {}) {
  const opts = parseArgs(argv);
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const programs = JSON.parse(readFileSync(opts.data || join(root, 'data', 'programs.json'), 'utf8'));
  if (opts.ids) {
    const known = new Set(programs.map((p) => p.id));
    const unknown = opts.ids.filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`Unknown program id(s): ${unknown.join(', ')}`);
  }
  const urls = collectUrls(programs, { role: opts.role, ids: opts.ids });
  if (!urls.size) throw new Error('No URLs to check with these options');
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const results = await runChecks(urls, {
    concurrency: num(opts.concurrency, 5), gapMs: num(opts.gapMs, 1000), timeoutMs: num(opts.timeoutMs, 20000),
    retryDelayMs: num(opts.retryDelayMs, 1500), allowHttp: !!opts.allowHttp,
    onProgress: quiet ? undefined : (n, total, r) => console.error(`[${n}/${total}] ${r.class.padEnd(10)} ${r.url}`),
  });
  const date = new Date().toISOString().slice(0, 10);
  const report = buildReport(results, date, { role: opts.role, ids: opts.ids });
  if (opts.out) writeFileSync(opts.out, report); else process.stdout.write(report);
  if (opts.json) writeFileSync(opts.json, JSON.stringify(buildJson(results, date), null, 2) + '\n');
  return needsAttention(results) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    console.error(`Checker failed: ${(e && e.message) || e}`);
    process.exit(2);
  });
}
