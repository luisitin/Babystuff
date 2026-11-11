// Group 13: Phase H. Tabs, short cards, filters disclosure, "Your situation" answers and what they hide.
// Every expected number comes from the real modules through model.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { TMP, PROFILE, open, clean, runGroup, openCard, openPhoneFold, openTools, trkTab, showAllRows, revealRow, openRowDetails, BACKUP_MSG, reloadAfterWrite } from './harness.mjs';
import { L, ALL, byId, poolFor } from './model.mjs';

const MODES = ['standalone', 'artifact'];
const KINDS = ['stuff', 'money', 'care', 'all'];
const KIND_NAME = { stuff: 'Free stuff', money: 'Money', care: 'Care and cover', all: 'All' };
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x));
const ids = (list) => list.map((p) => p.id);
const D = '#view-directory ';
const INSURERS = [...new Set(ALL.map((p) => p.insurer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
// A synthetic set of answers. They are entered through My info, as a person would.
const ANSWERS = { cover: 'private', insurer: INSURERS[0] || '', lowIncome: 'no', job: 'no' };
const idsNow = (page) => page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].map((c) => c.dataset.programId));
const countLine = async (page) => norm(await page.locator(D + '.result-count').innerText());
const prefs = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bff.prefs.v1') || '{}'); } catch (e) { return {}; } });
const storedProfile = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bff.profile.v1') || '{}'); } catch (e) { return {}; } });
const settle = (page) => page.waitForTimeout(250);

async function answer(h, a) {
  const page = h.page;
  await h.go('info');
  await page.locator('#info-cover').selectOption(a.cover);
  if (a.insurer && (await page.locator('#info-insurer').isVisible())) await page.locator('#info-insurer').selectOption(a.insurer);
  await page.locator('#info-lowIncome').selectOption(a.lowIncome);
  await page.locator('#info-job').selectOption(a.job);
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector('#view-info .fx-saved').textContent), null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
}
async function tabs(page) {
  return page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#view-directory .kind-tab')].map((b) => [b.dataset.kind, { text: b.textContent.replace(/\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed') }])));
}
async function lastSave(page) { return page.evaluate(() => window.__saves[window.__saves.length - 1]); }

export async function phaseH(env) {
  const { browser } = env;
  await runGroup('13 Phase H: tabs, short cards, filters disclosure', async (g) => {
    g.check('data has programs of each kind and the tabs split them', KINDS.slice(0, 3).every((k) => ALL.some((p) => L.kindOf(p) === k)) && ALL.every((p) => KINDS.slice(0, 3).includes(L.kindOf(p))));
    for (const mode of MODES) {
      const tag = mode + ': ';
      const h = await open(browser, { mode, all: false });
      const page = h.page;
      const pool = poolFor('', false);
      // ---- default tab and counts ----
      const t0 = await tabs(page);
      g.check(tag + 'four tabs, Free stuff pressed first', JSON.stringify(Object.keys(t0)) === JSON.stringify(KINDS) && t0.stuff.pressed === 'true' && KINDS.filter((k) => t0[k].pressed === 'true').length === 1, JSON.stringify(t0));
      const want = Object.fromEntries(KINDS.map((k) => [k, L.filterPrograms(pool, { kind: k }).length]));
      g.check(tag + 'every tab label and count equals the model', KINDS.every((k) => t0[k].text === KIND_NAME[k] + ' (' + want[k] + ')'), JSON.stringify(t0) + ' vs ' + JSON.stringify(want));
      g.check(tag + 'All is the sum of the other three', want.all === want.stuff + want.money + want.care && want.money > 0 && want.care > 0, JSON.stringify(want));
      g.check(tag + 'Showing N equals the Free stuff count', (await countLine(page)) === 'Showing ' + want.stuff + ' of ' + pool.length + ' programs', await countLine(page));
      g.check(tag + 'filters disclosure is closed by default and says "Sort and filter"', !(await page.locator(D + 'details.dir-filters').evaluate((d) => d.open)) && norm(await page.locator(D + 'details.dir-filters > summary').innerText()) === 'Sort and filter');
      // ---- each tab shows only its kind ----
      for (const k of KINDS) {
        await page.locator(D + '.kind-tab[data-kind="' + k + '"]').click(); await settle(page);
        const got = await idsNow(page);
        const wantIds = ids(L.filterPrograms(pool, { kind: k }));
        g.check(tag + 'tab ' + k + ': shows exactly the model programs, all of that kind', sameSet(got, wantIds) && got.every((id) => k === 'all' || L.kindOf(byId[id]) === k), got.length + ' vs ' + wantIds.length);
        g.check(tag + 'tab ' + k + ': Showing N equals the tab count and the pressed tab is only this one', (await countLine(page)) === 'Showing ' + want[k] + ' of ' + pool.length + ' programs' && (await tabs(page))[k].pressed === 'true');
      }
      // ---- the choice survives a reload ----
      await page.locator(D + '.kind-tab[data-kind="money"]').click(); await settle(page);
      g.check(tag + 'choice is saved in prefs as filters.kind', (await prefs(page)).filters && (await prefs(page)).filters.kind === 'money');
      await reloadAfterWrite(page); await page.waitForSelector(D + '.card'); await settle(page);
      g.check(tag + 'Money is still chosen after a reload and lists the model programs', (await tabs(page)).money.pressed === 'true' && sameSet(await idsNow(page), ids(L.filterPrograms(pool, { kind: 'money' }))));
      // ---- cards start collapsed ----
      await page.locator(D + '.kind-tab[data-kind="stuff"]').click(); await settle(page);
      const st = await page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].map((c) => {
        const t = c.querySelector('button.card-toggle'), m = c.querySelector('.card-more');
        return { exp: t && t.getAttribute('aria-expanded'), ctl: t && t.getAttribute('aria-controls'), id: m && m.id, hidden: m && m.hidden, vis: m && m.offsetParent !== null, open: c.classList.contains('is-open'), sel: !!c.querySelector('.card-more select[data-program-id]'), link: !!c.querySelector('.card-foot a.btn-primary'), free: !!c.querySelector('.free-line'), val: !!c.querySelector('.value-line'), basisOut: !!c.querySelector('.value-basis') && !c.querySelector('.value-basis').closest('.card-more'), pid: c.dataset.programId };
      }));
      g.check(tag + 'every card starts collapsed: aria-expanded false, details hidden, not .is-open', st.length > 0 && st.every((c) => c.exp === 'false' && c.hidden === true && !c.vis && !c.open), JSON.stringify(st.find((c) => c.exp !== 'false' || !c.hidden)));
      g.check(tag + 'each toggle controls its own #more-<id>', st.every((c) => c.ctl === 'more-' + c.pid && c.id === c.ctl));
      g.check(tag + 'collapsed cards still show the free line, value line and sign-up link; status select and basis are inside the details', st.every((c) => c.link && c.val && c.sel && !c.basisOut) && st.filter((c) => c.free).length > 0);
      // ---- toggle by mouse ----
      const first = page.locator(D + 'article.card').first();
      const fid = await first.getAttribute('data-program-id');
      const toggle = first.locator('button.card-toggle'), more = first.locator('.card-more');
      await toggle.click();
      g.check(tag + 'tapping Details sets aria-expanded true and shows what-you-need and verified text', (await toggle.getAttribute('aria-expanded')) === 'true' && await more.isVisible() && /Verified \d{4}-\d{2}-\d{2}/.test(await more.innerText()) && (await first.getAttribute('class')).includes('is-open'));
      const hasBasis = !!byId[fid].valueBasis;
      g.check(tag + 'the long value basis shows only when open', !hasBasis || (await more.locator('.value-basis').isVisible()));
      await toggle.click();
      g.check(tag + 'tapping again collapses it', (await toggle.getAttribute('aria-expanded')) === 'false' && !(await more.isVisible()));
      // ---- keyboard ----
      await toggle.focus(); await page.keyboard.press('Enter');
      const afterEnter = await toggle.getAttribute('aria-expanded');
      await page.keyboard.press('Space');
      const afterSpace = await toggle.getAttribute('aria-expanded');
      g.check(tag + 'keyboard: Enter opens and Space closes the focused Details button, focus stays', afterEnter === 'true' && afterSpace === 'false' && await toggle.evaluate((b) => document.activeElement === b));
      await page.keyboard.press('Enter');
      g.check(tag + 'the card stays open after the list is drawn again (sort change)', await (async () => { await page.locator(D + 'details.dir-filters > summary').click(); await page.locator(D + '.field', { has: page.locator('label', { hasText: 'Sort by' }) }).locator('select').selectOption('name'); await settle(page); return (await page.locator(D + 'article.card[data-program-id="' + fid + '"] button.card-toggle').getAttribute('aria-expanded')) === 'true'; })());
      // ---- filters disclosure opens by itself ----
      g.check(tag + 'a non-default sort opens the disclosure and the summary counts it', (await page.locator(D + 'details.dir-filters').evaluate((d) => d.open)) && /^Sort and filter \(1 on\)$/.test(norm(await page.locator(D + 'details.dir-filters > summary').innerText())));
      clean(g, h, tag + 'tabs and cards');
      await h.ctx.close();

      // a saved non-default filter opens the disclosure on load; Clear filters returns to Free stuff
      for (const f of [{ trulyFree: true }, { category: 'formula' }, { offer: 'product' }, { emailOnly: true }]) {
        const h2 = await open(browser, { mode, all: false, init: ['try{localStorage.setItem("bff.prefs.v1",' + JSON.stringify(JSON.stringify({ filters: Object.assign({ kind: 'all' }, f) })) + ')}catch(e){}'] });
        const key = Object.keys(f)[0];
        g.check(tag + 'saved filter ' + key + ' opens the disclosure on load', await h2.page.locator(D + 'details.dir-filters').evaluate((d) => d.open) && /\(1 on\)/.test(await h2.page.locator(D + 'details.dir-filters > summary').innerText()));
        if (key === 'trulyFree') {
          const clear = h2.page.locator(D + 'button', { hasText: 'Clear filters' }).first();
          if (await clear.count()) { await clear.click(); await settle(h2.page); }
          g.check(tag + 'Clear filters returns to Free stuff with nothing on', (await tabs(h2.page)).stuff.pressed === 'true' && /^Sort and filter$/.test(norm(await h2.page.locator(D + 'details.dir-filters > summary').innerText())) && (await h2.page.locator(D + 'label[data-chip="trulyFree"] input, label.chip-toggle input').first().isChecked()) === false);
        }
        clean(g, h2, tag + 'saved filter ' + key);
        await h2.ctx.close();
      }
    }
  });

  await runGroup('14 Phase H: Your situation answers save, travel in a backup, hide programs and are never used to fill', async (g) => {
    g.check('data names at least one insurer and the answers hide some programs and fit others', INSURERS.length > 0);
    for (const mode of MODES) {
      const tag = mode + ': ';
      const h = await open(browser, { mode, all: false, perms: ['clipboard-read', 'clipboard-write'] });
      const page = h.page;
      const afterState = poolFor('', false);

      // ---- before any answer ----
      // The "Answer four quick questions" line is gone from the summary; the missing-info notice invites the answers now.
      const miss0 = await page.evaluate(() => { const b = document.querySelector('#view-directory .dir-miss .miss-box'); return b ? { keys: b.dataset.missingKeys, shown: b.offsetParent !== null } : null; });
      g.check(tag + 'no answers: the summary has no questions line, the missing-info notice asks for the four answers, and nothing is hidden', (await page.locator(D + '.sum-situation').count()) === 0 && !!miss0 && miss0.shown && ['cover', 'lowIncome', 'job'].every((k) => miss0.keys.split(' ').includes(k)) && (await page.locator(D + '.dir-fit').isHidden()), JSON.stringify(miss0));
      await page.locator(D + 'details.dir-filters > summary').click();
      const fm = page.locator(D + 'label[data-chip="fitsMine"] input');
      g.check(tag + '"Fits my answers" is disabled until something is answered, with a hint', await fm.isDisabled() && await page.locator(D + '.chip-hint').isVisible());
      g.check(tag + 'no answers: no card says Fits your answers or Does not match', (await page.locator(D + '.tag-fit, ' + D + '.tag-nomatch').count()) === 0);

      // ---- answer through My info ----
      await h.go('info');
      g.check(tag + 'My info has "Your situation (optional)" with the four questions; insurer is offered when the data has insurers', (await page.locator('#view-info .fx-situation h3').innerText()).includes('Your situation (optional)') && (await page.locator('#info-cover').count()) === 1 && (await page.locator('#info-lowIncome').count()) === 1 && (await page.locator('#info-job').count()) === 1 && (await page.locator('#info-insurer').count()) === 1);
      await page.locator('#info-cover').selectOption('none');
      g.check(tag + 'insurer stays hidden for "No cover now"', !(await page.locator('#info-insurer').isVisible()));
      await answer(h, ANSWERS);
      g.check(tag + 'insurer question shows for a private plan and lists the data\'s insurers plus Other', await page.locator('#info-insurer').isVisible() && sameSet(await page.locator('#info-insurer option').evaluateAll((os) => os.map((o) => o.value).filter(Boolean)), INSURERS.concat(['other'])));
      const sp = await storedProfile(page);
      g.check(tag + 'answers are saved in profile.v1', ['cover', 'insurer', 'lowIncome', 'job'].every((k) => sp[k] === ANSWERS[k]), JSON.stringify(sp));
      g.check(tag + 'answers live only in bff.profile.v1 (not in prefs, tracker or guided)', await page.evaluate((v) => ['bff.prefs.v1', 'bff.tracker.v1', 'bff.guided.v1'].every((k) => !(localStorage.getItem(k) || '').includes(v)), ANSWERS.insurer || 'zz-none-zz'));
      await reloadAfterWrite(page); await settle(page);
      await h.go('info');
      g.check(tag + 'answers survive a reload', (await page.locator('#info-cover').inputValue()) === ANSWERS.cover && (await page.locator('#info-insurer').inputValue()) === ANSWERS.insurer && (await page.locator('#info-lowIncome').inputValue()) === ANSWERS.lowIncome && (await page.locator('#info-job').inputValue()) === ANSWERS.job);

      // ---- what the Directory hides ----
      const prof = await storedProfile(page);
      const none = () => 'todo';
      const nHide = L.hiddenByAnswersCount(afterState, prof, none);
      g.check(tag + 'the answers rule out some programs and keep others (model)', nHide > 0 && nHide < afterState.length, nHide + ' of ' + afterState.length);
      await h.go('directory'); await h.showAll();
      const keep = L.filterPrograms(afterState, { profile: prof, hideNoFit: true, statusOf: none });
      const fitBox = page.locator(D + '.dir-fit');
      const boxText = norm(await fitBox.innerText());
      g.check(tag + 'the line says "N programs hidden because of your answers" with the model N', fitBox.isVisible && boxText.includes((nHide === 1 ? '1 program hidden' : nHide + ' programs hidden') + ' because of your answers'), boxText);
      g.check(tag + 'All tab lists exactly the programs the model keeps', sameSet(await idsNow(page), ids(keep)), (await idsNow(page)).length + ' vs ' + keep.length);
      g.check(tag + 'Showing N of M uses the programs left after hiding', (await countLine(page)) === 'Showing ' + keep.length + ' of ' + keep.length + ' programs', await countLine(page));
      const tabsNow = await tabs(page);
      g.check(tag + 'tab counts follow the hidden programs', KINDS.every((k) => tabsNow[k].text === KIND_NAME[k] + ' (' + L.filterPrograms(keep, { kind: k }).length + ')'), JSON.stringify(tabsNow));
      const fits = ids(keep.filter((p) => L.fit(p, prof) === 'yes' && p.audience && p.audience.length));
      const fitCards = await page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].filter((c) => c.querySelector('.tag-fit')).map((c) => c.dataset.programId));
      g.check(tag + '"Fits your answers" badge is on exactly the programs with fit yes and an audience', sameSet(fitCards, fits) && fits.length > 0, fitCards.length + ' vs ' + fits.length);
      // The fit sentence moved out of the summary: the box under it says how many programs the answers hide.
      const fitBox2 = norm(await page.locator(D + '.dir-fit').innerText());
      g.check(tag + 'the summary has no fit sentence; the answers box says how many are hidden', (await page.locator(D + '.sum-situation').count()) === 0 && fitBox2.startsWith((nHide === 1 ? '1 program hidden' : nHide + ' programs hidden') + ' because of your answers in My info.'), fitBox2);
      g.check(tag + 'hidden programs have no "Does not match" badge while hidden', (await page.locator(D + '.tag-nomatch').count()) === 0);

      // Fits my answers
      await page.locator(D + 'details.dir-filters').evaluate((d) => { d.open = true; });
      g.check(tag + '"Fits my answers" is enabled once something is answered and the hint is gone', !(await fm.isDisabled()) && !(await page.locator(D + '.chip-hint').isVisible()));
      await fm.check(); await settle(page);
      const fitsOnly = L.filterPrograms(afterState, { profile: prof, hideNoFit: true, statusOf: none, fitsMine: true });
      g.check(tag + '"Fits my answers" keeps exactly the fit-yes programs', sameSet(await idsNow(page), ids(fitsOnly)) && fitsOnly.every((p) => L.fit(p, prof) === 'yes') && fitsOnly.length > 0 && fitsOnly.length < keep.length, (await idsNow(page)).length + ' vs ' + fitsOnly.length);
      g.check(tag + 'the chip counts as one filter in the disclosure summary', /\(1 on\)/.test(await page.locator(D + 'details.dir-filters > summary').innerText()));
      await fm.uncheck(); await settle(page);

      // Start a guided run uses the shown list
      g.check(tag + 'the guided run button counts the shown programs', norm(await page.locator(D + '.start-run').innerText()) === 'Start a guided run with these ' + keep.length);

      // ---- a tracked program is never hidden ----
      const hiddenList = afterState.filter((p) => L.hiddenByAnswers(p, prof, 'todo'));
      const tr = hiddenList[0], tr2 = hiddenList[1];
      g.check(tag + 'there are two hidden programs to track', !!tr && !!tr2);
      await page.evaluate(([a, b]) => { BFF.tracker.setStatus(a, 'signed-up'); BFF.tracker.setStatus(b, 'skipped'); }, [tr.id, tr2.id]);
      await h.go('tracker'); await h.go('directory'); await settle(page);
      const st2 = (id) => (id === tr.id ? 'signed-up' : id === tr2.id ? 'skipped' : 'todo');
      const nHide2 = L.hiddenByAnswersCount(afterState, prof, st2);
      const keep2 = L.filterPrograms(afterState, { profile: prof, hideNoFit: true, statusOf: st2 });
      const now2 = await idsNow(page);
      g.check(tag + 'a tracked program (signed up or skipped) shows even though its answers say no', now2.includes(tr.id) && now2.includes(tr2.id) && L.fit(tr, prof) === 'no', tr.id);
      g.check(tag + 'hidden count drops by two and the list equals the model', nHide2 === nHide - 2 && sameSet(now2, ids(keep2)), nHide2 + ' vs ' + nHide);
      g.check(tag + 'the tracked card carries the Does not match badge and its status badge', (await page.locator(D + 'article.card[data-program-id="' + tr.id + '"] .tag-nomatch').count()) === 1 && /Signed up/i.test(await page.locator(D + 'article.card[data-program-id="' + tr.id + '"] .card-status-badge').innerText()));
      await page.evaluate(([a, b]) => { BFF.tracker.setStatus(a, 'todo'); BFF.tracker.setStatus(b, 'todo'); }, [tr.id, tr2.id]);
      await h.go('tracker'); await h.go('directory'); await settle(page);
      g.check(tag + 'back to To do they are hidden again', sameSet(await idsNow(page), ids(keep)));

      // ---- Show them ----
      await fitBox.getByRole('button', { name: 'Show them' }).click(); await settle(page);
      const allShown = await idsNow(page);
      g.check(tag + 'Show them lists every program of the pool', sameSet(allShown, ids(afterState)));
      g.check(tag + 'the line now says the non-matching programs are shown and the button says Hide them', /do(es)? not match|that do not match/.test(norm(await fitBox.innerText())) && (await fitBox.getByRole('button', { name: 'Hide them' }).count()) === 1, norm(await fitBox.innerText()));
      const noMatch = await page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].filter((c) => c.querySelector('.tag-nomatch')).map((c) => c.dataset.programId));
      g.check(tag + '"Does not match your answers" is on exactly the hidden programs', sameSet(noMatch, ids(hiddenList)) && noMatch.length === nHide, noMatch.length + ' vs ' + nHide);
      g.check(tag + 'focus stays on the Show/Hide button', await page.evaluate(() => document.activeElement === document.querySelector('#view-directory .dir-fit button')));
      g.check(tag + 'the choice is remembered in prefs.showNoFit', (await prefs(page)).showNoFit === true);
      await reloadAfterWrite(page); await page.waitForSelector(D + '.card'); await settle(page);
      await h.showAll();
      g.check(tag + 'after a reload the programs are still shown with the badge', sameSet(await idsNow(page), ids(afterState)) && (await page.locator(D + '.tag-nomatch').count()) === nHide);
      await fitBox.getByRole('button', { name: 'Hide them' }).click(); await settle(page);
      g.check(tag + 'Hide them hides them again and prefs.showNoFit is false', sameSet(await idsNow(page), ids(keep)) && (await prefs(page)).showNoFit === false);

      // ---- backup and restore carry the answers; Clear my info removes them ----
      await h.go('tracker');
      await openTools(page);
      await page.getByLabel('Include My info in the backup').check();
      let text;
      if (mode === 'standalone') {
        const [d] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), page.getByRole('button', { name: 'Download backup (JSON)' }).click()]);
        text = fs.readFileSync(await d.path(), 'utf8');
      } else { await page.getByRole('button', { name: 'Download backup (JSON)' }).click(); await page.waitForTimeout(300); text = (await lastSave(page)).text; }
      let bj = {}; try { bj = JSON.parse(text); } catch (e) { /* reported below */ }
      g.check(tag + 'the backup has the four answers inside its profile', !!bj.profile && ['cover', 'insurer', 'lowIncome', 'job'].every((k) => bj.profile[k] === ANSWERS[k]), JSON.stringify(bj.profile || {}).slice(0, 200));
      await h.go('info');
      await page.getByRole('button', { name: 'Clear my info' }).click();
      await page.locator('.fx-confirm').getByRole('button', { name: 'Clear my info' }).click(); await page.waitForTimeout(300);
      const cleared = await storedProfile(page);
      g.check(tag + 'Clear my info removes the answers from storage and the form', ['cover', 'insurer', 'lowIncome', 'job'].every((k) => !cleared[k]) && (await page.locator('#info-cover').inputValue()) === '' && (await page.locator('#info-lowIncome').inputValue()) === '' && (await page.locator('#info-job').inputValue()) === '', JSON.stringify(cleared));
      await h.go('directory'); await h.showAll();
      g.check(tag + 'with the answers gone nothing is hidden and the invitation is back', sameSet(await idsNow(page), ids(afterState)) && (await page.locator(D + '.dir-fit').isHidden()) && (await page.locator(D + '.sum-situation').count()) === 0 && (await page.locator('#view-directory .dir-miss .miss-box').count()) === 1);
      await h.go('tracker');
      await openTools(page);
      if (mode === 'standalone') { const f = path.join(TMP, 'h-backup.json'); fs.writeFileSync(f, text); await page.setInputFiles('#trk-restore', f); }
      else { await page.locator('summary', { hasText: 'Restore from pasted text instead' }).click(); await page.locator('#trk-paste').fill(text); await page.getByRole('button', { name: 'Restore from pasted text' }).click(); }
      await page.locator('.fx-confirm').getByRole('button', { name: 'Restore' }).click();
      await page.waitForFunction(() => /Restored/.test(document.querySelector('details.fx-fold[data-fold="backup"] .fx-msg').textContent), null, { timeout: 4000 }).catch(() => {});
      const back = await storedProfile(page);
      g.check(tag + 'restoring the backup brings the four answers back', ['cover', 'insurer', 'lowIncome', 'job'].every((k) => back[k] === ANSWERS[k]), JSON.stringify(back));
      await h.go('directory'); await h.showAll();
      g.check(tag + 'after the restore the same programs are hidden again', sameSet(await idsNow(page), ids(keep)));
      // a restore never overwrites an answer that is already set
      await h.go('info'); await page.locator('#info-job').selectOption('yes'); await page.waitForTimeout(700);
      await h.go('tracker');
      await openTools(page);
      if (mode === 'standalone') await page.setInputFiles('#trk-restore', path.join(TMP, 'h-backup.json'));
      else { await page.locator('#trk-paste').fill(text); await page.getByRole('button', { name: 'Restore from pasted text' }).click(); }
      await page.locator('.fx-confirm').getByRole('button', { name: 'Restore' }).click(); await page.waitForTimeout(400);
      g.check(tag + 'a restore fills blanks only: an answer already given is kept', (await storedProfile(page)).job === 'yes');
      // a backup with bad values is checked on import
      const evil = JSON.parse(text); evil.profile = Object.assign({}, evil.profile, { cover: 'bogus', job: 'maybe', insurer: '<b>x</b>' });
      await h.go('info'); await page.getByRole('button', { name: 'Clear my info' }).click(); await page.locator('.fx-confirm').getByRole('button', { name: 'Clear my info' }).click(); await page.waitForTimeout(300);
      await h.go('tracker');
      await openTools(page);
      if (mode === 'standalone') { const f = path.join(TMP, 'h-evil.json'); fs.writeFileSync(f, JSON.stringify(evil)); await page.setInputFiles('#trk-restore', f); }
      else { await page.locator('#trk-paste').fill(JSON.stringify(evil)); await page.getByRole('button', { name: 'Restore from pasted text' }).click(); }
      await page.locator('.fx-confirm').getByRole('button', { name: 'Restore' }).click(); await page.waitForTimeout(400);
      const bad = await storedProfile(page);
      g.check(tag + 'import checks values: unknown cover and job are dropped, the insurer stays plain text', !bad.cover && !bad.job && (bad.insurer === undefined || typeof bad.insurer === 'string') && !(await page.locator('#view-info b').count()), JSON.stringify(bad));
      clean(g, h, tag + 'situation');
      await h.ctx.close();

      // ---- the answers never leave My info: fill script, bookmark, phone view, guided copy ----
      const hp = await open(browser, { mode, all: false, perms: ['clipboard-read', 'clipboard-write'], profile: Object.assign({}, PROFILE, ANSWERS), hash: 'info' });
      const pg = hp.page;
      await hp.go('info');
      g.check(tag + 'a profile loaded from storage shows the answers in My info', (await pg.locator('#info-lowIncome').inputValue()) === ANSWERS.lowIncome && (await pg.locator('#info-cover').inputValue()) === ANSWERS.cover);
      await openPhoneFold(pg);
      await pg.getByRole('button', { name: 'Copy fill script' }).click(); await pg.waitForTimeout(250);
      const script = await pg.evaluate(() => navigator.clipboard.readText());
      await pg.getByRole('button', { name: 'Copy bookmark code' }).click(); await pg.waitForTimeout(250);
      const mark = await pg.evaluate(() => navigator.clipboard.readText());
      const phone = await pg.evaluate(() => [...document.querySelectorAll('#view-info textarea, #view-info input[readonly], #view-info pre, #view-info code, #view-info .ph-group')].map((e) => (e.value || '') + ' ' + e.textContent).join('\n'));
      await hp.go('guided');
      const start = pg.getByRole('button', { name: /^Start \(/ }); if (await start.count()) await start.first().click();
      await pg.waitForTimeout(250);
      const copyAll = pg.getByRole('button', { name: 'Copy all' });
      let guidedCopy = '';
      if (await copyAll.count()) { await copyAll.first().click(); await pg.waitForTimeout(250); guidedCopy = await pg.evaluate(() => navigator.clipboard.readText()); }
      const guidedText = await pg.locator('#view-guided').innerText();
      // Words the answers would leave behind. The script itself mentions "insurer" in its list of fields it never fills, and program names
      // contain insurer names, so the checks read the embedded profile object and use key and label words elsewhere.
      const KEYWORDS = ['lowIncome', '"cover"', '"job"', '"insurer"', 'Health cover', 'Employer or private plan', 'paid job', 'Insurer or health plan'];
      const leak = (t) => KEYWORDS.filter((n) => t.includes(n));
      const FORM = ['firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'zip', 'dueDate'];
      const profOf = (t) => { const m = /var D=(\{[\s\S]*?\});var FM=\(/.exec(t); try { return JSON.parse(m[1]).profile; } catch (e) { return null; } };
      const markDecoded = (() => { try { return decodeURIComponent(mark); } catch (e) { return mark; } })();
      const cleanProf = (pf) => !!pf && Object.keys(pf).every((k) => FORM.includes(k)) && Object.values(pf).every((v) => !['private', ANSWERS.insurer, 'no'].includes(v)) && pf.firstName === PROFILE.firstName;
      g.check(tag + 'the fill script copied from My info is real, its profile has only form fields and none of the four answers', script.length > 1000 && cleanProf(profOf(script)) && !script.includes('lowIncome') && !script.includes('"cover"') && !script.includes('"job"'), JSON.stringify(profOf(script) && Object.keys(profOf(script))) + leak(script).join(','));
      g.check(tag + 'the bookmark code carries the same clean profile', mark.startsWith('javascript:') && cleanProf(profOf(markDecoded)), JSON.stringify(profOf(markDecoded) && Object.keys(profOf(markDecoded))));
      g.check(tag + 'the phone view text has no answer keys or labels', phone.length > 100 && leak(phone.replace(/ssn\|social security\|insurance\|insurer\|member id/, '')).length === 0, leak(phone).join(','));
      g.check(tag + 'the guided run\'s copy-all text has the form details and none of the four answers', guidedCopy.includes(PROFILE.firstName) && leak(guidedCopy).length === 0 && !guidedCopy.includes(ANSWERS.insurer) && !/private|lowIncome/.test(guidedCopy), guidedCopy.slice(0, 120));
      g.check(tag + 'the guided run page has no answer keys or labels', leak(guidedText).length === 0, leak(guidedText).join(','));
      clean(g, hp, tag + 'privacy');
      await hp.ctx.close();
    }
  });

  await runGroup('15 Phase H: no sideways scroll at 360 and 390, light and dark, collapsed and open', async (g) => {
    for (const mode of MODES) for (const w of [360, 390]) for (const scheme of ['light', 'dark']) {
      const tag = mode + ' ' + w + ' ' + scheme + ': ';
      const h = await open(browser, { mode, all: false, scheme, viewport: { width: w, height: 800 }, profile: Object.assign({}, PROFILE, ANSWERS) });
      const page = h.page;
      const wide = () => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
      const ok = (m) => m.sw <= m.cw && m.bw <= m.cw;
      g.check(tag + 'Free stuff tab, collapsed cards', ok(await wide()), JSON.stringify(await wide()));
      for (const k of ['money', 'care', 'all']) { await page.locator(D + '.kind-tab[data-kind="' + k + '"]').click(); await settle(page); g.check(tag + k + ' tab', ok(await wide()), JSON.stringify(await wide())); }
      await page.locator(D + 'details.dir-filters > summary').click();
      await page.evaluate(() => document.querySelectorAll('#view-directory button.card-toggle').forEach((b) => b.click()));
      await settle(page);
      g.check(tag + 'filters open and every card open', ok(await wide()), JSON.stringify(await wide()));
      const tabsFit = await page.evaluate(() => { const t = document.querySelector('#view-directory .kind-tabs'); const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth + 1 && [...t.querySelectorAll('button')].every((b) => b.getBoundingClientRect().height >= 40); });
      g.check(tag + 'the tabs fit the screen and are at least 40px tall', tabsFit);
      await h.go('info');
      g.check(tag + 'My info with the situation questions', ok(await wide()), JSON.stringify(await wide()));
      clean(g, h, tag.trim());
      await h.ctx.close();
    }
  });
}
