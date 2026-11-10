// Checks on both built outputs (index.html and artifact.html): determinism, no external resources, CSP or fragment shape, no network APIs, links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const programs = JSON.parse(readFileSync(join(root, 'data', 'programs.json'), 'utf8'));

// Source order from ARCHITECTURE.md ("New files, load order and owners").
const JS_ORDER = ['logic', 'store', 'missing', 'email', 'zip', 'host', 'fieldmatch', 'fillscript', 'inbox', 'tracker', 'profile', 'directory', 'guided', 'inboxview', 'phone', 'app'];
const CSS_ORDER = ['base', 'features', 'inbox', 'phone'];

// The inlined data block; everything else in a page is code or markup.
const DATA_BLOCK = /<script id="programs-data"[^>]*>[\s\S]*?<\/script>/;

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
const part = (rel) => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');

const OUTPUTS = {
  'index.html': readFileSync(join(root, 'index.html'), 'utf8'),
  'artifact.html': readFileSync(join(root, 'artifact.html'), 'utf8'),
};

test('both outputs match a fresh build from a clean copy', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'bff-build-'));
  try {
    for (const dir of ['scripts', 'src', 'data']) {
      cpSync(join(root, dir), join(tmp, dir), { recursive: true });
    }
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: tmp, stdio: 'pipe' });
    for (const name of Object.keys(OUTPUTS)) {
      const fresh = readFileSync(join(tmp, name));
      const committed = readFileSync(join(root, name));
      assert.ok(fresh.equals(committed), name + ' differs from a fresh build; run `node scripts/build.mjs`');
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

for (const [name, html] of Object.entries(OUTPUTS)) {
  const withoutData = html.replace(DATA_BLOCK, '');

  test(name + ' has no external resources', () => {
    // A <link href> is allowed only when it is an inline data: URI (the favicon).
    const externalLinks = [...withoutData.matchAll(/<link\b[^>]*\bhref\s*=\s*["']?([^"'\s>]*)/gi)]
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
      assert.doesNotMatch(withoutData, re, `found ${label}`);
    }
  });

  test(name + ' inline JS uses no network APIs', () => {
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

  test(name + ': every http(s) URL outside the data block is a namespace, a Gmail link base, or a program link', () => {
    // Namespaces are identifiers that are never fetched; the Gmail bases open the person's own Gmail.
    const allowed = new Set([
      'http://www.w3.org/2000/svg',
      'http://www.w3.org/2005/Atom',
      'http://schemas.google.com/apps/2006',
    ]);
    const prefixes = ['https://mail.google.com/mail/'];
    for (const p of programs) {
      allowed.add(p.signupUrl);
      for (const s of p.sourceUrls) allowed.add(s);
    }
    const found = withoutData.match(/https?:\/\/[^\s"'<>()`]+/g) || [];
    const unexpected = [...new Set(found.map((u) => u.replace(/[.,;:]+$/, '')))]
      .filter((u) => !allowed.has(u) && !allowed.has(u.replace(/&amp;/g, '&')) && !prefixes.some((p) => u.startsWith(p)));
    assert.deepEqual(unexpected, [], 'unexpected http(s) URLs in ' + name);
  });

  test(name + ': inlined CSS and JS follow the contract order', () => {
    const css = CSS_ORDER.map((f) => part('src/css/' + f + '.css'));
    if (name === 'artifact.html') css.push(part('src/css/artifact.css'));
    const styles = [...html.matchAll(/<style>\n([\s\S]*?)\n<\/style>/g)].map((m) => m[1]);
    assert.equal(styles.length, 1, 'expected exactly one <style>');
    assert.equal(styles[0], css.join('\n'), 'CSS differs from the contract order');
    assert.equal(inlineScripts(withoutData).replace(/^\n|\n$/g, ''), JS_ORDER.map((f) => part('src/js/' + f + '.js')).join('\n'), 'JS differs from the contract order');
    assert.equal((html.match(DATA_BLOCK) || []).length, 1, 'expected one data block');
  });
}

test('index.html is a full document with the CSP meta and a no-referrer policy', () => {
  const html = OUTPUTS['index.html'];
  assert.match(html, /^<!doctype html>/i);
  const csp = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i);
  assert.ok(csp, 'missing Content-Security-Policy meta');
  const content = (csp[0].match(/content\s*=\s*"([^"]*)"/i) || csp[0].match(/content\s*=\s*'([^']*)'/i) || [])[1] || '';
  assert.match(content, /default-src 'none'/);
  assert.match(content, /connect-src 'none'/);

  const ref = html.match(/<meta\b[^>]*name\s*=\s*["']referrer["'][^>]*>/i);
  assert.ok(ref, 'missing referrer meta');
  assert.match(ref[0], /content\s*=\s*["']no-referrer["']/);
});

test('artifact.html is a fragment: title first, viewport-fit-sides meta, no document skeleton or CSP', () => {
  const html = OUTPUTS['artifact.html'];
  assert.ok(html.startsWith('<title>Baby Freebies Finder</title>'), 'must start with the title');
  const idx = html.indexOf('<meta name="claude:viewport-fit-sides" content="cover">');
  assert.ok(idx >= 0 && idx < 1000, 'viewport-fit-sides meta must be in the first 1,000 characters');
  for (const [re, label] of [[/<!doctype/i, 'doctype'], [/<html[\s>]/i, '<html'], [/<head[\s>]/i, '<head'], [/<body[\s>]/i, '<body'], [/http-equiv/i, 'http-equiv'], [/<meta\b[^>]*name\s*=\s*["']viewport["']/i, 'viewport meta']]) {
    assert.doesNotMatch(html, re, 'artifact.html must not contain ' + label);
  }
  assert.equal((html.slice(0, html.indexOf('<script')).match(/<title>/g) || []).length, 1, 'one <title> in the markup');
  assert.equal((html.match(/class="bff-shell"/g) || []).length, 1, 'one outer wrapper');
  assert.match(OUTPUTS['artifact.html'], /\.bff-shell\s*\{[^}]*padding-left:\s*max\(16px, env\(safe-area-inset-left, 0px\)\)[^}]*padding-right:\s*max\(16px, env\(safe-area-inset-right, 0px\)\)/);
  // The wrapper closes before the data block and the script, and contains the app markup.
  const wrapStart = html.indexOf('<div class="bff-shell"');
  const wrapEnd = html.indexOf('</div>\n<script id="programs-data"');
  assert.ok(wrapStart > 0 && wrapEnd > wrapStart, 'wrapper must close right before the data block');
  for (const id of ['view-directory', 'view-info', 'view-tracker', 'view-guided', 'view-safety']) {
    const at = html.indexOf('id="' + id + '"');
    assert.ok(at > wrapStart && at < wrapEnd, id + ' must be inside the wrapper');
  }
});

test('artifact.html carries no theme-fighting inline display styles', () => {
  const markup = OUTPUTS['artifact.html'].replace(DATA_BLOCK, '');
  assert.doesNotMatch(markup.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, ''), /style\s*=\s*["'][^"']*display/i);
});

test('index.html, artifact.html and src/ hold no raw U+FFFD, U+2028 or U+2029', () => {
  const banned = [
    [String.fromCharCode(0xFFFD), 'U+FFFD'],
    [String.fromCharCode(0x2028), 'U+2028'],
    [String.fromCharCode(0x2029), 'U+2029'],
  ];
  const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  const files = ['index.html', 'artifact.html', ...walk('src')];
  const hits = [];
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    for (const [ch, label] of banned) if (text.includes(ch)) hits.push(rel + ' contains raw ' + label);
  }
  assert.deepEqual(hits, []);
});
