// Shared helpers for the end-to-end run: reporter, Playwright loader, page opener, zip/contrast helpers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mockInit } from './mock.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const PROGRAMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'programs.json'), 'utf8'));
export const ROUTES = ['directory', 'info', 'tracker', 'guided', 'safety'];
export const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bff-e2e-'));

export async function loadPlaywright() {
  try { const m = await import('playwright'); if (m.chromium || (m.default && m.default.chromium)) return m.chromium || m.default.chromium; } catch (e) { /* try require */ }
  try { return createRequire(import.meta.url)('playwright').chromium; } catch (e) { return null; }
}

// ---- reporter: one line per group, a summary at the end ----
export const stats = { checks: 0, failed: 0, groups: 0 };
export function group(name) {
  const fails = [];
  let n = 0;
  stats.groups++;
  const g = {
    name,
    check(label, cond, detail) {
      n++; stats.checks++;
      if (!cond) { stats.failed++; fails.push(label + (detail !== undefined && detail !== '' ? ' -> ' + String(detail).slice(0, 400) : '')); }
      return !!cond;
    },
    note(text) { console.log('     note: ' + text); },
    end() {
      console.log((fails.length ? 'FAIL ' : 'ok   ') + name + ' (' + n + ' checks' + (fails.length ? ', ' + fails.length + ' failed' : '') + ')');
      fails.forEach((f) => console.log('       x ' + f));
    }
  };
  return g;
}
export async function runGroup(name, fn) {
  const g = group(name);
  try { await fn(g); } catch (e) { g.check('group ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e); }
  g.end();
}

// ---- opening the app ----
const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
export const standaloneUrl = pathToFileURL(path.join(ROOT, 'index.html')).href;
export function artifactFragment() { return fs.readFileSync(path.join(ROOT, 'artifact.html'), 'utf8'); }
export const artifactPath = path.join(TMP, 'artifact-wrapped.html');
export function writeArtifactPage() { fs.writeFileSync(artifactPath, SKELETON_HEAD + artifactFragment() + '</body></html>'); }
export const artifactUrl = pathToFileURL(artifactPath).href;

const VIEWER_STUBS = 'window.open=function(){return null};window.alert=function(){};window.confirm=function(){return false};window.prompt=function(){return null};window.print=function(){};';

/* open(browser, {mode: 'standalone'|'artifact', claude: 'full'|'null'|'none', viewport, scheme, perms, fixtures, profile, init, hash, gm, dl})
   Returns {ctx, page, net, errors, url}. Every request except file: and data: goes to `net` and is aborted,
   unless it is a fixture served by us. Console errors and page errors go to `errors`. */
export async function open(browser, o = {}) {
  const mode = o.mode || 'standalone';
  const ctx = await browser.newContext({
    viewport: o.viewport || { width: 390, height: 844 },
    colorScheme: o.scheme || 'light',
    deviceScaleFactor: 1,
    acceptDownloads: true,
    permissions: o.perms || [],
    serviceWorkers: 'block'
  });
  const net = [];
  const fixtures = o.fixtures || {};
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (Object.prototype.hasOwnProperty.call(fixtures, u)) {
      const f = fixtures[u];
      return route.fulfill({ status: 200, contentType: f.contentType || 'text/html; charset=utf-8', body: f.body });
    }
    if (!/^(file|data|blob|about):/.test(u)) net.push(u);
    return route.abort();
  });
  const h = { ctx, net, errors: [], mode, claude: o.claude || 'full' };
  const init = [];
  if (mode === 'artifact') {
    init.push(VIEWER_STUBS);
    if (h.claude !== 'none') init.push(mockInit({ nullAll: h.claude === 'null', gm: o.gm, dl: o.dl }));
  }
  if (o.profile) {
    init.push('try{if(!localStorage.getItem("bff.profile.v1"))localStorage.setItem("bff.profile.v1",' + JSON.stringify(JSON.stringify(o.profile)) + ')}catch(e){}');
  }
  (o.init || []).forEach((s) => init.push(s));
  for (const s of init) await ctx.addInitScript(s);
  const page = await ctx.newPage();
  h.page = page;
  const watch = (p) => {
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) h.errors.push('console: ' + m.text()); });
    p.on('pageerror', (e) => h.errors.push('pageerror: ' + e.message));
  };
  watch(page);
  ctx.on('page', watch);
  if (mode === 'artifact') writeArtifactPage();
  h.url = (mode === 'artifact' ? artifactUrl : standaloneUrl) + '#' + (o.hash || 'directory');
  if (o.goto !== false) {
    await page.goto(h.url);
    await page.waitForSelector('#view-directory, .view:not([hidden])', { state: 'attached' });
    await page.waitForTimeout(o.settle === undefined ? 250 : o.settle);
  }
  h.go = async (route) => {
    await page.evaluate((r) => { location.hash = '#' + r; }, route);
    await page.waitForSelector('#view-' + route + ':not([hidden])');
    await page.waitForTimeout(80);
  };
  return h;
}

// Standard end-of-scenario assertions: no console/page errors and no network requests of the app's own.
export function clean(g, h, label, opts = {}) {
  g.check(label + ': no console or page errors', h.errors.length === 0, h.errors.slice(0, 3).join(' | '));
  if (!opts.allowNet) g.check(label + ': no network requests', h.net.length === 0, h.net.slice(0, 3).join(' | '));
}

// ---- synthetic profile ----
export const PROFILE = {
  firstName: 'Sam', lastName: 'Sample', email: 'e2e.sample.user@gmail.com', phone: '5555550123',
  address1: '123 Example Street', address2: 'Apt 4B', city: 'Springfield', state: 'TX', zip: '75001', dueDate: '2027-03-15'
};
const LABELS = { firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone (optional)', address1: 'Address line 1', address2: 'Address line 2 (optional)', city: 'City', zip: 'ZIP code', dueDate: 'Due date or baby’s birthday' };
// Fill My info through the real form, the way a person would.
export async function seedProfileUI(h, profile = PROFILE, plus = false) {
  const page = h.page;
  await h.go('info');
  for (const k of Object.keys(LABELS)) await page.getByLabel(LABELS[k], { exact: true }).fill(profile[k] || '');
  await page.getByLabel('State', { exact: true }).selectOption(profile.state);
  if (plus) await page.getByLabel('Give each program its own plus address').check();
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector('#view-info .fx-saved').textContent), null, { timeout: 4000 });
}
export async function setStatuses(page, map) {
  await page.evaluate((m) => { Object.keys(m).forEach((id) => BFF.tracker.setStatus(id, m[id])); }, map);
}

export async function lsDump(page) {
  return page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
}

// ---- stored zip reader (method 0 only) ----
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function parseZip(bytes) {
  const b = Buffer.from(bytes), out = [], problems = [];
  let p = 0;
  while (p + 30 <= b.length && b.readUInt32LE(p) === 0x04034b50) {
    const flags = b.readUInt16LE(p + 6), method = b.readUInt16LE(p + 8), crc = b.readUInt32LE(p + 14);
    const csize = b.readUInt32LE(p + 18), usize = b.readUInt32LE(p + 22), nlen = b.readUInt16LE(p + 26), xlen = b.readUInt16LE(p + 28);
    const name = b.slice(p + 30, p + 30 + nlen).toString('utf8');
    const data = b.slice(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
    if (method !== 0) problems.push('entry ' + name + ' is not stored');
    if (csize !== usize) problems.push('sizes differ for ' + name);
    if (crc32(data) !== crc) problems.push('bad CRC for ' + name);
    if (!(flags & 0x800)) problems.push('UTF-8 flag missing for ' + name);
    out.push({ name, data });
    p += 30 + nlen + xlen + csize;
  }
  const eocd = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) problems.push('no end-of-central-directory record');
  else if (b.readUInt16LE(eocd + 10) !== out.length) problems.push('central directory count differs');
  return { entries: out, problems };
}

// ---- contrast ----
function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
export function lum([r, g, b]) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
export function contrast(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

export const norm = (u) => { try { const x = new URL(u); x.hash = ''; return x.href; } catch (e) { return u; } };
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
