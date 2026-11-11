// Groups 8 to 10: fill script on fixture forms, persistence and privacy, accessibility smoke.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, ROUTES, PROGRAMS, PROFILE, open, clean, runGroup, contrast, lsDump, trkTab, openRowDetails, openPhoneFold, reloadAfterWrite, hiddenBoxState, toggleReason, cardIds, cardTicks } from './harness.mjs';
import { FORM_HTML } from './fixtures.mjs';
import { prepare } from './groups-a.mjs';
import { L, E, ALL, byId, byDomain, domainOf } from './model.mjs';

const KEYS = ['firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'zip', 'dueDate'];
// Domains picked from the data. A "single brand" domain has exactly one listed program and it passes
// BFF.email.inEmailFeatures, so the plus address is the only sensible one. "Multi" domains have two or more
// listed programs with different tags, so the runtime rule falls back to the plain address. A government
// domain only has programs that are outside the email features.
const SHARED = /^(?:github\.io|google\.com|facebook\.com|[a-z]{2}\.us|co\.uk)$/;
const single = Object.entries(byDomain).find(([d, l]) => l.length === 1 && E.inEmailFeatures(l[0]) && !SHARED.test(d));
const SINGLE = { domain: single[0], program: single[1][0] };
const govProg = byId['tenncare-diaper-benefit'];
const GOV = { domain: domainOf(govProg), program: govProg };
const FIX = {
  enfamil: 'https://www.enfamil.com/e2e-form',
  similac: 'https://www.similac.com/e2e-form',
  target: 'https://registry.target.com/e2e-form',
  single: 'https://www.' + SINGLE.domain + '/e2e-form',
  singleSub: 'https://shop.' + SINGLE.domain + '/e2e-form',
  gov: 'https://www.' + GOV.domain + '/e2e-form',
  evil: 'https://evil.example/e2e-form',
  plain: 'http://www.enfamil.com/e2e-form'
};
const fixtures = Object.fromEntries(Object.values(FIX).map((u) => [u, { body: FORM_HTML }]));
const UNTOUCHED = { pw: '', hid: '', dis: '', pre: 'keep-me', pre2: 'Typed Town', mk: false, cc: '', q: '' };
const readForm = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('input,select')].map((e) => [e.id, e.type === 'checkbox' ? e.checked : e.value])));

async function makeScripts(browser, plus) {
  const h = await open(browser, { perms: ['clipboard-read', 'clipboard-write'], profile: Object.assign({}, PROFILE, { usePlusTags: plus }), hash: 'info' });
  await h.go('info');
  await openPhoneFold(h.page);
  await h.page.getByRole('button', { name: 'Copy fill script' }).click(); await h.page.waitForTimeout(250);
  const script = await h.page.evaluate(() => navigator.clipboard.readText());
  await h.page.getByRole('button', { name: 'Copy bookmark code' }).click(); await h.page.waitForTimeout(250);
  const mark = await h.page.evaluate(() => navigator.clipboard.readText());
  const tags = await h.page.evaluate(() => BFF.plusTags.map());
  clean({ check: () => {} }, h, 'x');
  await h.ctx.close();
  return { script, mark, tags };
}
const plusOf = (tags, id) => { const [l, d] = PROFILE.email.split('@'); return l + '+' + tags[id] + '@' + d; };

export async function fill(env) {
  const { browser } = env;
  await runGroup('8 fill script: generated through the UI, run on fixture forms of official domains', async (g) => {
    const off = await makeScripts(browser, false), on = await makeScripts(browser, true);
    const { script } = off;
    g.check('script copied from My info is non-empty', script.length > 1000, String(script.length));
    let parses = true; try { new Function(script); } catch (e) { parses = false; }
    g.check('script parses with new Function', parses);
    g.check('no raw U+2028 or U+2029 in the script or bookmarklet', !script.includes(String.fromCharCode(0x2028)) && !script.includes(String.fromCharCode(0x2029)) && !off.mark.includes(String.fromCharCode(0x2028)));
    g.check('bookmarklet is a javascript: URL ending in void 0', off.mark.startsWith('javascript:') && decodeURIComponent(off.mark.slice(11)).trim().endsWith('void 0;'));
    g.check('script has no network, storage, eval or submit calls', !/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b|document\.cookie|\beval\s*\(|\.submit\s*\(|\.click\s*\(|requestSubmit/.test(script), (script.match(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB)\b|document\.cookie|\beval\s*\(|\.submit\s*\(|\.click\s*\(|requestSubmit/) || [''])[0]);
    const m = /^\(function\(\)\{var D=(\{[\s\S]*?\});var FM=\(/.exec(script);
    let D = null; try { D = JSON.parse(m[1]); } catch (e) { /* reported below */ }
    g.check('embedded data parses as JSON', !!D);
    if (D) {
      g.check('embedded profile holds only the ten contract keys', Object.keys(D.profile).every((k) => KEYS.includes(k)), Object.keys(D.profile).join(','));
      g.check('embedded profile values equal what was typed', KEYS.every((k) => D.profile[k] === PROFILE[k]), JSON.stringify(D.profile));
      g.check('embedded program list holds only domain, id, name, email', D.programs.length > 20 && D.programs.every((p) => Object.keys(p).sort().join() === 'domain,email,id,name'));
      g.note('personal data embedded in the script: ' + Object.keys(D.profile).join(', ') + ' (plus plus-addresses per program when plus tags are on)');
      const Don = JSON.parse(/^\(function\(\)\{var D=(\{[\s\S]*?\});var FM=\(/.exec(on.script)[1]);
      g.check('plus-address mode embeds a tagged email per program', Don.programs.some((p) => p.email && p.email.includes('+')) && D.programs.every((p) => p.email === ''));
      const embBad = Don.programs.filter((p) => { const q = byId[p.id]; return E.inEmailFeatures(q) ? p.email !== plusOf(on.tags, p.id) : p.email !== ''; }).map((p) => p.id);
      g.check('plus-address mode tags exactly the programs that pass inEmailFeatures, and no government or no-email program', embBad.length === 0 && Don.programs.some((p) => p.email === '') && Don.programs.some((p) => p.id === GOV.program.id && p.email === ''), embBad.slice(0, 4).join(','));
      g.check('picked domains are as intended: single brand domain has one listed program, similac and target have two or more, the government domain has no email-feature program', byDomain[SINGLE.domain].length === 1 && byDomain['similac.com'].length >= 2 && byDomain['target.com'].length >= 2 && byDomain[GOV.domain].every((q) => !E.inEmailFeatures(q)));
    }
    const h = await open(browser, { goto: false, fixtures });
    const page = h.page;
    let navs = 0, newReq = 0;
    page.on('framenavigated', () => navs++);
    const prep = async (url) => {
      await page.goto(url); navs = 0;
      await page.evaluate(() => {
        window.completionCalls = []; window.completion = (r) => window.completionCalls.push(r); window.__ev = {};
        ['input', 'change'].forEach((n) => document.addEventListener(n, (e) => { (window.__ev[e.target.id] = window.__ev[e.target.id] || []).push(n); }, true));
      });
    };
    const side = async () => page.evaluate(() => ({ clicks: window.__clicks, submits: window.__submits, banners: document.querySelectorAll('#bff-fill-banner').length, comp: window.completionCalls.length }));
    const EXPECT = (email) => ({ fn: 'Sam', ln: 'Sample', full: 'Sam Sample', em: email, em2: email, a1: '123 Example Street', a2: 'Apt 4B', city: 'Springfield', sc: 'TX', sn: 'Texas', zip: '75001', due: '2027-03-15', dm: '03', dd: '15', dy: '2027' });
    const plainEmail = PROFILE.email;
    const cases = [
      { name: 'enfamil (two programs, same domain)', url: FIX.enfamil, script: off.script, email: plainEmail },
      { name: 'similac', url: FIX.similac, script: off.script, email: plainEmail },
      { name: 'target subdomain registry.target.com', url: FIX.target, script: off.script, email: plainEmail },
      // one listed program on the domain, in the email features: its own plus address
      { name: 'single-program brand domain ' + SINGLE.domain + ' with plus addresses', url: FIX.single, script: on.script, email: plusOf(on.tags, SINGLE.program.id) },
      { name: 'subdomain of ' + SINGLE.domain + ' with plus addresses', url: FIX.singleSub, script: on.script, email: plusOf(on.tags, SINGLE.program.id) },
      // several listed programs on the domain with different tags: the plain address, even with plus addresses on
      { name: 'similac.com (two programs) with plus addresses gets the plain address', url: FIX.similac, script: on.script, email: plainEmail },
      { name: 'enfamil.com (two programs) with plus addresses gets the plain address', url: FIX.enfamil, script: on.script, email: plainEmail },
      { name: 'target subdomain registry.target.com (two programs) with plus addresses gets the plain address', url: FIX.target, script: on.script, email: plainEmail },
      // a government sign-up page is outside the email features: plain address
      { name: 'government program domain ' + GOV.domain + ' with plus addresses gets the plain address', url: FIX.gov, script: on.script, email: plainEmail },
      { name: 'same single-program brand domain ' + SINGLE.domain + ' with plus addresses off gets the plain address', url: FIX.single, script: off.script, email: plainEmail }
    ];
    for (const c of cases) {
      await prep(c.url);
      const res = await page.evaluate((s) => (0, eval)(s), c.script);
      const vals = await readForm(page), ev = await page.evaluate(() => window.__ev), s1 = await side();
      const exp = EXPECT(c.email);
      const wrong = Object.keys(exp).filter((k) => k === 'ph' ? false : vals[k] !== exp[k]).map((k) => k + '=' + JSON.stringify(vals[k]));
      g.check(c.name + ': right values in right fields', wrong.length === 0, wrong.join(', '));
      g.check(c.name + ': phone filled with the digits', String(vals.ph).replace(/\D/g, '') === '5555550123', vals.ph);
      const filledIds = Object.keys(exp).concat('ph');
      g.check(c.name + ': input and change events fired on every filled field', filledIds.every((id) => ev[id] && ev[id].includes('input') && ev[id].includes('change')), filledIds.filter((id) => !(ev[id] && ev[id].includes('change'))).join(','));
      g.check(c.name + ': password, hidden, disabled, pre-filled, checkbox, search and card fields untouched', Object.keys(UNTOUCHED).every((k) => vals[k] === UNTOUCHED[k]) && Object.keys(UNTOUCHED).every((k) => !ev[k]), JSON.stringify(Object.keys(UNTOUCHED).filter((k) => vals[k] !== UNTOUCHED[k] || ev[k])));
      g.check(c.name + ': no click on the submit button, no submit, no navigation', s1.clicks === 0 && s1.submits === 0 && navs === 0, JSON.stringify(s1) + ' navs=' + navs);
      g.check(c.name + ': completion called once with {ok, filled, skipped, domain, message}', s1.comp === 1 && res && res.ok === true && res.filled >= 14 && typeof res.skipped === 'number' && typeof res.domain === 'string' && typeof res.message === 'string', JSON.stringify(res));
      const comp = await page.evaluate(() => window.completionCalls[0]);
      g.check(c.name + ': completion argument has exactly the five keys', comp && Object.keys(comp).sort().join() === 'domain,filled,message,ok,skipped', JSON.stringify(comp));
      g.check(c.name + ': one banner saying how many fields were filled', s1.banners === 1 && /^Filled \d+ fields?/.test(await page.locator('#bff-fill-banner').innerText()));
      // twice
      const res2 = await page.evaluate((s) => (0, eval)(s), c.script);
      const vals2 = await readForm(page), s2 = await side();
      g.check(c.name + ': a second run changes nothing and stacks no banner', JSON.stringify(vals2) === JSON.stringify(vals) && s2.banners === 1 && res2.filled === 0 && s2.comp === 2, JSON.stringify({ res2, s2 }));
      await page.locator('#bff-fill-banner').getByRole('button', { name: 'Close' }).click();
      g.check(c.name + ': Close removes the banner', (await side()).banners === 0);
      g.check(c.name + ': no network request from the fill', h.net.length === 0, h.net.join(','));
    }
    // bookmarklet form
    await prep(FIX.similac);
    await page.evaluate((u) => { location.href = u; }, off.mark);
    await page.waitForFunction(() => window.completionCalls && window.completionCalls.length > 0, null, { timeout: 4000 }).catch(() => {});
    const bv = await readForm(page), bs = await side();
    g.check('javascript: bookmarklet fills the form the same way and does not navigate', bv.fn === 'Sam' && bv.zip === '75001' && bv.em === plainEmail && navs === 0 && bs.clicks === 0 && bs.submits === 0 && bs.comp === 1, JSON.stringify({ bs, navs, fn: bv.fn }));
    // wrong sites
    for (const [name, url, why] of [['evil.example', FIX.evil, /not one of the official|domain/i], ['plain http on a program domain', FIX.plain, /https|secure/i]]) {
      await prep(url);
      const res = await page.evaluate((s) => (0, eval)(s), off.script);
      const vals = await readForm(page), s1 = await side();
      const emptyAll = Object.keys(vals).filter((k) => vals[k] !== '' && vals[k] !== false && !['pre', 'pre2'].includes(k));
      g.check(name + ': fills nothing', emptyAll.length === 0 && res.filled === 0 && res.ok === false, emptyAll.join(','));
      g.check(name + ': says why, once, and the banner closes', why.test(res.message) && s1.banners === 1 && s1.comp === 1 && s1.clicks === 0 && s1.submits === 0, res.message);
    }
    g.check('no unexpected requests in the whole fill run', h.net.length === 0, h.net.join(','));
    g.check('no console or page errors on the fixture pages', h.errors.length === 0, h.errors.slice(0, 2).join(' | '));
    await h.ctx.close();
  });
}

// ---- group 9 ----
export async function persistence(env) {
  const { browser } = env;
  const KNOWN = ['bff.profile.v1', 'bff.tracker.v1', 'bff.prefs.v1', 'bff.guided.v1'];
  await runGroup('9 persistence and privacy: known keys only, no cookies or other storage, reload keeps data, blocked storage degrades', async (g) => {
    const src = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
    g.check('page source never touches cookies, sessionStorage or IndexedDB', !/document\.cookie|sessionStorage|indexedDB/.test(src));
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode });
      const page = h.page;
      await prepare(h);
      await h.go('directory');
      await page.getByLabel('Truly free').check();
      await page.locator('#theme-toggle').click(); await page.locator('#theme-toggle').click(); // light, dark
      await h.go('guided');
      const b = page.getByRole('button', { name: /^Start \(/ }); if (await b.count()) await b.first().click();
      await h.go('tracker');
      await trkTab(page, 'signed-up'); // the first program was marked Signed up by prepare()
      await openRowDetails(page, PROGRAMS[0].id);
      await page.locator('#trk-n-' + PROGRAMS[0].id).fill('kept note'); await page.waitForTimeout(700);
      const ls = await lsDump(page);
      const keys = Object.keys(ls);
      g.check(mode + ': only known bff.* keys exist', keys.every((k) => KNOWN.includes(k)) && keys.includes('bff.profile.v1') && keys.includes('bff.tracker.v1') && keys.includes('bff.prefs.v1'), keys.join(','));
      g.check(mode + ': no cookies', (await h.ctx.cookies()).length === 0 && (await page.evaluate(() => document.cookie)) === '');
      const other = await page.evaluate(async () => ({ ss: sessionStorage.length, idb: indexedDB.databases ? (await indexedDB.databases()).length : 0 }));
      g.check(mode + ': no sessionStorage or IndexedDB use', other.ss === 0 && other.idb === 0, JSON.stringify(other));
      await reloadAfterWrite(page); await page.waitForTimeout(250);
      await h.go('info');
      const f = await page.evaluate(() => ({ fn: document.getElementById('info-firstName').value, em: document.getElementById('info-email').value, plus: document.getElementById('info-plus').checked }));
      g.check(mode + ': reload keeps My info', f.fn === 'Sam' && f.em === PROFILE.email && f.plus === true, JSON.stringify(f));
      // Truly free is still on after the reload, so the directory lists only truly free programs. Look for the
      // statuses where a person would: in the Tracker (every program), and in the directory for a program it still lists.
      await h.go('tracker');
      await trkTab(page, 'signed-up');
      g.check(mode + ': reload keeps tracker statuses (first program is Signed up in the Tracker)', (await page.locator('#trk-done-' + PROGRAMS[0].id).isChecked()) && !(await page.locator('#trk-nfm-' + PROGRAMS[0].id).isChecked()));
      await h.go('directory');
      // The marked programs are hidden on Programs (Done, Not for me). Show those two lines, then read the tick boxes of the cards that Truly free lists.
      const hbs = await hiddenBoxState(page);
      g.check(mode + ': reload keeps statuses: the Programs box counts 2 marked done and 1 marked not for me', hbs.present && /^2 you marked done$/.test((hbs.lines.find((l) => l.reason === 'done') || {}).text) && /^1 you marked not for me$/.test((hbs.lines.find((l) => l.reason === 'notForMe') || {}).text), JSON.stringify(hbs.lines));
      await toggleReason(page, 'done'); await toggleReason(page, 'notForMe');
      const seen = {};
      for (const id of await cardIds(page)) seen[id] = await cardTicks(page, id);
      const want = ['signed-up', 'received', 'skipped'].map((v) => L.tickState(v));
      const marked = PROGRAMS.slice(0, 3).map((p, i) => [p, want[i]]).filter(([p]) => L.isTrulyFree(p));
      g.check(mode + ': reload keeps statuses on the directory cards that Truly free still lists (tick boxes)', marked.length > 0 ? marked.every(([p, t]) => seen[p.id] && seen[p.id].done === t.done && seen[p.id].received === t.received && seen[p.id].notForMe === t.notForMe) : true, JSON.stringify(seen).slice(0, 200));
      g.check(mode + ': a program that is not truly free is not listed while Truly free is on', !Object.keys(seen).includes(PROGRAMS[0].id) || L.isTrulyFree(PROGRAMS[0]));
      g.check(mode + ': reload keeps prefs (theme and filter)', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' && (await page.getByLabel('Truly free').isChecked()));
      await h.go('tracker');
      await trkTab(page, 'signed-up');
      await openRowDetails(page, PROGRAMS[0].id);
      g.check(mode + ': reload keeps notes', (await page.locator('#trk-n-' + PROGRAMS[0].id).inputValue()) === 'kept note');
      clean(g, h, mode + ' session');
      await h.ctx.close();
      // storage blocked, two ways
      const blocks = {
        'setItem/getItem throw': 'Storage.prototype.setItem=function(){throw new DOMException("full","QuotaExceededError")};Storage.prototype.getItem=function(){throw new DOMException("denied","SecurityError")};',
        'localStorage getter throws': 'Object.defineProperty(window,"localStorage",{configurable:true,get:function(){throw new DOMException("denied","SecurityError")}});'
      };
      for (const k of Object.keys(blocks)) {
        const hb = await open(browser, { mode, init: [blocks[k]] });
        for (const r of ROUTES) await hb.go(r);
        const note = await hb.page.locator('#storage-notice').isVisible();
        g.check(mode + ' storage blocked (' + k + '): boots and shows the storage warning', note && /isn't saving|not saving/i.test(await hb.page.locator('#storage-notice').innerText()));
        await hb.go('info');
        await hb.page.getByLabel('First name', { exact: true }).fill('Temp'); await hb.page.waitForTimeout(700);
        g.check(mode + ' storage blocked (' + k + '): editing still works and says it is not saved', /Could not save|only until|not saving/i.test(await hb.page.locator('#view-info .fx-saved').innerText()), await hb.page.locator('#view-info .fx-saved').innerText());
        await hb.go('tracker');
        clean(g, hb, mode + ' blocked ' + k);
        await hb.ctx.close();
      }
    }
  });
}

// ---- group 10 ----
const A11Y = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const text = (e) => (e.innerText || e.textContent || '').trim();
  const nameOf = (e) => { const al = (e.getAttribute('aria-label') || '').trim(); if (al) return al; const lb = e.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\\s+/).map((i) => document.getElementById(i)).filter(Boolean).map(text).join(' ').trim(); if (t) return t; } if (e.labels && e.labels.length) { const t = [...e.labels].map(text).join(' ').trim(); if (t) return t; } const t = text(e); if (t) return t; return (e.getAttribute('title') || '').trim(); };
  const out = { noName: [], noLabel: [], h1: document.querySelectorAll('h1').length };
  document.querySelectorAll('button, a[href], [role=button]').forEach((e) => { if (vis(e) && !nameOf(e)) out.noName.push(e.outerHTML.slice(0, 90)); });
  document.querySelectorAll('input, select, textarea').forEach((e) => { if (['hidden', 'submit', 'button'].includes(e.type)) return; if (!nameOf(e)) out.noLabel.push(e.outerHTML.slice(0, 90)); });
  return out;
})()`;

const CONTRAST = `(() => {
  const parse = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const canvas = matchMedia('(prefers-color-scheme: dark)').matches && getComputedStyle(document.documentElement).colorScheme.indexOf('dark') >= 0 ? [18, 18, 18] : [255, 255, 255];
  const bgOf = (e) => { const chain = []; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.backgroundImage !== 'none') return null; const c = parse(s.backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 1) break; } } let b = canvas; for (let i = chain.length - 1; i >= 0; i--) b = over(chain[i], b).concat(1); return b.slice(0, 3); };
  const res = [];
  const seen = new Set();
  document.querySelectorAll('body *').forEach((e) => {
    if (['SCRIPT', 'STYLE', 'OPTION', 'SVG', 'PATH'].includes(e.tagName)) return;
    const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    if (r.width < 2 || r.height < 2 || s.visibility === 'hidden' || s.display === 'none' || (e.closest && e.closest('[hidden]'))) return;
    if (e.disabled || (e.closest && e.closest('[aria-hidden=true]'))) return;
    if (parseFloat(s.opacity) < 1 || (r.width <= 1 || (s.clip && s.clip.indexOf('rect(0') === 0))) return;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0) || (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.tagName) && e.type !== 'checkbox' && e.type !== 'radio' && e.type !== 'file');
    if (!own) return;
    const fg = parse(s.color); const bg = bgOf(e);
    if (!fg || !bg) return;
    const f = over(fg, bg);
    const key = f.join() + '|' + bg.join() + '|' + s.fontSize;
    if (seen.has(key)) return; seen.add(key);
    res.push({ fg: f, bg, size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400, tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), text: (e.textContent || e.value || '').trim().slice(0, 30) });
  });
  return res;
})()`;

export async function a11y(env) {
  const { browser } = env;
  await runGroup('10 accessibility smoke: names, labels, one h1, focus, 44px targets, contrast in light and dark', async (g) => {
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode });
      const page = h.page;
      await prepare(h);
      for (const r of ROUTES) {
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        if (r === 'guided') { await h.go('guided'); const b = page.getByRole('button', { name: /^Start \(/ }); if (await b.count()) await b.first().click(); await page.waitForTimeout(120); } else await h.go(r);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        const a = await page.evaluate(A11Y);
        g.check(mode + ' #' + r + ': every button and link has an accessible name', a.noName.length === 0, a.noName.slice(0, 2).join(' | '));
        g.check(mode + ' #' + r + ': every form control has a label', a.noLabel.length === 0, a.noLabel.slice(0, 2).join(' | '));
        g.check(mode + ' #' + r + ': exactly one h1', a.h1 === 1, String(a.h1));
      }
      // focus on route change through the nav
      for (const [r, name] of [['info', 'My info'], ['tracker', 'Tracker'], ['safety', 'Spot a fake']]) {
        await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click(); await page.waitForTimeout(150);
        const f = await page.evaluate((r) => { const a = document.activeElement; const v = document.getElementById('view-' + r); return { tag: a.tagName, inView: v.contains(a), text: (a.textContent || '').slice(0, 30) }; }, r);
        g.check(mode + ' route change to #' + r + ' moves focus to the new view heading', f.tag === 'H2' && f.inView, JSON.stringify(f));
      }
      // visible keyboard focus
      await h.go('directory');
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      const bad = [];
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        const st = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { who: e.tagName + (e.id ? '#' + e.id : '') + ' ' + (e.textContent || '').trim().slice(0, 20), outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow !== 'none' }; });
        if (!st) { bad.push('focus lost at tab ' + i); continue; }
        if (!st.outline && !st.shadow) bad.push(st.who);
      }
      g.check(mode + ': first 14 tab stops show a visible focus style', bad.length === 0, bad.join(' | '));
      // touch targets at 390
      const small = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.app-nav a, .btn-primary, .fx-btn--primary, .app-nav button').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width === 0 || getComputedStyle(e).display === 'none') return; if (r.width < 44 || r.height < 44) out.push((e.textContent || '').trim().slice(0, 25) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
        return out;
      });
      g.check(mode + ': nav and primary buttons are at least 44x44 on the directory', small.length === 0, small.slice(0, 4).join(' | '));
      await h.go('tracker');
      const small2 = await page.evaluate(() => { const out = []; document.querySelectorAll('.btn-primary, .fx-btn--primary').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width === 0) return; if (r.width < 44 || r.height < 44) out.push((e.textContent || '').trim().slice(0, 25) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); }); return out; });
      g.check(mode + ': primary buttons on the tracker are at least 44x44', small2.length === 0, small2.slice(0, 4).join(' | '));
      clean(g, h, mode + ' a11y');
      await h.ctx.close();
      // contrast, both schemes
      for (const scheme of ['light', 'dark']) {
        const hc = await open(browser, { mode, scheme });
        await prepare(hc);
        const fails = [];
        let sampled = 0;
        for (const r of ROUTES) {
          if (r === 'guided') { await hc.go('guided'); const b = hc.page.getByRole('button', { name: /^Start \(/ }); if (await b.count()) await b.first().click(); await hc.page.waitForTimeout(120); } else await hc.go(r);
          await hc.page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
          const items = await hc.page.evaluate(CONTRAST);
          sampled += items.length;
          for (const it of items) {
            const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
            const c = contrast(it.fg, it.bg);
            if (c < (large ? 3 : 4.5)) fails.push('#' + r + ' ' + it.tag + ' "' + it.text + '" ' + c.toFixed(2) + ' fg=' + it.fg.map(Math.round) + ' bg=' + it.bg.map(Math.round));
          }
        }
        g.check(mode + ' ' + scheme + ': text contrast >= 4.5:1 (3:1 large) across ' + sampled + ' sampled styles', fails.length === 0 && sampled > 60, fails.slice(0, 3).join(' | '));
        if (fails.length) g.note(mode + ' ' + scheme + ' contrast failures (' + fails.length + '): ' + fails.slice(0, 6).join(' ;; '));
        await hc.ctx.close();
      }
    }
  });
}
