// Checks on the built index.html: determinism, no external resources, CSP, no network APIs, links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const programs = JSON.parse(readFileSync(join(root, 'data', 'programs.json'), 'utf8'));

// The inlined data block; everything else in the page is code or markup.
const DATA_BLOCK = /<script id="programs-data"[^>]*>[\s\S]*?<\/script>/;
const htmlWithoutData = html.replace(DATA_BLOCK, '');

// Inline <script> blocks without a src (the JS we ship).
function inlineScripts(text) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(text))) {
    if (!/\bsrc\s*=/i.test(m[1])) out.push(m[2]);
  }
  return out.join('\n');
}

test('index.html matches a fresh build from a clean copy', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'bff-build-'));
  try {
    for (const dir of ['scripts', 'src', 'data']) {
      cpSync(join(root, dir), join(tmp, dir), { recursive: true });
    }
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: tmp, stdio: 'pipe' });
    const fresh = readFileSync(join(tmp, 'index.html'));
    const committed = readFileSync(join(root, 'index.html'));
    assert.ok(fresh.equals(committed), 'index.html differs from a fresh build; run `node scripts/build.mjs`');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('index.html has no external resources', () => {
  // A <link href> is allowed only when it is an inline data: URI (the favicon).
  const externalLinks = [...htmlWithoutData.matchAll(/<link\b[^>]*\bhref\s*=\s*["']?([^"'\s>]*)/gi)]
    .map((m) => m[1])
    .filter((href) => !/^data:/i.test(href));
  assert.deepEqual(externalLinks, [], 'found <link href> that is not a data: URI');
  const checks = [
    [/<script\b[^>]*\bsrc\s*=/i, '<script src>'],
    [/@import\b/i, '@import'],
    [/url\(\s*['"]?https?:/i, 'url() pointing at http(s)'],
    [/<iframe\b/i, '<iframe'],
    [/<object\b/i, '<object'],
    [/<embed\b/i, '<embed'],
    [/<img\b[^>]*\bsrc\s*=\s*['"]?https?:/i, '<img> with http(s) src'],
  ];
  for (const [re, label] of checks) {
    assert.doesNotMatch(htmlWithoutData, re, `found ${label}`);
  }
});

test('CSP meta blocks network requests and referrer is no-referrer', () => {
  const csp = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i);
  assert.ok(csp, 'missing Content-Security-Policy meta');
  const content = (csp[0].match(/content\s*=\s*"([^"]*)"/i) || csp[0].match(/content\s*=\s*'([^']*)'/i) || [])[1] || '';
  assert.match(content, /default-src 'none'/);
  assert.match(content, /connect-src 'none'/);

  const ref = html.match(/<meta\b[^>]*name\s*=\s*["']referrer["'][^>]*>/i);
  assert.ok(ref, 'missing referrer meta');
  assert.match(ref[0], /content\s*=\s*["']no-referrer["']/);
});

test('inline JS uses no network APIs', () => {
  const js = inlineScripts(html);
  assert.ok(js.length > 0, 'expected inline script content');
  const banned = [
    [/\bfetch\s*\(/, 'fetch('],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bsendBeacon\b/, 'sendBeacon'],
    [/\bnew\s+WebSocket\b/, 'new WebSocket'],
    [/\bEventSource\b/, 'EventSource'],
    [/\bimportScripts\b/, 'importScripts'],
    [/\bnavigator\s*\.\s*serviceWorker\b/, 'navigator.serviceWorker'],
  ];
  for (const [re, label] of banned) {
    assert.doesNotMatch(js, re, `inline JS uses ${label}`);
  }
});

test('every http(s) URL outside the data block is the SVG namespace or a program link', () => {
  const allowed = new Set(['http://www.w3.org/2000/svg']);
  for (const p of programs) {
    allowed.add(p.signupUrl);
    for (const s of p.sourceUrls) allowed.add(s);
  }
  const found = htmlWithoutData.match(/https?:\/\/[^\s"'<>()`]+/g) || [];
  const unexpected = [...new Set(found.map((u) => u.replace(/[.,;:]+$/, '')))]
    .filter((u) => !allowed.has(u) && !allowed.has(u.replace(/&amp;/g, '&')));
  assert.deepEqual(unexpected, [], 'unexpected http(s) URLs in index.html');
});
