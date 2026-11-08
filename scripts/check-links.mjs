#!/usr/bin/env node
// Link checker for the signupUrl of every program in data/programs.json.
// Node 20+, no dependencies. One request at a time, honest User-Agent, no retries
// with other user agents or headers. BLOCKED results are reported but never fail.
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
  ['fns.usda.gov', 'fna.usda.gov'],
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

const CHALLENGE_RE = new RegExp(
  [
    'just a moment', 'attention required', 'checking your browser',
    'verify you are (a )?human', 'cf-browser-verification', 'cf-challenge',
    'challenge-platform', '_cf_chl', 'captcha', 'access denied',
    'request could not be satisfied', 'px-captcha', 'are you a robot',
  ].join('|'),
  'i',
);
const NOT_FOUND_RE = /page not found|404 not found|not found\s*[|\-–]|^\s*404\b|we can.?t find (that|this) page|page (does not|doesn.?t) exist/i;

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

// Returns { cls, note }.
export function classifyDetailed({ status, finalUrl, startUrl, error, bodySnippet } = {}) {
  const body = bodySnippet || '';
  if (error) return { cls: 'BLOCKED', note: `Network error: ${error}` };
  if (status === 404 || status === 410) return { cls: 'NOT-FOUND', note: `HTTP ${status}` };
  const challenge = CHALLENGE_RE.test(body);
  if (status === 403 || status === 429 || status === 503) {
    return { cls: 'BLOCKED', note: `HTTP ${status}${challenge ? ' (bot challenge)' : ''}` };
  }
  if (challenge) return { cls: 'BLOCKED', note: 'Bot challenge or access-denied page' };
  const title = (body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, body])[1];
  if (NOT_FOUND_RE.test(title)) return { cls: 'NOT-FOUND', note: 'Page title says not found' };
  if (finalUrl && startUrl) {
    const from = hostOf(startUrl);
    const to = hostOf(finalUrl);
    if (to && from && !isExpectedRedirect(from, to)) {
      return { cls: 'OFF-DOMAIN', note: `Redirected from ${registrableDomain(from)} to ${registrableDomain(to)}` };
    }
  }
  if (typeof status === 'number' && status >= 400) return { cls: 'BLOCKED', note: `HTTP ${status}` };
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

export async function checkUrl(startUrl, { maxRedirects = 8, timeoutMs = 20000 } = {}) {
  let url = startUrl;
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location'), url).href;
        try { await res.body?.cancel(); } catch { /* ignore */ }
        url = next;
        continue;
      }
      const snippet = await readSnippet(res);
      return { status: res.status, finalUrl: url, startUrl, bodySnippet: snippet };
    }
    return { status: 0, finalUrl: url, startUrl, error: `Too many redirects (more than ${maxRedirects})` };
  } catch (e) {
    const cause = e && e.cause && (e.cause.code || e.cause.message);
    return { status: 0, finalUrl: url, startUrl, error: `${e.name === 'TimeoutError' ? 'Timeout' : (e.message || e)}${cause ? ` (${cause})` : ''}` };
  }
}

function titleOf(snippet) {
  const m = (snippet || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 100) : '';
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function buildReport(rows, date) {
  const classes = ['OK', 'NOT-FOUND', 'OFF-DOMAIN', 'BLOCKED'];
  const counts = Object.fromEntries(classes.map((c) => [c, rows.filter((r) => r.cls === c).length]));
  const lines = [];
  lines.push('# Link check: signupUrl for every entry in data/programs.json', '');
  lines.push(`Checked ${date} by scripts/check-links.mjs (one URL at a time, honest User-Agent, no retries).`, '');
  lines.push(`**Summary: ${rows.length} entries. ` + classes.map((c) => `${c} ${counts[c]}`).join(', ') + '.**', '');
  lines.push('| id | signupUrl | HTTP | final URL | class | note |', '|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(`| ${cell(r.id)} | ${cell(r.url)} | ${r.status || '-'} | ${cell(r.status ? r.finalUrl : '-')} | ${r.cls} | ${cell(r.note)} |`);
  }
  lines.push('', '## Needs attention', '');
  const bad = rows.filter((r) => r.cls === 'NOT-FOUND' || r.cls === 'OFF-DOMAIN');
  if (!bad.length) lines.push('No NOT-FOUND or OFF-DOMAIN entries.');
  for (const r of bad) lines.push(`- ${r.id} (${r.cls}): ${r.url} -> ${r.finalUrl} ${r.note ? `- ${r.note}` : ''}`.trim());
  const blocked = rows.filter((r) => r.cls === 'BLOCKED');
  if (blocked.length) {
    lines.push('', 'Blocked (not proven broken; recheck from a normal browser):');
    for (const r of blocked) lines.push(`- ${r.id} (${r.note})`);
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--only') o.only = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--delay') o.delay = Number(argv[++i]);
    else { console.error(`Unknown argument: ${a}`); process.exit(2); }
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  let programs = JSON.parse(readFileSync(join(root, 'data', 'programs.json'), 'utf8'));
  if (opts.only) programs = programs.filter((p) => opts.only.includes(p.id));
  const delay = Number.isFinite(opts.delay) ? opts.delay : 1500;
  const rows = [];
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    if (i > 0) await sleep(delay);
    const r = await checkUrl(p.signupUrl);
    const { cls, note } = classifyDetailed(r);
    const t = titleOf(r.bodySnippet);
    const row = {
      id: p.id, url: p.signupUrl, status: r.status, finalUrl: r.finalUrl, cls,
      note: [note, t && cls !== 'BLOCKED' ? `Title "${t}"` : ''].filter(Boolean).join('; '),
    };
    rows.push(row);
    console.error(`[${i + 1}/${programs.length}] ${cls.padEnd(10)} ${p.id}`);
  }
  const date = new Date().toISOString().slice(0, 10);
  const report = buildReport(rows, date);
  if (opts.out) writeFileSync(opts.out, report); else process.stdout.write(report);
  if (opts.json) writeFileSync(opts.json, JSON.stringify({ checkedOn: date, results: rows }, null, 2) + '\n');
  const fail = rows.some((r) => r.cls === 'NOT-FOUND' || r.cls === 'OFF-DOMAIN');
  process.exit(fail ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
