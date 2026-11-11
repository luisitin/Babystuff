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
// Thrown when a page's whole localStorage is empty after a reload or a navigation although it held values a moment before, and no
// script in the page removed or cleared anything (see guardedReload). runGroup runs the group once more when this happens.
export class BrowserStoreLoss extends Error {
  constructor(message) { super(message); this.name = 'BrowserStoreLoss'; }
}
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
    // Forget everything this group counted so far (used when the group is run again from the start).
    abandon() { stats.checks -= n; stats.failed -= fails.length; stats.groups--; n = 0; fails.length = 0; },
    end() {
      console.log((fails.length ? 'FAIL ' : 'ok   ') + name + ' (' + n + ' checks' + (fails.length ? ', ' + fails.length + ' failed' : '') + ')');
      fails.forEach((f) => console.log('       x ' + f));
    }
  };
  return g;
}
// Run a group. If the browser empties a page's localStorage (BrowserStoreLoss) the group is run once more from the start and the
// first attempt's checks are not counted. A second BrowserStoreLoss is a failed check, so a loss that repeats is never hidden.
export async function runGroup(name, fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const g = group(name);
    try { await fn(g); } catch (e) {
      if (e instanceof BrowserStoreLoss) {
        if (attempt === 1) {
          g.note('"' + name + '": ' + e.message + ' No script in the page removed or cleared it. Running this group once more from the start; the first attempt is not counted.');
          g.abandon();
          continue;
        }
        g.check('the browser kept localStorage (it was emptied again on the second try)', false, e.message);
      } else g.check('group ran to the end', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e);
    }
    g.end();
    return;
  }
}

// ---- opening the app ----
const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
// BFF_E2E_BUILD_DIR points the run at a folder holding index.html and artifact.html (used for the mutation spot-checks
// in MUTATIONS.md, so the repo's own build output is never touched). Unset, the repo root is used.
export const OUT = process.env.BFF_E2E_BUILD_DIR ? path.resolve(process.env.BFF_E2E_BUILD_DIR) : ROOT;
export const standaloneUrl = pathToFileURL(path.join(OUT, 'index.html')).href;
export function artifactFragment() { return fs.readFileSync(path.join(OUT, 'artifact.html'), 'utf8'); }
export const artifactPath = path.join(TMP, 'artifact-wrapped.html');
export function writeArtifactPage() { fs.writeFileSync(artifactPath, SKELETON_HEAD + artifactFragment() + '</body></html>'); }
export const artifactUrl = pathToFileURL(artifactPath).href;
export const seedPagePath = path.join(TMP, 'seed.html');
const seedPageUrl = pathToFileURL(seedPagePath).href;

// Records every Storage setItem, removeItem and clear call made by a script in the page (call and key only, never a value) in
// window.__bffRec. It does not read or write storage itself. guardedReload uses it to tell the page removing data from the browser
// emptying the store.
const RECORDER = '(function(){var r=window.__bffRec=[];["setItem","removeItem","clear"].forEach(function(n){var f=Storage.prototype[n];Storage.prototype[n]=function(k){if(r.length<5000)r.push(n==="clear"?"clear":n+" "+k);return f.apply(this,arguments)}})})();';
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
    if (/^(file|data|blob|about):/.test(u)) return route.continue();
    net.push(u);
    return route.abort();
  });
  const h = { ctx, net, errors: [], mode, claude: o.claude || 'full' };
  const init = [RECORDER];
  if (mode === 'artifact') {
    init.push(VIEWER_STUBS);
    if (h.claude !== 'none') init.push(mockInit({ nullAll: h.claude === 'null', gm: o.gm, dl: o.dl }));
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
  // Saved values to start with (o.profile, o.seed). They are written from a blank page on the same file: origin before the app page
  // opens, never from an init script: an init script that touches localStorage made the browser empty the whole store on about one
  // load in five (see FINDINGS.md, Phase I).
  const seed = Object.assign({}, o.seed || {});
  if (o.profile && !Object.prototype.hasOwnProperty.call(seed, 'bff.profile.v1')) seed['bff.profile.v1'] = JSON.stringify(o.profile);
  h.seed = seed;
  if (Object.keys(seed).length) {
    fs.writeFileSync(seedPagePath, '<!doctype html><meta charset=utf8><title>seed</title>');
    await page.goto(seedPageUrl);
    await page.evaluate((m) => { for (const k of Object.keys(m)) localStorage.setItem(k, m[k]); }, seed);
  }
  h.url = (mode === 'artifact' ? artifactUrl : standaloneUrl) + '#' + (o.hash || 'directory');
  if (o.goto !== false) {
    await page.goto(h.url);
    await page.waitForSelector('#view-directory, .view:not([hidden])', { state: 'attached' });
    await page.waitForTimeout(o.settle === undefined ? 250 : o.settle);
    // The seeded values must still be there: if the app has not removed them and they are gone, the browser emptied the store.
    if (Object.keys(seed).length) {
      const gone = await page.evaluate((m) => Object.keys(m).filter((k) => localStorage.getItem(k) === null), seed);
      if (gone.length) await storeLossVerdict(page, Object.keys(seed), [], 'the saved values written before the page opened were missing after it opened (' + Object.keys(seed).length + ' keys written, ' + gone.length + ' missing).');
    }
  }
  // Phase H: the Programs page opens on the Free stuff tab with the filters folded. Older checks look at every program, so by
  // default we do what a person would: tap All and unfold "Sort and filter". Pass {all: false} to test the real default view.
  h.showAll = async () => {
    await page.waitForSelector('#view-directory .kind-tab[data-kind="all"]', { state: 'attached', timeout: 4000 }).catch(() => {});
    const t = page.locator('#view-directory .kind-tab[data-kind="all"]');
    if (await t.count()) { if ((await t.getAttribute('aria-pressed')) !== 'true') await t.click(); }
    await page.evaluate(() => { const d = document.querySelector('#view-directory details.dir-filters'); if (d) d.open = true; });
    await page.waitForTimeout(120);
  };
  h.go = async (route) => {
    await page.evaluate((r) => { location.hash = '#' + r; }, route);
    await page.waitForSelector('#view-' + route + ':not([hidden])');
    await page.waitForTimeout(80);
    if (route === 'directory' && o.all !== false) await h.showAll();
  };
  if (o.goto !== false && o.all !== false && /^#?directory/.test(o.hash || 'directory')) await h.showAll();
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
// Phase H: status selects live inside the collapsed card details. Open a card the way a person does (its Details button).
export async function openCard(page, id) {
  const t = page.locator('article.card[data-program-id="' + id + '"] button.card-toggle').first();
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
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

// ---- Phase I helpers: Tracker folds, tabs and row panels, saved data, scroll ----
// A { key: json } map for open({ seed }): stores an object under bff.<name>.v1 before the app page first opens.
export function seedStore(name, obj) {
  return { ['bff.' + name + '.v1']: JSON.stringify(obj) };
}
// The tracker entries for a { programId: status } map.
export function trackerSeed(map) {
  const o = {};
  Object.keys(map).forEach((id) => { o[id] = { status: map[id], note: '', updatedAt: new Date().toISOString() }; });
  return o;
}
// Open one of the three Tracker tool folds (email, gmail, backup) the way a person does: tap its summary.
export async function openFold(page, key) {
  const d = page.locator('#view-tracker details.fx-fold[data-fold="' + key + '"]');
  if (!(await d.evaluate((e) => e.open))) await d.locator('summary').first().click();
}
export async function foldOpen(page, key) {
  return page.locator('#view-tracker details.fx-fold[data-fold="' + key + '"]').evaluate((e) => e.open);
}
// Tap a Tracker tab (todo, signed-up, received, skipped, all) and wait until it is the pressed one.
export async function trkTab(page, filter) {
  const b = page.locator('#view-tracker button.fx-tab[data-filter="' + filter + '"]');
  await b.click();
  await page.waitForFunction((f) => document.querySelector('#view-tracker button.fx-tab[data-filter="' + f + '"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#trk-list').getAttribute('data-tab') === f, filter);
}
// Open a Tracker row's Details panel. Closed folds around the row (the optional section, "more ways") are opened first.
export async function openRowDetails(page, id) {
  await page.evaluate((i) => {
    const li = document.querySelector('#trk-list li.fx-trk-row[data-id="' + i + '"]');
    for (let n = li && li.parentElement; n && n.id !== 'trk-list'; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
  }, id);
  const b = page.locator('#trk-d-' + id);
  if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
  await page.waitForSelector('#trk-p-' + id + ':not([hidden])');
}
// Wait until the page has stopped scrolling (two equal readings 150 ms apart, up to 3 s). The My info hand-off scrolls smoothly.
export async function settleScroll(page, max = 3000) {
  let last = await page.evaluate(() => window.scrollY);
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    await sleep(150);
    const now = await page.evaluate(() => window.scrollY);
    if (now === last) return true;
    last = now;
  }
  return false;
}
// Open all three Tracker tool folds (email and calendar, Gmail, backup) so their controls can be used.
export async function openTools(page) {
  for (const k of ['email', 'gmail', 'backup']) await openFold(page, k);
}
// Make sure a Tracker row can be reached: unfold the "more ways" fold and the optional section around it.
export async function revealRow(page, id) {
  await page.evaluate((i) => {
    const li = document.querySelector('#trk-list li.fx-trk-row[data-id="' + i + '"]');
    for (let n = li && li.parentElement; n && n.id !== 'trk-list'; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
  }, id);
}
// Put the Tracker on the All tab and switch on "Show all N programs", so every program has a row.
export async function showAllRows(page) {
  await trkTab(page, 'all');
  const b = page.locator('#view-tracker .fx-trk-left button');
  if ((await b.isVisible()) && (await b.getAttribute('aria-pressed')) === 'false') await b.click();
}
export const BACKUP_MSG = '#view-tracker details.fx-fold[data-fold="backup"] .fx-msg';
// My info keeps "Fill forms on your phone" in a closed fold (remembered in prefs.infoFillOpen). Open it by tapping its summary.
export async function openPhoneFold(page) {
  const d = page.locator('#info-fill-fold');
  if (!(await d.evaluate((e) => e.open))) await d.locator('summary').first().click();
}
// Open the tool folds of a view where there are any (Tracker folds, the phone fold on My info).
export async function openViewTools(page, view) {
  if (view === 'tracker') await openTools(page);
  if (view === 'info') await openPhoneFold(page);
}
// Unfold the "more ways" fold or the optional section around a Do it for me pick box, so it can be ticked.
export async function revealPick(page, id) {
  await page.evaluate((i) => {
    const cb = document.getElementById('gd-pick-' + i);
    for (let n = cb && cb.parentElement; n && n.id !== 'view-guided'; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
  }, id);
}
// Open every Tracker row's Details panel (unfolding the "more ways" folds and the optional section around them).
export async function openAllPanels(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#trk-list details').forEach((d) => { d.open = true; });
    document.querySelectorAll('#trk-list button.fx-trk-more').forEach((b) => { if (b.getAttribute('aria-expanded') !== 'true') b.click(); });
  });
}
// Decide what to do when a page's localStorage is empty although `keys` held values a moment ago. `calls` are the Storage calls the
// old document made after the values were read (guardedReload) and the new document's record is read here. If any script in the page
// removed or cleared one of those keys, that is the app's doing and the group fails at once with a plain Error. Otherwise it is
// reported as BrowserStoreLoss, and runGroup repeats the group once.
export async function storeLossVerdict(page, keys, oldCalls, what) {
  const calls = oldCalls.concat(await page.evaluate(() => window.__bffRec || []));
  const removed = calls.filter((c) => c === 'clear' || (/^removeItem /.test(c) && keys.includes(c.slice(11))) );
  if (removed.length) throw new Error('the page itself removed saved data: ' + removed.slice(0, 4).join(', ') + ' (' + what + ')');
  throw new BrowserStoreLoss(what);
}
// Reload and check that what was in localStorage a moment ago is still there. If the store is completely empty afterwards, no script
// in either document removed it (storeLossVerdict), the browser emptied it. Any other difference (some keys changed or
// missing while others remain) is returned, not thrown: the check after the call reports it.
export async function guardedReload(page) {
  const read = () => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== 'bff.__probe') o[k] = localStorage.getItem(k); } return o; });
  const before = await read();
  const mark = await page.evaluate(() => (window.__bffRec || []).length);
  const oldCalls = async () => page.evaluate((m) => (window.__bffRec || []).slice(m), mark).catch(() => []);
  const tail = await oldCalls();
  await page.reload();
  await page.waitForLoadState('load');
  await sleep(150);
  const after = await read();
  const keys = Object.keys(before);
  if (keys.length && Object.keys(after).length === 0) {
    await storeLossVerdict(page, keys, tail, 'localStorage held ' + keys.length + ' key' + (keys.length === 1 ? '' : 's') + ' (' + keys.join(', ') + ') before a reload and was empty after it.');
  }
}
// Reload after a write the person made: a short pause so the page's own saving is done, then guardedReload.
export async function reloadAfterWrite(page) {
  await sleep(300);
  await guardedReload(page);
}
