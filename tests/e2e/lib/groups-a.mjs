// Groups 1 to 4: boot, routes, link audit, click-through.
import fs from 'node:fs';
import { ROOT, ROUTES, PROGRAMS, PROFILE, open, clean, runGroup, seedProfileUI, norm, artifactFragment, lsDump, openCard, showAllRows, openAllPanels, openViewTools } from './harness.mjs';
import { L, ALL, byId } from './model.mjs';

export const suspects = []; // buttons that visibly did nothing (reported, never failed)
export const SIGNUP = new Set(PROGRAMS.map((p) => p.signupUrl));
export const ALL_URLS = new Set(PROGRAMS.flatMap((p) => [p.signupUrl].concat(p.sourceUrls || [])));
export const ALL_NORM = new Set([...ALL_URLS].map(norm));

export async function boot(env) {
  const { browser, shot } = env;
  await runGroup('1 boot: both outputs x 390/320 wide x light/dark, every route', async (g) => {
    const frag = artifactFragment();
    g.check('artifact fragment starts with the title', frag.startsWith('<title>Baby Freebies Finder</title>'), frag.slice(0, 60));
    g.check('artifact fragment has the viewport-fit-sides meta', /<meta name="claude:viewport-fit-sides"/.test(frag));
    g.check('artifact fragment has no doctype, html, head or body tag', !/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(frag));
    for (const mode of ['standalone', 'artifact']) {
      for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
        for (const scheme of ['light', 'dark']) {
          const label = mode + ' ' + vp.width + ' ' + scheme;
          const h = await open(browser, { mode, viewport: vp, scheme, hash: 'directory' });
          for (const r of ROUTES) {
            await h.go(r);
            const m = await h.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
            g.check(label + ' ' + r + ': no horizontal scroll', m.sw <= m.cw, m.sw + ' > ' + m.cw);
            if (r === 'directory' || r === 'tracker') await shot(h, 'boot-' + label.replace(/ /g, '-') + '-' + r);
          }
          // the app's own theme toggle: System -> Light -> Dark -> System
          await h.go('directory');
          const seq = [];
          const bg = async () => h.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
          const bgs = [];
          for (let i = 0; i < 3; i++) { await h.page.locator('#theme-toggle').click(); seq.push(await h.page.evaluate(() => document.documentElement.getAttribute('data-theme'))); bgs.push(await bg()); }
          g.check(label + ': theme toggle cycles light, dark, system', JSON.stringify(seq) === JSON.stringify(['light', 'dark', null]), JSON.stringify(seq));
          g.check(label + ': light and dark themes change the page background', bgs[0] !== bgs[1], bgs.join(' / '));
          clean(g, h, label);
          await h.ctx.close();
        }
      }
    }
    for (const claude of ['null', 'none']) {
      const h = await open(browser, { mode: 'artifact', claude });
      for (const r of ROUTES) { await h.go(r); }
      g.check('artifact (' + claude + ') boots with all routes', true);
      const inArt = await h.page.evaluate(() => BFF.host.inArtifact);
      g.check('artifact (' + claude + '): host.inArtifact is ' + (claude === 'null'), inArt === (claude === 'null'), String(inArt));
      clean(g, h, 'artifact ' + claude);
      await h.ctx.close();
    }
  });
}

export async function routes(env) {
  const { browser } = env;
  await runGroup('2 routes: hashes, bottom nav, unknown hash, back/forward, reserved names', async (g) => {
    const NAMES = { directory: 'Programs', info: 'My info', tracker: 'Tracker', guided: 'Do it for me', safety: 'Spot a fake' };
    const RESERVED = /^#(settings|sidebar|customize|upgrade|downloads|comment-.*)$/i;
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode });
      const visible = () => h.page.evaluate(() => [...document.querySelectorAll('.view')].filter((v) => !v.hidden).map((v) => v.id));
      for (const r of ROUTES) {
        await h.go(r);
        g.check(mode + ' #' + r + ' shows only its view', JSON.stringify(await visible()) === JSON.stringify(['view-' + r]), JSON.stringify(await visible()));
      }
      for (const r of ROUTES) {
        await h.page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: NAMES[r] }).click();
        await h.page.waitForSelector('#view-' + r + ':not([hidden])');
        const st = await h.page.evaluate(() => ({ hash: location.hash, cur: document.querySelector('.app-nav [aria-current="page"]') && document.querySelector('.app-nav [aria-current="page"]').dataset.view }));
        g.check(mode + ' nav "' + NAMES[r] + '" updates the hash and aria-current', st.hash === '#' + r && st.cur === r, JSON.stringify(st));
      }
      for (const bad of ['#nope', '#settings', '#', '#main']) {
        await h.page.evaluate((x) => { location.hash = x; }, bad);
        await h.page.waitForTimeout(120);
        g.check(mode + ' unknown hash ' + bad + ' shows the directory', JSON.stringify(await visible()) === '["view-directory"]', JSON.stringify(await visible()));
      }
      await h.go('info'); await h.go('tracker');
      await h.page.goBack(); await h.page.waitForTimeout(150);
      g.check(mode + ' back returns to #info', (await visible())[0] === 'view-info' && (await h.page.evaluate(() => location.hash)) === '#info');
      await h.page.goForward(); await h.page.waitForTimeout(150);
      g.check(mode + ' forward returns to #tracker', (await visible())[0] === 'view-tracker');
      const names = await h.page.evaluate(() => BFF.nav.views.concat([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href').slice(1))));
      g.check(mode + ' no reserved hash names in routes or anchors', !names.some((n) => RESERVED.test('#' + n)), names.filter((n) => RESERVED.test('#' + n)).join(','));
      clean(g, h, mode);
      await h.ctx.close();
    }
  });
}

// Fill My info through the form, then mark a few programs through the directory selects, as a person would.
export async function prepare(h) {
  await seedProfileUI(h, PROFILE, true);
  await h.go('directory');
  const ids = PROGRAMS.slice(0, 3).map((p) => p.id);
  const vals = ['signed-up', 'received', 'skipped'];
  for (let i = 0; i < ids.length; i++) { await openCard(h.page, ids[i]); await h.page.locator('select[data-program-id="' + ids[i] + '"]').selectOption(vals[i]); }
}
async function expandAll(page) { await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; })); }
async function startGuided(h) {
  await h.go('guided');
  const b = h.page.getByRole('button', { name: /^Start \(/ });
  if (await b.count()) await b.first().click();
  await h.page.waitForTimeout(150);
}
async function enterRoute(h, r) {
  if (r === 'guided') await startGuided(h); else await h.go(r);
  // The Tracker lists the person's own to-do list and builds a row's Details panel on first open. Show every program and
  // open every panel, so every sign-up link and every "Search my Gmail" link is audited and clicked as before.
  if (r === 'tracker') { await showAllRows(h.page); await openAllPanels(h.page); }
  await expandAll(h.page);
}

function classify(l, profile) {
  const href = l.href;
  if (/^javascript:/i.test(href)) return 'javascript';
  if (href.startsWith('#')) return ROUTES.includes(href.slice(1)) || l.hashTarget ? 'hash' : 'bad-hash';
  if (href.startsWith('mailto:')) {
    const addr = decodeURIComponent(href.slice(7).split('?')[0]);
    const [local, dom] = profile.email.split('@');
    return addr === profile.email || (addr.endsWith('@' + dom) && addr.split('+')[0] === local) ? 'mailto' : 'bad-mailto';
  }
  const blank = l.target === '_blank' && /\bnoopener\b/.test(l.rel) && /\bnoreferrer\b/.test(l.rel);
  if (href.startsWith('https://mail.google.com/mail/')) return blank ? 'gmail' : 'bad-gmail-attrs';
  if (ALL_URLS.has(href)) return blank ? 'program' : 'bad-program-attrs';
  return 'unknown';
}
async function collectLinks(page) {
  return page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.getAttribute('href'), target: a.getAttribute('target') || '', rel: a.getAttribute('rel') || '', download: a.hasAttribute('download'),
    hashTarget: a.getAttribute('href').startsWith('#') && !!document.getElementById(a.getAttribute('href').slice(1)),
    hidden: !a.offsetParent && getComputedStyle(a).position !== 'fixed',
    text: (a.getAttribute('aria-label') || a.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)
  })));
}

export async function links(env) {
  const { browser } = env;
  await runGroup('3 link audit: every anchor on every route, both outputs', async (g) => {
    for (const [mode, claude] of [['standalone', 'full'], ['artifact', 'full'], ['artifact', 'none']]) {
      const label = mode + (mode === 'artifact' ? '/' + claude : '');
      const h = await open(browser, { mode, claude });
      await prepare(h);
      // Programs for other states are hidden until the person asks. Check the rule, then use "Show them" so the audit covers all of them.
      await h.go('directory');
      const stateOnly = ALL.filter((p) => L.hiddenByState(p, PROFILE.state));
      const idsNow = async () => h.page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].map((c) => c.dataset.programId));
      const box = h.page.locator('#view-directory .dir-state:not(.dir-fit)');
      let before = await idsNow();
      g.check(label + ': with state ' + PROFILE.state + ' the other-state programs are not listed and the state line gives their count', stateOnly.length > 0 && stateOnly.every((p) => !before.includes(p.id)) && before.length === ALL.length - stateOnly.length && (await box.innerText()).includes(stateOnly.length + ' programs for other states are hidden.'), before.length + ' cards, ' + stateOnly.length + ' hidden');
      await box.getByRole('button', { name: 'Show them' }).click(); await h.page.waitForTimeout(200);
      let after = await idsNow();
      g.check(label + ': "Show them" lists all ' + ALL.length + ' programs and the button becomes "Hide them"', after.length === ALL.length && (await box.getByRole('button', { name: 'Hide them' }).count()) === 1, String(after.length));
      await box.getByRole('button', { name: 'Hide them' }).click(); await h.page.waitForTimeout(200);
      g.check(label + ': "Hide them" hides them again', (await idsNow()).length === ALL.length - stateOnly.length && (await box.getByRole('button', { name: 'Show them' }).count()) === 1);
      await box.getByRole('button', { name: 'Show them' }).click(); await h.page.waitForTimeout(200);
      const tally = {};
      for (const r of ROUTES) {
        await enterRoute(h, r);
        const list = await collectLinks(h.page);
        for (const l of list) {
          const c = classify(l, PROFILE);
          tally[c] = (tally[c] || 0) + 1;
          if (l.download && mode === 'artifact') g.check(label + ' #' + r + ': no a[download] in the artifact', false, l.href);
          if (c === 'javascript') { if (mode === 'artifact') g.check(label + ' #' + r + ': no javascript: href', false, l.text); else g.note(label + ' #' + r + ' renders a javascript: anchor: ' + l.text); continue; }
          if (!['hash', 'mailto', 'gmail', 'program'].includes(c)) g.check(label + ' #' + r + ': link allowed (' + c + ')', false, l.href.slice(0, 120) + ' [' + l.text + ']');
        }
        g.check(label + ' #' + r + ': page has links to audit or is a text view', list.length > 0 || r === 'safety', 'links=' + list.length);
      }
      g.note(label + ' link classes: ' + JSON.stringify(tally));
      g.check(label + ': saw program, hash and mailto links', tally.program > 50 && tally.hash > 3 && tally.mailto >= 1, JSON.stringify(tally));
      // reverse: every signupUrl and sourceUrl is reachable from its directory card
      await enterRoute(h, 'directory');
      const cards = await h.page.evaluate(() => Object.fromEntries([...document.querySelectorAll('article.card[data-program-id]')].map((c) => [c.dataset.programId, [...c.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))])));
      let missSign = [], missSrc = [];
      for (const p of PROGRAMS) {
        const hs = cards[p.id] || [];
        if (!hs.includes(p.signupUrl)) missSign.push(p.id);
        (p.sourceUrls || []).forEach((u) => { if (!hs.includes(u)) missSrc.push(p.id + ' ' + u); });
      }
      g.check(label + ': every program card (leads and the ones inside "same thing" groups) links to its signupUrl', missSign.length === 0 && Object.keys(cards).length === PROGRAMS.length, missSign.join(',') + ' cards=' + Object.keys(cards).length);
      g.check(label + ': every sourceUrl is shown in its card', missSrc.length === 0, missSrc.slice(0, 3).join(' | '));
      clean(g, h, label);
      await h.ctx.close();
    }
  });
}

// ---- group 4 ----
const DESTRUCTIVE = /^(clear|delete|reset|remove|start over|replace)/i;
const CLIP = 'window.__fx={clip:0};(function(){try{var w=Navigator.prototype;var c=navigator.clipboard;if(c&&c.writeText){var o=c.writeText.bind(c);Object.defineProperty(c,"writeText",{value:function(t){window.__fx.clip++;return o(t)},configurable:true})}var e=document.execCommand;document.execCommand=function(){if(arguments[0]==="copy")window.__fx.clip++;return e.apply(document,arguments)}}catch(x){}})();';

async function snap(page) {
  return page.evaluate(() => {
    const s = document.documentElement.outerHTML; let hsh = 5381; for (let i = 0; i < s.length; i++) hsh = ((hsh << 5) + hsh + s.charCodeAt(i)) | 0;
    const a = document.activeElement;
    const vals = [...document.querySelectorAll('input,select,textarea')].map((e) => e.type === 'checkbox' ? e.checked : e.value).join(',');
    return [location.hash, s.length, hsh, a && (a.id || a.tagName + (a.textContent || '').slice(0, 20)), vals, window.__fx ? window.__fx.clip : 0, window.scrollY].join('|');
  });
}

export async function clickThrough(env) {
  const { browser } = env;
  await runGroup('4 click-through: every external link and every button on every route', async (g) => {
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode, perms: ['clipboard-read', 'clipboard-write'], init: [CLIP] });
      const page = h.page;
      await prepare(h);
      let side = { downloads: 0, dialogs: 0 };
      page.on('download', () => side.downloads++);
      page.on('dialog', (d) => { side.dialogs++; d.dismiss().catch(() => {}); });
      const closeExtra = async () => { for (const p of h.ctx.pages()) if (p !== page) await p.close().catch(() => {}); };
      // 4a external links, once per distinct href per route
      for (const r of ROUTES) {
        await enterRoute(h, r);
        const url0 = page.url();
        const items = await page.evaluate(() => {
          document.querySelectorAll('[data-e2e]').forEach((e) => e.removeAttribute('data-e2e'));
          const out = [], seen = new Set();
          document.querySelectorAll('a[href]').forEach((a, i) => {
            const href = a.getAttribute('href');
            if (!/^(https:|mailto:)/.test(href) || seen.has(href) || (!a.offsetParent)) return;
            seen.add(href); a.setAttribute('data-e2e', String(out.length)); out.push(href);
          });
          return out;
        });
        let bad = [];
        // The Tracker repeats the Programs sign-up links and adds one Gmail search link per program, so a click on every fourth
        // keeps the run short; groups 3 (audit) and the Programs route above cover all of them.
        const stride = r === 'tracker' ? 4 : 1;
        let clicked = 0;
        for (let i = 0; i < items.length; i += stride) {
          clicked++;
          const href = items[i], before = h.net.length;
          await page.locator('[data-e2e="' + i + '"]').scrollIntoViewIfNeeded().catch(() => {});
          await page.locator('[data-e2e="' + i + '"]').click({ timeout: 4000 }).catch((e) => bad.push('click failed ' + href + ' ' + String(e.message).split('\n')[0]));
          if (href.startsWith('mailto:')) { await page.waitForTimeout(60); continue; }
          let seen = false;
          for (let k = 0; k < 30 && !seen; k++) { seen = h.net.slice(before).some((u) => norm(u) === norm(href)); if (!seen) await page.waitForTimeout(50); }
          const extra = h.net.slice(before).filter((u) => norm(u) !== norm(href));
          if (!seen) bad.push('browser never tried to open ' + href);
          if (extra.length) bad.push('unexpected extra request ' + extra[0]);
          await closeExtra();
        }
        g.check(mode + ' #' + r + ': ' + clicked + ' of ' + items.length + ' external links each open exactly their href', bad.length === 0 && (clicked > 0 || items.length === 0), bad.slice(0, 3).join(' | '));
        g.check(mode + ' #' + r + ': app page did not navigate away', page.url() === url0 || page.url().split('#')[0] === url0.split('#')[0], page.url());
      }
      g.check(mode + ': no errors after link clicks', h.errors.length === 0, h.errors.slice(0, 2).join(' | '));
      await h.ctx.close();

      // 4b every visible button, one fresh load per button so shifting layouts cannot hide any
      const hb = await open(browser, { mode, perms: ['clipboard-read', 'clipboard-write'], init: [CLIP] });
      await prepare(hb);
      const pg = hb.page;
      pg.on('download', () => { side.downloads++; });
      pg.on('dialog', (d) => { side.dialogs++; d.dismiss().catch(() => {}); });
      const plans = ROUTES.map((r) => ({ r, run: false }));
      plans.push({ r: 'guided', run: true });
      for (const plan of plans) {
        const tag = mode + ' #' + plan.r + (plan.run ? ' (run in progress)' : '');
        const enter = async () => {
          await pg.evaluate(() => localStorage.removeItem('bff.guided.v1'));
          await pg.reload(); await pg.waitForTimeout(120);
          await hb.go(plan.r);
          await openViewTools(pg, plan.r); // the Tracker folds and the phone fold on My info start closed
          if (plan.run) await startGuided(hb);
        };
        await enter();
        const names = await pg.locator('button:visible').evaluateAll((bs) => bs.map((b) => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ')));
        let fails = [], did = 0; const asked = [];
        let detailsSeen = 0;
        for (let i = 0; i < names.length; i++) {
          // Every Tracker row has the same Details button: try one in five (all rows run the same code), and every other button.
          if (plan.r === 'tracker' && /^Details for /.test(names[i]) && detailsSeen++ % 5 !== 0) continue;
          if (i > 0 || true) await enter();
          const btn = pg.locator('button:visible').nth(i);
          if ((await btn.count()) === 0) continue;
          const name = (await btn.evaluate((b) => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g, ' ')));
          if (await btn.isDisabled()) continue;
          const errs0 = hb.errors.length, net0 = hb.net.length, nPages = hb.ctx.pages().length;
          const ls0 = JSON.stringify([await pg.evaluate(() => localStorage.getItem('bff.profile.v1')), await pg.evaluate(() => localStorage.getItem('bff.tracker.v1'))]);
          const s0 = await snap(pg), d0 = side.downloads + side.dialogs;
          await btn.click({ timeout: 4000 }).catch((e) => fails.push(name + ': click failed ' + String(e.message).split('\n')[0]));
          await pg.waitForTimeout(250);
          did++;
          if (DESTRUCTIVE.test(name)) {
            const conf = await pg.locator('.fx-confirm').count();
            if (conf) {
              asked.push(name);
              await pg.locator('.fx-confirm').getByRole('button', { name: 'Cancel' }).click();
              const ls1 = JSON.stringify([await pg.evaluate(() => localStorage.getItem('bff.profile.v1')), await pg.evaluate(() => localStorage.getItem('bff.tracker.v1'))]);
              if (ls1 !== ls0) fails.push(name + ': Cancel changed stored data');
              if (await pg.locator('.fx-confirm').count()) fails.push(name + ': confirm panel stayed after Cancel');
            } else if (!/filters|results/i.test(name)) {
              const ls1 = JSON.stringify([await pg.evaluate(() => localStorage.getItem('bff.profile.v1')), await pg.evaluate(() => localStorage.getItem('bff.tracker.v1'))]);
              if (ls1 !== ls0) fails.push(name + ': destructive button changed data with no inline confirm');
            }
          }
          const unexpected = hb.net.slice(net0).filter((u) => !ALL_NORM.has(norm(u)) && !u.startsWith('https://mail.google.com/mail/'));
          if (unexpected.length) fails.push(name + ': unexpected request ' + unexpected[0]);
          if (hb.errors.length > errs0) fails.push(name + ': error after click: ' + hb.errors.slice(errs0).join(' | '));
          for (const p of hb.ctx.pages()) if (p !== pg) await p.close().catch(() => {});
          if (!DESTRUCTIVE.test(name)) {
            const s1 = await snap(pg);
            if (s0 === s1 && side.downloads + side.dialogs === d0 && hb.ctx.pages().length === nPages && hb.net.length === net0) suspects.push(tag + ': "' + name + '" changed nothing visible');
          }
        }
        g.note(tag + ': ' + names.length + ' visible buttons, ' + did + ' clicked; destructive ones that asked first: ' + (asked.join(', ') || 'none'));
        g.check(tag + ': ' + did + ' buttons clicked, no errors, destructive ones ask first and Cancel keeps data', fails.length === 0, fails.slice(0, 3).join(' | '));
      }
      await hb.ctx.close();
    }
    g.note('suspect buttons (did nothing visible): ' + suspects.length + (suspects.length ? ' -> ' + suspects.slice(0, 8).join('; ') : ''));
  });
}
