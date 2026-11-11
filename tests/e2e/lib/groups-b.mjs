// Groups 5 to 7: downloads and copy, backup round trip, Gmail card.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { TMP, PROGRAMS, PROFILE, open, clean, runGroup, parseZip, lsDump, openTools, openRowDetails, revealRow, showAllRows, openFold, openViewTools, BACKUP_MSG } from './harness.mjs';
import { E, trackerFor } from './model.mjs';
import { prepare } from './groups-a.mjs';
import { ALLOWED_TOOLS } from './mock.mjs';

const P0 = PROGRAMS[0];
const btn = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' ? false : undefined });

async function download(page, click) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), click()]);
  return { name: d.suggestedFilename(), text: fs.readFileSync(await d.path(), 'utf8') };
}
const lastSave = (page) => page.evaluate(() => window.__saves[window.__saves.length - 1]);
const msgOf = (button, sel) => button.locator('xpath=ancestor::*[contains(@class,"' + sel.card + '")][1]').locator(sel.msg).first();
const TRK = { card: 'fx-fold', msg: '.fx-msg' };
const PHONE = { card: 'ph-group', msg: '.ph-status' };
const startsSaved = (t) => /^(Saved|Downloaded)/.test(t.trim());

// What each of the four save buttons does and how its status should read.
const FILES = [
  { key: 'backup', view: 'tracker', button: 'Download backup (JSON)', scope: TRK, name: /^baby-freebies-backup-\d{4}-\d{2}-\d{2}\.json$/, zipped: false },
  { key: 'filters', view: 'tracker', button: 'Download Gmail filters', scope: TRK, name: /^baby-freebies-gmail-filters\.xml$/, zipped: true },
  { key: 'ics', view: 'tracker', button: 'Download reminders (.ics)', scope: TRK, name: /^baby-freebies-reminders\.ics$/, zipped: true },
  { key: 'fill', view: 'info', button: 'Save fill script as a file', scope: PHONE, name: /^baby-freebies-fill\.txt$/, zipped: false }
];
async function contentOk(g, label, key, text, page) {
  if (key === 'backup') { let j = null; try { j = JSON.parse(text); } catch (e) {} g.check(label + ' backup is JSON with a tracker section', !!j && typeof j === 'object' && !!j.tracker); }
  if (key === 'filters') {
    const wf = await page.evaluate((t) => { const d = new DOMParser().parseFromString(t, 'application/xml'); return !d.querySelector('parsererror'); }, text);
    g.check(label + ' filters XML is well-formed and has <feed and <entry>', wf && /<feed/.test(text) && /<entry>/.test(text));
  }
  if (key === 'ics') {
    g.check(label + ' ICS begins BEGIN:VCALENDAR, ends END:VCALENDAR, CRLF only', text.startsWith('BEGIN:VCALENDAR') && /END:VCALENDAR\r?\n?$/.test(text) && /\r\n/.test(text) && !/(^|[^\r])\n/.test(text), JSON.stringify(text.slice(0, 40)));
    g.check(label + ' ICS has a VEVENT', /BEGIN:VEVENT/.test(text));
  }
  if (key === 'fill') { let ok = true; try { new Function(text); } catch (e) { ok = false; } g.check(label + ' fill script parses', ok && text.length > 500); }
}

export async function downloads(env) {
  const { browser } = env;
  await runGroup('5a downloads: standalone real download events, artifact downloads.save, honest statuses, fallbacks', async (g) => {
    // standalone and artifact without a runtime (c): a real download event
    for (const [mode, claude] of [['standalone', 'full'], ['artifact', 'none']]) {
      const h = await open(browser, { mode, claude });
      await prepare(h);
      for (const f of FILES) {
        await h.go(f.view); await openViewTools(h.page, f.view);
        const b = h.page.getByRole('button', { name: f.button });
        const d = await download(h.page, () => b.click()).catch((e) => ({ err: String(e.message).split('\n')[0] }));
        const label = mode + (claude === 'none' ? '(c)' : '') + ' ' + f.key;
        g.check(label + ': triggers a download event', !d.err, d.err);
        if (d.err) continue;
        g.check(label + ': file name', f.name.test(d.name), d.name);
        g.check(label + ': non-empty', d.text.length > 20);
        await contentOk(g, label, f.key, d.text, h.page);
        const status = await msgOf(b, f.scope).innerText();
        g.check(label + ': status says Downloaded or Saved', startsSaved(status), status);
      }
      clean(g, h, mode + ' downloads');
      await h.ctx.close();
    }
    // artifact (a): the mocked downloads capability
    const h = await open(browser, { mode: 'artifact', claude: 'full' });
    await prepare(h);
    for (const f of FILES) {
      await h.go(f.view); await openViewTools(h.page, f.view);
      const b = h.page.getByRole('button', { name: f.button });
      await b.click();
      await h.page.waitForFunction((n) => window.__saves.length >= n, (await h.page.evaluate(() => window.__saves.length)));
      await h.page.waitForTimeout(150);
      const s = await lastSave(h.page);
      const label = 'artifact(a) ' + f.key;
      const ext = (s.filename.match(/\.([a-z0-9]+)$/i) || [])[1];
      g.check(label + ': save() filename has an allowed extension', ['json', 'txt', 'zip', 'md', 'csv', 'html', 'pdf'].includes(ext), s.filename);
      if (f.zipped) {
        const inner = f.name.source.replace(/^\^|\$$/g, '').replace(/\\/g, '');
        g.check(label + ': .xml/.ics is zip-wrapped as <name>.zip', s.filename === inner.replace(/\.(xml|ics)$/, '.zip'), s.filename);
        const z = parseZip(s.bytes || []);
        g.check(label + ': zip parses with good CRC and one stored entry', z.problems.length === 0 && z.entries.length === 1, z.problems.join(','));
        g.check(label + ': inner file name', z.entries[0] && f.name.test(z.entries[0].name), z.entries[0] && z.entries[0].name);
        if (z.entries[0]) await contentOk(g, label, f.key, z.entries[0].data.toString('utf8'), h.page);
      } else {
        g.check(label + ': name', f.name.test(s.filename), s.filename);
        g.check(label + ': data is text', s.kind === '[object String]' || s.kind === 'string' || typeof s.text === 'string');
        await contentOk(g, label, f.key, s.text || '', h.page);
      }
      const status = await msgOf(b, f.scope).innerText();
      g.check(label + ': status says Saved', startsSaved(status), status);
      if (f.zipped) g.check(label + ': status warns the file is inside a zip', /zip/i.test(status), status);
    }
    // outcomes
    for (const mode of ['declined', 'rate_limited', 'error']) {
      await h.page.evaluate((m) => { window.__dlMode = m; }, mode);
      for (const f of [FILES[0], FILES[1], FILES[3]]) {
        await h.go(f.view); await openViewTools(h.page, f.view);
        const b = h.page.getByRole('button', { name: f.button });
        await b.click();
        await h.page.waitForTimeout(350);
        const msg = (await msgOf(b, f.scope).innerText()).trim();
        const label = 'artifact(a) ' + f.key + ' [' + mode + ']';
        g.check(label + ': never says Saved or Downloaded', !startsSaved(msg), msg);
        if (mode === 'declined') g.check(label + ': says it was not saved', /not saved|cancel|nothing was saved/i.test(msg), msg);
        if (mode === 'rate_limited') g.check(label + ': tells the person to wait', /wait|try again/i.test(msg), msg);
        const card = b.locator('xpath=ancestor::*[contains(@class,"' + f.scope.card + '")][1]');
        const box = await card.locator('textarea[readonly]').count();
        if (mode === 'error') {
          g.check(label + ': offers the text box with Copy', box >= 1 && (await card.getByRole('button', { name: 'Copy', exact: true }).count()) >= 1);
          g.check(label + ': text box holds the content', box >= 1 && (await card.locator('textarea[readonly]').first().inputValue()).length > 20);
        } else g.check(label + ': no text box needed', box === 0);
      }
    }
    clean(g, h, 'artifact(a) downloads');
    await h.ctx.close();
    // artifact (b): use() resolves null
    const hb = await open(browser, { mode: 'artifact', claude: 'null' });
    await prepare(hb);
    for (const f of FILES) {
      await hb.go(f.view); await openViewTools(hb.page, f.view);
      const b = hb.page.getByRole('button', { name: f.button });
      await b.click(); await hb.page.waitForTimeout(250);
      const card = b.locator('xpath=ancestor::*[contains(@class,"' + f.scope.card + '")][1]');
      const msg = (await msgOf(b, f.scope).innerText()).trim();
      g.check('artifact(b) ' + f.key + ': text box with Copy appears', (await card.locator('textarea[readonly]').count()) >= 1 && (await card.getByRole('button', { name: 'Copy', exact: true }).count()) >= 1, msg);
      g.check('artifact(b) ' + f.key + ': never says Saved', !startsSaved(msg), msg);
    }
    clean(g, hb, 'artifact(b) downloads');
    await hb.ctx.close();
  });

  await runGroup('5b copy buttons: real clipboard, and honest fallback when copying is refused', async (g) => {
    const COPIES = [
      { view: 'tracker', button: 'Copy my checklist', scope: TRK, expect: (t) => t.includes(P0.name) || t.length > 30, say: /copied/i },
      { view: 'info', button: 'Copy fill script', scope: PHONE, expect: (t) => t.startsWith('(function(){'), say: /copied/i },
      { view: 'info', button: 'Copy bookmark code', scope: PHONE, expect: (t) => t.startsWith('javascript:'), say: /copied/i }
    ];
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode, perms: ['clipboard-read', 'clipboard-write'] });
      await prepare(h);
      for (const c of COPIES) {
        await h.go(c.view); await openViewTools(h.page, c.view);
        const b = h.page.getByRole('button', { name: c.button });
        await b.click(); await h.page.waitForTimeout(250);
        const clip = await h.page.evaluate(() => navigator.clipboard.readText());
        g.check(mode + ' "' + c.button + '": clipboard holds the text', c.expect(clip), clip.slice(0, 60));
        const msg = await msgOf(b, c.scope).innerText();
        g.check(mode + ' "' + c.button + '": says copied', c.say.test(msg), msg);
      }
      clean(g, h, mode + ' copy');
      await h.ctx.close();
      const f = await open(browser, { mode, init: ['try{Object.defineProperty(navigator.clipboard,"writeText",{value:function(){return Promise.reject(new DOMException("blocked","NotAllowedError"))},configurable:true});document.execCommand=function(){return false}}catch(e){}'] });
      await prepare(f);
      for (const c of COPIES) {
        await f.go(c.view); await openViewTools(f.page, c.view);
        const b = f.page.getByRole('button', { name: c.button });
        await b.click(); await f.page.waitForTimeout(300);
        const msg = (await msgOf(b, c.scope).innerText()).trim();
        const card = b.locator('xpath=ancestor::*[contains(@class,"' + c.scope.card + '")][1]');
        const ta = card.locator('textarea[readonly]');
        g.check(mode + ' refused "' + c.button + '": does not claim it copied', !/(^|\s)(copied|checklist copied)\b/i.test(msg) || /not|could not|did not|would not/i.test(msg), msg);
        if (c.scope === TRK && (await ta.count())) { const sel = await ta.first().evaluate((t) => document.activeElement === t && t.selectionEnd - t.selectionStart > 10); if (!sel) g.note(mode + ' refused "' + c.button + '": the text box is shown but not selected or focused'); }
        g.check(mode + ' refused "' + c.button + '": shows the text to copy by hand', (await ta.count()) >= 1 && c.expect(await ta.first().inputValue()), 'textareas=' + (await ta.count()));
        if ((await ta.count()) && c.scope === PHONE) {
          const sel = await ta.first().evaluate((t) => document.activeElement === t && t.selectionEnd - t.selectionStart > 10);
          g.check(mode + ' refused "' + c.button + '": text is selected and focused', sel);
        }
      }
      clean(g, f, mode + ' refused copy');
      await f.ctx.close();
    }
  });
}

// ---- group 6 ----
async function tracked(page) { return page.evaluate(() => ({ p: localStorage.getItem('bff.profile.v1'), t: localStorage.getItem('bff.tracker.v1') })); }
const j = (s) => { try { return JSON.parse(s); } catch (e) { return s; } };

async function wipe(h) {
  await h.go('tracker');
  await openTools(h.page);
  await h.page.getByRole('button', { name: 'Reset tracker' }).click();
  await h.page.locator('.fx-confirm').getByRole('button', { name: 'Reset tracker' }).click();
  await h.go('info');
  await h.page.getByRole('button', { name: 'Clear my info' }).click();
  await h.page.locator('.fx-confirm').getByRole('button', { name: 'Clear my info' }).click();
  await h.page.waitForTimeout(200);
}

export async function backup(env) {
  const { browser } = env;
  await runGroup('6 backup round trip: save, wipe, restore (file input and pasted text), bad backups refused', async (g) => {
    for (const mode of ['standalone', 'artifact']) {
      const h = await open(browser, { mode });
      const page = h.page;
      await prepare(h);
      await h.go('tracker');
      await openTools(page);
      await showAllRows(page);
      await openRowDetails(page, PROGRAMS[1].id);
      await page.locator('#trk-n-' + PROGRAMS[1].id).fill('synthetic note for the round trip');
      await revealRow(page, PROGRAMS[3].id);
      await page.locator('#trk-s-' + PROGRAMS[3].id).selectOption('signed-up');
      await page.waitForTimeout(800);
      await page.getByLabel('Include My info in the backup').check();
      let text;
      if (mode === 'standalone') text = (await download(page, () => page.getByRole('button', { name: 'Download backup (JSON)' }).click())).text;
      else { await page.getByRole('button', { name: 'Download backup (JSON)' }).click(); await page.waitForTimeout(300); text = (await lastSave(page)).text; }
      const before = await tracked(page);
      const file = path.join(TMP, 'backup-' + mode + '.json');
      fs.writeFileSync(file, text);
      g.check(mode + ': backup holds profile and tracker', /"profile"/.test(text) && /"tracker"/.test(text));
      await wipe(h);
      const mid = await tracked(page);
      g.check(mode + ': wipe removed My info', mid.p === null || Object.keys(j(mid.p) || {}).length === 0, mid.p);
      g.check(mode + ': wipe emptied the tracker', mid.t === null || Object.keys((j(mid.t) || {}).entries || j(mid.t) || {}).length === 0, String(mid.t).slice(0, 80));
      await h.go('tracker');
      await openTools(page);
      if (mode === 'standalone') await page.setInputFiles('#trk-restore', file);
      else { await page.locator('summary', { hasText: 'Restore from pasted text instead' }).click(); await page.locator('#trk-paste').fill(text); await page.getByRole('button', { name: 'Restore from pasted text' }).click(); }
      await page.locator('.fx-confirm').getByRole('button', { name: 'Restore' }).click();
      await page.waitForFunction(() => /Restored/.test(document.querySelector('details.fx-fold[data-fold="backup"] .fx-msg').textContent), null, { timeout: 4000 }).catch(() => {});
      const after = await tracked(page);
      g.check(mode + ': tracker equal after restore', isDeepStrictEqual(j(after.t), j(before.t)), JSON.stringify(j(before.t)).slice(0, 120) + ' vs ' + JSON.stringify(j(after.t)).slice(0, 120));
      g.check(mode + ': My info equal after restore', isDeepStrictEqual(j(after.p), j(before.p)), JSON.stringify(j(before.p)).slice(0, 160) + ' vs ' + JSON.stringify(j(after.p)).slice(0, 160));
      // bad backups
      const good = JSON.parse(text);
      const firstId = Object.keys(good.tracker.entries || good.tracker)[0];
      const mutate = (fn) => { const c = JSON.parse(text); fn(c); return JSON.stringify(c); };
      const bad = {
        'not JSON': '{not json',
        'a JSON array': '[]',
        'wrong app name': mutate((c) => { c.app = 'other-app'; }),
        'unsupported version': mutate((c) => { c.version = 99; }),
        'tracker is a string': mutate((c) => { c.tracker = 'x'; }),
        'unknown status': mutate((c) => { const e = c.tracker.entries || c.tracker; e[firstId].status = 'hacked'; }),
        'note is not text': mutate((c) => { const e = c.tracker.entries || c.tracker; e[firstId].note = { a: 1 }; }),
        'truncated': text.slice(0, Math.floor(text.length / 2)),
        'script-like text': '<script>alert(1)</script>'
      };
      for (const k of Object.keys(bad)) {
        await h.go('tracker');
        await openTools(page);
        const ls0 = await lsDump(page);
        if (mode === 'standalone') await page.setInputFiles('#trk-restore', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(bad[k]) });
        else {
          const det = page.locator('details:not(.fx-fold)', { hasText: 'Restore from pasted text instead' });
          if (!(await det.evaluate((d) => d.open))) await det.locator('summary').click();
          await page.locator('#trk-paste').fill(bad[k]);
          await page.getByRole('button', { name: 'Restore from pasted text' }).click();
        }
        await page.waitForTimeout(300);
        let confirmShown = await page.locator('.fx-confirm').count();
        if (confirmShown) await page.locator('.fx-confirm').getByRole('button', { name: 'Restore' }).click().catch(() => {});
        await page.waitForTimeout(200);
        const msg = await page.locator(BACKUP_MSG).innerText();
        g.check(mode + ' bad backup (' + k + '): refused with a message', /fail|not a|not valid|cannot|unsupported|malformed|unknown|too large|invalid/i.test(msg) && !/^Restored/.test(msg.trim()), msg);
        g.check(mode + ' bad backup (' + k + '): data untouched', isDeepStrictEqual(await lsDump(page), ls0));
        if (await page.locator('.fx-confirm').count()) await page.locator('.fx-confirm').getByRole('button', { name: 'Cancel' }).click();
      }
      clean(g, h, mode + ' backup');
      await h.ctx.close();
    }
  });
}

// ---- group 7 ----
export const gmailCalls = [];
const GM_PROFILE = Object.assign({}, PROFILE, { usePlusTags: true });
async function gmailOpen(browser, gm, extra = {}) {
  const h = await open(browser, Object.assign({ mode: 'artifact', claude: 'full', profile: GM_PROFILE, hash: 'tracker', gm }, extra));
  await h.page.waitForSelector('[data-ib-card]', { state: 'attached' });
  await openFold(h.page, 'gmail'); // the Gmail card sits in a closed fold on the Tracker
  await h.page.waitForTimeout(300);
  return h;
}
const calls = (page) => page.evaluate(() => window.__calls);
async function harvest(h) { const c = await calls(h.page).catch(() => []); gmailCalls.push(...c); return c; }
const card = (page) => page.locator('[data-ib-card]');
const visible = (loc) => loc.first().isVisible().catch(() => false);
const draftBtn = (page) => card(page).getByRole('button', { name: 'Draft my checklist' });
const checkBtn = (page) => card(page).getByRole('button', { name: 'Check my Gmail' });

export async function gmail(env) {
  const { browser } = env;
  await runGroup('7a Gmail card, connected: taps only, nothing stored, text only, writes are narrow', async (g) => {
    const h = await gmailOpen(browser, {});
    const page = h.page;
    g.check('card shows the connection buttons', await visible(checkBtn(page)));
    g.check('nothing called on load', (await calls(page)).length === 0, JSON.stringify(await calls(page)).slice(0, 100));
    for (const r of ['directory', 'info', 'guided', 'safety', 'tracker']) await h.go(r);
    await page.waitForTimeout(300);
    g.check('nothing called after changing routes', (await calls(page)).length === 0);
    const before = await page.evaluate(() => BFF.tracker.counts());
    await checkBtn(page).click();
    await page.waitForSelector('.ib-group', { timeout: 6000 });
    const c1 = await calls(page);
    const searches = c1.filter((c) => c.tool === 'search_threads');
    g.check('search_threads called on Gmail server with sane input', searches.length >= 1 && searches.every((c) => c.server === 'Gmail' && typeof c.input.query === 'string' && c.input.query.length > 0 && c.input.query.length <= 1500 && c.input.pageSize > 0 && c.input.pageSize <= 50), JSON.stringify(searches[0]).slice(0, 200));
    g.check('every call came within a tap and uses an allowed tool', c1.every((c) => c.gesture && (c.listTools || ALLOWED_TOOLS.includes(c.tool))), JSON.stringify(c1.filter((c) => !c.gesture)));
    const text = await card(page).innerText();
    g.check('welcome, confirm and delivered threads are listed', /Welcome to the club!/.test(text) && /Please confirm your email/.test(text) && /Your sample was delivered/.test(text));
    g.check('hostile subject is shown as literal text', text.includes('<img src=x'));
    g.check('no injected element in the card', (await page.locator('[data-ib-card] img, [data-ib-card] script, [data-ib-card] svg, [data-ib-card] iframe').count()) === 0);
    g.check('no hostile handler fired', (await page.evaluate(() => window.__pwned)) === undefined);
    g.check('"Open in Gmail" links are mail.google.com only', await page.locator('.ib-open').evaluateAll((as) => as.length > 0 && as.every((a) => a.href.startsWith('https://mail.google.com/mail/') && a.target === '_blank' && /noopener/.test(a.rel))));
    const mid = await page.evaluate(() => BFF.tracker.counts());
    g.check('checking marked nothing by itself', JSON.stringify(before) === JSON.stringify(mid), JSON.stringify(mid));
    const stored = JSON.stringify(await lsDump(page));
    g.check('nothing from the mailbox is stored', !/tA1|Welcome to the club|brand-0\.example|onerror/.test(stored));
    const sug = page.locator('.ib-sug-btn');
    g.check('suggestions appear as buttons', (await sug.count()) >= 1);
    await sug.first().click();
    const one = await page.evaluate(() => BFF.tracker.counts());
    g.check('one tap applies exactly one suggestion', JSON.stringify(one) !== JSON.stringify(mid));
    // labels
    await card(page).getByRole('button', { name: 'Label these in Gmail' }).click();
    g.check('labelling asks first with the inline confirm', (await page.locator('.fx-confirm').count()) === 1 && !(await calls(page)).some((c) => c.tool === 'label_thread'));
    await page.locator('.fx-confirm .fx-btn--primary').click();
    await page.waitForFunction(() => /Label/i.test(document.querySelector('.ib-done').textContent), null, { timeout: 6000 });
    const c2 = await calls(page);
    const lt = c2.filter((c) => c.tool === 'label_thread'), cl = c2.filter((c) => c.tool === 'create_label');
    g.check('create_label asked for "Baby Freebies" once', cl.length === 1 && cl[0].input.displayName === 'Baby Freebies', JSON.stringify(cl));
    g.check('label_thread called with a thread id and the new label id', lt.length >= 1 && lt.every((c) => /^tA\d$/.test(c.input.threadId) && Array.isArray(c.input.labelIds) && c.input.labelIds.length === 1 && c.input.labelIds[0] === 'Label_77'), JSON.stringify(lt[0]));
    g.check('no thread labelled twice', new Set(lt.map((c) => c.input.threadId)).size === lt.length);
    // drafts
    await draftBtn(page).click();
    await page.waitForFunction(() => /Draft (saved|created) in your Gmail/.test(document.querySelector('.ib-done').textContent), null, { timeout: 5000 });
    const dtext = await page.locator('.ib-done').innerText();
    g.check('draft message says a draft was saved, and never says it was sent', /^Draft (saved|created) in your Gmail\./.test(dtext) && !/\bsent\b/i.test(dtext.replace(/nothing was sent/i, '')), dtext);
    if (!/nothing was sent/i.test(dtext)) g.note('draft message does not say "Nothing was sent" (ARCHITECTURE.md promises it): ' + dtext);
    await card(page).getByRole('button', { name: 'Draft my setup kit' }).click();
    await page.waitForFunction(() => /^Draft (saved|created)/.test(document.querySelector('.ib-done').textContent) && window.__calls.filter((c) => c.tool === 'create_draft').length >= 2, null, { timeout: 5000 });
    const dr = (await calls(page)).filter((c) => c.tool === 'create_draft');
    g.check('every draft is addressed only to the person themself', dr.length === 2 && dr.every((c) => isDeepStrictEqual(c.input.to, [PROFILE.email]) && typeof c.input.subject === 'string' && c.input.subject && typeof c.input.body === 'string' && c.input.body), JSON.stringify(dr.map((c) => c.input.to)));
    const atts = dr[1] && dr[1].input.attachments;
    g.check('kit draft carries base64 attachments of text the app made', Array.isArray(atts) && atts.length >= 1 && atts.every((a) => a.filename && a.mimeType && /^[A-Za-z0-9+/=]+$/.test(a.content) && /BEGIN:VCALENDAR|<feed/.test(Buffer.from(a.content, 'base64').toString('utf8'))), JSON.stringify(atts && atts.map((a) => a.filename)));
    const all = await harvest(h);
    g.check('only the five allowed tools were ever called', all.every((c) => c.listTools || ALLOWED_TOOLS.includes(c.tool)), [...new Set(all.map((c) => c.tool))].join(','));
    clean(g, h, 'gmail connected');
    await h.ctx.close();
  });

  await runGroup('7b Gmail card, errors and states: specific honest messages, no crash, reads retry once, writes never', async (g) => {
    const cases = [
      { code: 'not_granted', say: /./ },
      { code: 'server_not_connected', say: /connect/i },
      { code: 'rate_limited', retryable: true, retryAfterMs: 50, say: /./ },
      { code: 'tool_error', say: /./ },
      { code: 'blocked_by_policy', say: /./ }
    ];
    const texts = {};
    for (const c of cases) {
      const h = await gmailOpen(browser, { fail: { search_threads: { code: c.code, retryable: c.retryable, retryAfterMs: c.retryAfterMs, message: 'raw ' + c.code } } });
      await checkBtn(h.page).click();
      await h.page.waitForFunction(() => { const e = document.querySelector('.ib-error'); return e && !e.hidden && e.textContent.trim(); }, null, { timeout: 6000 }).catch(() => {});
      const err = (await h.page.locator('.ib-error').innerText()).trim();
      texts[c.code] = err;
      const cs = (await calls(h.page)).filter((x) => x.tool === 'search_threads');
      g.check(c.code + ': shows a message', err.length > 10 && c.say.test(err), err);
      g.check(c.code + ': message is not the raw error text', !/raw /.test(err), err);
      g.check(c.code + ': does not claim success', !/found|labelled|draft (saved|created)|marked/i.test(err) && (await h.page.locator('.ib-group').count()) === 0);
      g.check(c.code + ': retry count is right (' + cs.length + ' search calls)', c.retryable ? cs.length <= 2 && cs.length >= 1 : cs.length === 1, String(cs.length));
      if (c.code === 'not_granted') g.check('not_granted: no retry button is offered this page load', !(await visible(checkBtn(h.page))));
      if (c.code === 'blocked_by_policy') g.check('blocked_by_policy: the check feature is hidden or disabled', !(await visible(checkBtn(h.page))) || (await checkBtn(h.page).first().isDisabled()));
      if (c.code === 'server_not_connected') g.check('server_not_connected: shows the steps to connect Gmail', /To connect Gmail/.test(await card(h.page).innerText()));
      clean(g, h, c.code);
      await harvest(h);
      await h.ctx.close();
    }
    g.check('the five codes give distinct messages (or share one only inside a documented group)', new Set(Object.values(texts)).size >= 4, JSON.stringify(texts));
    // writes never retry
    const hw = await gmailOpen(browser, { fail: { create_draft: { code: 'rate_limited', retryable: true, retryAfterMs: 50 } } });
    await draftBtn(hw.page).click();
    await hw.page.waitForTimeout(900);
    const dc = (await calls(hw.page)).filter((c) => c.tool === 'create_draft');
    g.check('a failed create_draft is not retried by itself', dc.length === 1, String(dc.length));
    g.check('a failed draft shows an error and no "Draft created"', (await hw.page.locator('.ib-error').innerText()).length > 10 && !/Draft (saved|created)/.test(await hw.page.locator('.ib-done').innerText()));
    await harvest(hw); await hw.ctx.close();
    // connection states
    const hn = await gmailOpen(browser, { mode: 'not_connected' });
    await checkBtn(hn.page).click(); await hn.page.waitForTimeout(400);
    g.check('not connected: explains how to connect, shows no results', /To connect Gmail/.test(await card(hn.page).innerText()) && (await hn.page.locator('.ib-group').count()) === 0);
    await harvest(hn); await hn.ctx.close();
    const hc = await gmailOpen(browser, { mode: 'consent' });
    await checkBtn(hc.page).click(); await hc.page.waitForTimeout(120);
    g.check('needs consent: buttons are disabled and progress is announced while waiting', (await checkBtn(hc.page).first().isDisabled()) && (await hc.page.locator('.ib-live').innerText()).length > 0);
    await hc.page.waitForSelector('.ib-group', { timeout: 6000 });
    g.check('needs consent: results arrive after the person allows', true);
    await harvest(hc); await hc.ctx.close();
    const hd = await gmailOpen(browser, { mode: 'denied' });
    await checkBtn(hd.page).click(); await hd.page.waitForTimeout(400);
    g.check('consent denied: says so and offers no retry', (await hd.page.locator('.ib-error').innerText()).length > 10 && !(await visible(checkBtn(hd.page))));
    await harvest(hd); await hd.ctx.close();
    // listTools lacks a tool
    for (const [missing, first, hidden] of [[['create_draft'], 'check', 'Draft my checklist'], [['create_label', 'label_thread'], 'check', 'Label these in Gmail'], [['search_threads'], 'draft', 'Check my Gmail']]) {
      const hm = await gmailOpen(browser, { missing });
      if (first === 'check') { await checkBtn(hm.page).click(); await hm.page.waitForSelector('.ib-group', { timeout: 6000 }); } else { await draftBtn(hm.page).click(); await hm.page.waitForFunction(() => /Draft (saved|created) in your Gmail/.test(document.querySelector('.ib-done').textContent), null, { timeout: 5000 }); }
      await hm.page.waitForTimeout(300);
      const b = card(hm.page).getByRole('button', { name: hidden });
      g.check('listTools without ' + missing.join('+') + ': "' + hidden + '" is hidden or disabled', !(await visible(b)) || (await b.first().isDisabled()));
      await harvest(hm); await hm.ctx.close();
    }
  });

  await runGroup('7c Gmail card without the connector: explains, offers the Gmail search links, nothing throws', async (g) => {
    for (const [mode, claude] of [['standalone', 'full'], ['artifact', 'null'], ['artifact', 'none']]) {
      const label = mode + (mode === 'artifact' ? '/' + claude : '');
      const h = await open(browser, { mode, claude, profile: GM_PROFILE, hash: 'tracker' });
      await h.page.waitForSelector('[data-ib-card]', { state: 'attached' });
      await openFold(h.page, 'gmail');
      await h.page.waitForTimeout(500);
      const t = await card(h.page).innerText();
      g.check(label + ': says the connection needs Claude', /Claude/.test(t) && /not connected/i.test(t), t.slice(0, 100));
      g.check(label + ': no dead buttons', (await card(h.page).locator('button.ib-btn:visible').count()) === 0);
      // the links live in a row's Details panel now: open the first row of the to-do list that has one
      const withGm = trackerFor({ profile: GM_PROFILE }).secs.now.find((r) => E.inEmailFeatures(r.p));
      await openRowDetails(h.page, withGm.p.id);
      g.check(label + ': Search my Gmail links are offered (in a row\'s Details panel)', (await h.page.locator('a:visible', { hasText: 'Search my Gmail' }).count()) > 0);
      clean(g, h, label);
      await h.ctx.close();
    }
  });
}
