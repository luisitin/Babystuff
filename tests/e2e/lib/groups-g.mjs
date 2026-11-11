// Group 15: Phase J (hide by default, one hide rule, tick boxes, true undo, failed saves). Every expected list and number is worked
// out from data/programs.json by lib/model.mjs (L.splitHidden, L.trackerScope, L.hideReason, L.tickChange), never typed in. The
// expected statuses of the tick paths and the sentences are written out by hand from ARCHITECTURE.md, "Phase J".
// BFF_E2E_SUB=J1,J5 node tests/e2e/run.mjs --only 15 runs only those parts.
import { open, clean, runGroup, revealPick, seedStore, trackerSeed, guardedReload, reloadAfterWrite, hiddenBoxState, toggleReason, openHiddenBox, cardIds, cardTicks, trkTab, HB, sleep } from './harness.mjs';
import { L, ALL, byId, splitFor, trackerFor, isoInDays } from './model.mjs';
import { leftSentence } from './groups-f.mjs';

const MODES = ['standalone', 'artifact'];
const JANE = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' };
const PROFILES = [
  ['empty', {}],
  ['Texas, private cover', Object.assign({}, JANE, { cover: 'private' })],
  ['Texas, Medicaid and WIC', Object.assign({}, JANE, { cover: 'medicaid', lowIncome: 'yes' })],
  ['California, no cover', Object.assign({}, JANE, { state: 'CA', city: 'Los Angeles', zip: '90001', cover: 'none' })]
];
const TXP = PROFILES[1][1];
const PUMP = 'healthcare-gov-insurance-covered-breast-pump';
const FOOT = 'These numbers count every tab and ignore the search and filters. What you show here is hidden again the next time you open the app.';
const SAVE_FAIL_CARD = 'It could not be saved on this device (storage is full or blocked), so it lasts only until you close this page.';
const SAVE_FAIL_TRK = 'Could not save on this device (storage is full or blocked). Your changes are kept only until you close this page.';
const NOTICE = 'This browser has stopped saving data (storage is full or blocked). Your newest changes are kept only until you close this page.';

const norm = (s) => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
const ids = (arr) => arr.map((p) => p.id);
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x));
const diff = (a, b) => 'page-only: ' + a.filter((x) => !b.includes(x)).slice(0, 3).join(',') + ' | model-only: ' + b.filter((x) => !a.includes(x)).slice(0, 3).join(',');
const plural = (n, w, ws) => n + ' ' + (n === 1 ? w : ws || w + 's');
const stOf = (statuses) => (id) => (statuses && statuses[id]) || 'todo';
const groupSize = (p) => ALL.filter((q) => L.groupKey(q) === L.groupKey(p)).length;
const isoDaysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// The model of one Programs page state.
const modelOf = (profile, statuses, shown) => splitFor({ state: profile.state || '', profile, statuses: statuses || {}, shown: shown || {} });
// The lines the "Hidden from this list" box must have for a split, worded from the module.
function wantLines(sp, hasState, shown) {
  return L.HIDE_REASONS.filter((r) => sp.counts[r] > 0).map((r) => {
    const t = L.hideReasonText(r, sp.counts[r], hasState);
    const on = !!(shown && shown[r]);
    return { reason: r, text: t + (r === 'otherState' && !hasState ? ' Add your state in My info to see the ones for you.' : '') + (on ? ' (shown for now)' : ''), btn: on ? 'Hide' : 'Show', hid: ' ' + t };
  });
}
const summaryWant = (sp) => (sp.hiddenNow === 0 ? 'Nothing is hidden right now (' + sp.total + ' normally ' + (sp.total === 1 ? 'is' : 'are') + ')' : 'Hidden from this list: ' + plural(sp.hiddenNow, 'program'));

// Compare the whole Programs page with the model: listed ids, count line, the box (presence, summary, lines, footer, My info link).
async function verifyPrograms(g, label, page, profile, statuses, shown) {
  const hasState = !!(profile.state || '').trim();
  const sp = modelOf(profile, statuses, shown);
  const got = await cardIds(page);
  g.check(label + ': the cards are exactly the programs the model lists (' + sp.pool.length + ')', sameSet(got, ids(sp.pool)), diff(got, ids(sp.pool)));
  g.check(label + ': count line says Showing N of N', norm(await page.locator('#view-directory .result-count').innerText()) === 'Showing ' + sp.pool.length + ' of ' + sp.pool.length + ' programs', await page.locator('#view-directory .result-count').innerText());
  const b = await hiddenBoxState(page);
  if (sp.total === 0) { g.check(label + ': nothing to hide, so the box has the hidden attribute', b.present && b.hidden === true, JSON.stringify(b)); return sp; }
  g.check(label + ': the box is there and not hidden', b.present && b.hidden === false, JSON.stringify(b).slice(0, 200));
  g.check(label + ': summary reads "' + summaryWant(sp) + '"', b.summary === summaryWant(sp), b.summary);
  const want = wantLines(sp, hasState, shown);
  g.check(label + ': one line per reason with a count, in order, with the module words and Show/Hide', JSON.stringify(b.lines.map((l) => [l.reason, l.text, l.btnVisible, l.btnHidden])) === JSON.stringify(want.map((l) => [l.reason, l.text, l.btn, l.hid])), JSON.stringify(b.lines.map((l) => [l.reason, l.text, l.btnVisible])) + ' vs ' + JSON.stringify(want.map((l) => [l.reason, l.text, l.btn])));
  g.check(label + ': every line button is a btn btn-small', b.lines.every((l) => /\bbtn\b/.test(l.btnClass) && /\bbtn-small\b/.test(l.btnClass)));
  g.check(label + ': footer sentence', b.foot === FOOT, b.foot);
  const osLine = b.lines.find((l) => l.reason === 'otherState');
  if (osLine) g.check(label + ': the other-state line ' + (hasState ? 'has no My info link (a state is set)' : 'links to My info with data-info-key=state'), hasState ? osLine.link === null : osLine.link === 'My info', JSON.stringify(osLine.link));
  g.check(label + ': no empty-state line while programs are listed', sp.pool.length === 0 || b.emptyHidden === null, String(b.emptyHidden));
  return sp;
}
async function openJ(browser, mode, o = {}) {
  const seed = Object.assign({}, o.seed || {});
  if (o.statuses) Object.assign(seed, seedStore('tracker', trackerSeed(o.statuses)));
  if (o.entries) Object.assign(seed, seedStore('tracker', o.entries));
  return open(browser, { mode, profile: o.profile || {}, seed, hash: o.hash || 'directory', viewport: o.vp, scheme: o.scheme });
}
const prefsOf = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bff.prefs.v1') || '{}'); } catch (e) { return {}; } });
const trackerOf = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('bff.tracker.v1') || '{}'); } catch (e) { return {}; } });
const statusNow = (page, id) => page.evaluate((i) => BFF.tracker.getStatus(i), id);
const redraw = async (page, h) => { await h.go('info'); await h.go('directory'); await page.waitForTimeout(150); };
const focusOn = (page, sel) => page.evaluate((s) => !!document.querySelector(s) && document.activeElement === document.querySelector(s), sel);
const liveHas = (page, root, text) => page.evaluate(([r, t]) => [...document.querySelectorAll(r + ' [role="status"]')].some((e) => e.textContent.replace(/\s+/g, ' ').trim() === t), [root, text]);
const liveTexts = (page, root) => page.evaluate((r) => [...document.querySelectorAll(r + ' [role="status"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean), root);
const lineBtn = (r) => HB + ' li[data-reason="' + r + '"] button';

// A setup with all five reasons on the Programs page: Texas with private cover, a program done, one received, one not for me, and the
// breast-pump group signed up (so its other ways are covered).
function fiveReasons() {
  const sp0 = modelOf(TXP);
  const solo = sp0.pool.filter((p) => groupSize(p) === 1 && p.id !== PUMP);
  const statuses = { [solo[0].id]: 'signed-up', [solo[1].id]: 'received', [solo[2].id]: 'skipped', [PUMP]: 'signed-up' };
  return { statuses, solo, sp: modelOf(TXP, statuses) };
}

// ======================= J1 hidden by default =======================
async function j1(env, g) {
  const { browser } = env;
  const emp = modelOf({});
  g.check('data: with no state the model hides the state-limited programs (and nothing else)', emp.counts.otherState > 0 && emp.total === emp.counts.otherState);
  const tx = modelOf(TXP);
  g.check('data: Texas with private cover hides programs of other states and programs the answer rules out', tx.counts.otherState > 0 && tx.counts.noFit > 0 && tx.hiddenNow === tx.counts.otherState + tx.counts.noFit);
  for (const mode of MODES) {
    for (const [name, profile] of PROFILES) {
      const label = mode + ' ' + name;
      const h = await openJ(browser, mode, { profile });
      const page = h.page;
      await verifyPrograms(g, label, page, profile, {}, {});
      const b = await hiddenBoxState(page);
      g.check(label + ': the box starts closed', b.present && b.open === false);
      // programs whose fit is unknown stay listed, with their missing-info line when something is missing
      if (L.hasSituation(profile)) {
        const maybe = ALL.filter((p) => L.fit(p, profile) === 'maybe' && !modelOf(profile).reasons[p.id]);
        const lines = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#view-directory article.card')].map((c) => [c.dataset.programId, !!c.querySelector('.miss-line')])));
        g.check(label + ': programs whose fit is unknown ("maybe", ' + maybe.length + ') are all listed, and carry a missing-info line exactly when something is missing', maybe.length > 0 && maybe.every((p) => p.id in lines && lines[p.id] === (L.missingInfo(p, profile).length > 0)), maybe.filter((p) => !(p.id in lines) || lines[p.id] !== (L.missingInfo(p, profile).length > 0)).map((p) => p.id).slice(0, 3).join(','));
      }
      clean(g, h, label);
      await h.ctx.close();
    }
  }
  // Patched data (the page's own copy, JSON.parse wrapped before the app reads it): one program for another state and nothing else
  // limited, so the singular wording and the "nothing to hide" case can be seen.
  const patch = (keep) => '(function(){var K=' + JSON.stringify(keep) + ',o=JSON.parse;JSON.parse=function(t,r){var v=o.call(this,t,r);try{if(Array.isArray(v)&&v.length>50&&v[0]&&v[0].signupUrl){v.forEach(function(p){if(p.id!==K){p.states=[];p.audience=[];}});}}catch(e){}return v;};})();';
  const keepP = ALL.find((p) => p.states.length && !p.states.includes('TX') && groupSize(p) === 1);
  for (const mode of MODES) {
    const h = await open(browser, { mode, profile: JANE, init: [patch(keepP.id)] });
    const page = h.page, tag = mode + ' patched data, one other-state program: ';
    let b = await hiddenBoxState(page);
    g.check(tag + 'summary "Hidden from this list: 1 program" (singular) and the line "1 for another state"', b.summary === 'Hidden from this list: 1 program' && b.lines.length === 1 && b.lines[0].text === '1 for another state' && (await cardIds(page)).length === ALL.length - 1, JSON.stringify(b.lines) + b.summary);
    await toggleReason(page, 'otherState');
    b = await hiddenBoxState(page);
    g.check(tag + 'Show: "Nothing is hidden right now (1 normally is)" (singular), the line ends (shown for now), all programs listed', b.summary === 'Nothing is hidden right now (1 normally is)' && b.lines[0].text === '1 for another state (shown for now)' && (await cardIds(page)).length === ALL.length, b.summary);
    clean(g, h, tag);
    await h.ctx.close();
    const h0 = await open(browser, { mode, profile: {}, init: [patch('')] });
    const b0 = await hiddenBoxState(h0.page);
    g.check(mode + ' patched data, nothing limited to a state, no answers: the box has the hidden attribute (nothing would be hidden) and every program is listed', b0.present && b0.hidden === true && (await cardIds(h0.page)).length === ALL.length, JSON.stringify(b0).slice(0, 160));
    clean(g, h0, mode + ' patched none');
    await h0.ctx.close();
  }
  // The same lists with a due date: the due-date buttons count only programs that are still listed (to do).
  for (const mode of MODES) {
    const profile = Object.assign({}, TXP, { dueDate: isoInDays(73) });
    const solo = modelOf(profile).pool.filter((p) => groupSize(p) === 1);
    const statuses = { [solo[0].id]: 'signed-up', [solo[1].id]: 'skipped' };
    const h = await openJ(browser, mode, { profile, statuses });
    const page = h.page;
    const sp = await verifyPrograms(g, mode + ' Texas with a due date and two marked programs', page, profile, statuses, {});
    const counts = {};
    L.collapseGroups(L.sortPrograms(sp.pool, 'when')).forEach((x) => { counts[x.lead.when] = (counts[x.lead.when] || 0) + 1; });
    const btns = await page.locator('#view-directory .when-buttons button strong').allInnerTexts();
    const want = ['pregnancy', 'late-pregnancy', 'after-birth'].filter((k) => counts[k]).map((k) => String(counts[k]));
    g.check(mode + ': the due-date buttons count only programs still listed (the two marked ones are not counted)', JSON.stringify(btns) === JSON.stringify(want) && want.length > 0, JSON.stringify(btns) + ' vs ' + JSON.stringify(want));
    clean(g, h, mode + ' due date');
    await h.ctx.close();
  }
}

// ======================= J2 Show and Hide per reason =======================
async function j2(env, g) {
  const { browser } = env;
  const F = fiveReasons();
  const reasons = L.HIDE_REASONS.filter((r) => F.sp.counts[r] > 0);
  g.check('data: the setup has all five reasons (' + JSON.stringify(F.sp.counts) + ')', reasons.length === 5);
  for (const mode of MODES) {
    const h = await openJ(browser, mode, { profile: TXP, statuses: F.statuses });
    const page = h.page;
    const tag = mode + ': ';
    await verifyPrograms(g, tag + 'five reasons, default', page, TXP, F.statuses, {});
    for (const r of reasons) {
      const shown = { [r]: true };
      await toggleReason(page, r);
      await verifyPrograms(g, tag + 'Show ' + r, page, TXP, F.statuses, shown);
      g.check(tag + r + ': focus returns to the same line button', await focusOn(page, lineBtn(r)));
      g.check(tag + r + ': the button is named Hide plus the reason, and the box stayed open', (await page.getByRole('button', { name: 'Hide ' + L.hideReasonText(r, F.sp.counts[r], true) }).count()) === 1 && (await hiddenBoxState(page)).open === true);
      await toggleReason(page, r);
      await verifyPrograms(g, tag + 'Hide ' + r, page, TXP, F.statuses, {});
      g.check(tag + r + ': after Hide the focus is on the same button again, named Show', (await focusOn(page, lineBtn(r))) && (await page.getByRole('button', { name: 'Show ' + L.hideReasonText(r, F.sp.counts[r], true) }).count()) === 1);
    }
    // all together: "Nothing is hidden right now (N normally are)"
    const all = {};
    for (const r of reasons) { await toggleReason(page, r); all[r] = true; }
    await verifyPrograms(g, tag + 'every reason shown', page, TXP, F.statuses, all);
    const b = await hiddenBoxState(page);
    g.check(tag + 'every reason shown: "Nothing is hidden right now (' + F.sp.total + ' normally are)" and all ' + ALL.length + ' programs are listed', b.summary === 'Nothing is hidden right now (' + F.sp.total + ' normally are)' && (await cardIds(page)).length === ALL.length, b.summary);
    g.check(tag + 'every reason shown: every line says (shown for now)', b.lines.every((l) => l.text.endsWith('(shown for now)') && l.btnVisible === 'Hide'));
    // no state: the other-state line and its link
    clean(g, h, tag + 'five reasons');
    await h.ctx.close();
    const h2 = await openJ(browser, mode, { profile: {} });
    await toggleReason(h2.page, 'otherState');
    await verifyPrograms(g, tag + 'no state, Show', h2.page, {}, {}, { otherState: true });
    const cardsNo = await cardIds(h2.page);
    g.check(tag + 'no state, shown: every program is listed and the summary says nothing is hidden', cardsNo.length === ALL.length && (await hiddenBoxState(h2.page)).summary === 'Nothing is hidden right now (' + emp(ALL) + ' normally are)');
    await h2.ctx.close();
  }
}
const emp = () => modelOf({}).total;

// ======================= J3 never saved =======================
async function j3(env, g) {
  const { browser } = env;
  const F = fiveReasons();
  for (const mode of MODES) {
    const tag = mode + ': ';
    const h = await openJ(browser, mode, { profile: TXP, statuses: F.statuses });
    const page = h.page;
    // Opening and saving a preference first, so bff.prefs.v1 exists, then Show everything.
    await page.locator('#view-directory .field', { has: page.locator('label', { hasText: 'Sort by' }) }).locator('select').selectOption('name');
    await page.waitForTimeout(300);
    const before = await prefsOf(page);
    g.check(tag + 'bff.prefs.v1 exists after a saved choice (the sort), with no show key', before.filters && before.filters.sort === 'name' && !('showOtherStates' in before) && !('showNoFit' in before), JSON.stringify(before));
    for (const r of L.HIDE_REASONS) if (F.sp.counts[r]) await toggleReason(page, r);
    await page.waitForTimeout(300);
    const after = await prefsOf(page);
    g.check(tag + 'after Show on every reason bff.prefs.v1 is exactly what it was (no key added or changed)', JSON.stringify(after) === JSON.stringify(before), JSON.stringify(after));
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    g.check(tag + 'localStorage holds only the four known keys at most', keys.every((k) => ['bff.profile.v1', 'bff.tracker.v1', 'bff.prefs.v1', 'bff.guided.v1'].includes(k)), keys.join());
    g.check(tag + 'everything is listed now', (await cardIds(page)).length === ALL.length);
    await reloadAfterWrite(page);
    await page.waitForSelector('#view-directory article.card');
    await h.showAll();
    await verifyPrograms(g, tag + 'after a guarded reload everything is hidden again', page, TXP, F.statuses, {});
    g.check(tag + 'after the reload the box is closed and prefs still has no show key', (await hiddenBoxState(page)).open === false && !('showOtherStates' in (await prefsOf(page))) && !('showNoFit' in (await prefsOf(page))));
    clean(g, h, tag + 'never saved');
    await h.ctx.close();
    // The old saved choices change nothing and are removed the next time preferences are saved.
    const h2 = await openJ(browser, mode, { profile: TXP, statuses: F.statuses, seed: seedStore('prefs', { showOtherStates: true, showNoFit: true }) });
    const p2 = h2.page;
    await h2.showAll();
    await verifyPrograms(g, tag + 'old saved { showOtherStates: true, showNoFit: true } changes nothing', p2, TXP, F.statuses, {});
    await p2.locator('#view-directory .field', { has: p2.locator('label', { hasText: 'Sort by' }) }).locator('select').selectOption('name');
    await p2.waitForTimeout(300);
    const old = await prefsOf(p2);
    g.check(tag + 'the next save of preferences drops the two old keys', !('showOtherStates' in old) && !('showNoFit' in old) && old.filters && old.filters.sort === 'name', JSON.stringify(old));
    clean(g, h2, tag + 'old prefs');
    await h2.ctx.close();
  }
}

// ======================= J4 numbers ignore search, filters, tabs; the empty state =======================
async function j4(env, g) {
  const { browser } = env;
  const base = modelOf(TXP);
  // A search that matches hidden programs only (singular and plural), found in the data.
  const hiddenAll = ALL.filter((p) => base.reasons[p.id]);
  const matchesShown = (q) => L.filterPrograms(base.pool, { query: q }).length;
  const matchesHidden = (q) => L.filterPrograms(hiddenAll, { query: q });
  const cands = [];
  hiddenAll.forEach((p) => { cands.push(p.name, p.brand); String(p.name).split(/\s+/).forEach((w) => { if (w.length >= 5) cands.push(w); }); });
  const uniq = [...new Set(cands.filter(Boolean))];
  const one = uniq.find((q) => matchesShown(q) === 0 && matchesHidden(q).length === 1);
  const many = uniq.find((q) => matchesShown(q) === 0 && matchesHidden(q).length >= 2 && new Set(matchesHidden(q).map((p) => base.reasons[p.id])).size >= 1);
  g.check('data: there is a search that matches exactly one hidden program and no listed one, and one that matches several hidden and no listed one', !!one && !!many, String(one) + ' / ' + String(many));
  for (const mode of MODES) {
    const tag = mode + ': ';
    const h = await openJ(browser, mode, { profile: TXP });
    const page = h.page;
    const b0 = await hiddenBoxState(page);
    const search = page.locator('#view-directory input[type=search]');
    // search, a filter and a tab do not change the numbers
    await search.fill('pump'); await page.waitForTimeout(400);
    await page.locator('#view-directory label.chip-toggle', { hasText: 'Truly free' }).locator('input').check();
    await page.locator('#view-directory .kind-tab[data-kind="money"]').click(); await page.waitForTimeout(300);
    const b1 = await hiddenBoxState(page);
    g.check(tag + 'the box (summary, lines, footer) is the same with a search, Truly free and the Money tab on', b1.summary === b0.summary && JSON.stringify(b1.lines) === JSON.stringify(b0.lines) && b1.foot === FOOT, b1.summary + ' vs ' + b0.summary);
    await search.fill(''); await page.waitForTimeout(300);
    await h.showAll();
    await page.locator('#view-directory label.chip-toggle', { hasText: 'Truly free' }).locator('input').uncheck().catch(() => {});
    await page.waitForTimeout(200);
    // the empty state: one hidden program
    for (const [q, n] of [[one, 1], [many, matchesHidden(many || '').length]]) {
      if (!q) continue;
      await search.fill(q); await page.waitForTimeout(450);
      const m = matchesHidden(q);
      const mc = {};
      m.forEach((p) => { const r = base.reasons[p.id]; mc[r] = (mc[r] || 0) + 1; });
      const want = (m.length === 1 ? '1 hidden program matches' : m.length + ' hidden programs match') + ' (' + L.hideCountsText(mc, true) + '). Open "Hidden from this list" above to show ' + (m.length === 1 ? 'it.' : 'them.');
      const b = await hiddenBoxState(page);
      g.check(tag + 'search "' + q + '" matches only hidden programs: the empty-state line says so (' + (n === 1 ? 'singular' : 'plural') + ')', b.emptyHidden === want && (await cardIds(page)).length === 0, String(b.emptyHidden) + ' vs ' + want);
      g.check(tag + 'search "' + q + '": the box numbers still count every hidden program', b.summary === b0.summary && JSON.stringify(b.lines) === JSON.stringify(b0.lines));
      // showing the reason of the first match lists it and clears the line
      const r0 = base.reasons[m[0].id];
      await toggleReason(page, r0);
      const ids1 = await cardIds(page);
      g.check(tag + 'search "' + q + '": Show on "' + r0 + '" lists the matches of that reason and the empty-state line shrinks or goes', m.filter((p) => base.reasons[p.id] === r0).every((p) => ids1.includes(p.id)), ids1.join(',').slice(0, 100));
      const rest = m.filter((p) => base.reasons[p.id] !== r0);
      const b2 = await hiddenBoxState(page);
      g.check(tag + 'search "' + q + '": the empty-state line is gone once a match is listed' + (rest.length ? ' (and the rest is not counted while programs are listed)' : ''), b2.emptyHidden === null);
      await toggleReason(page, r0);
      await search.fill(''); await page.waitForTimeout(300);
    }
    clean(g, h, tag + 'numbers and empty state');
    await h.ctx.close();
  }
}

// ======================= J5 card ticks =======================
const PATH = [
  // box, checked, status after, [done, received, notForMe], note, live suffix
  ['done', true, 'signed-up', [1, 0, 0], 'Marked done. It will be hidden from this list. Untick to undo.', ' marked done.'],
  ['received', true, 'received', [1, 1, 0], 'Marked received. It will be hidden from this list. Untick to undo.', ' marked received.'],
  ['received', false, 'signed-up', [1, 0, 0], 'No longer marked received. It will be hidden from this list. Tick it again to undo.', ' is no longer marked received.'],
  ['received', true, 'received', [1, 1, 0], 'Marked received. It will be hidden from this list. Untick to undo.', ' marked received.'],
  ['done', false, 'todo', [0, 0, 0], '', ' is back on your list.'],
  ['notForMe', true, 'skipped', [0, 0, 1], 'Marked not for me. It will be hidden from this list. Untick to undo.', ' marked not for me.'],
  ['done', true, 'signed-up', [1, 0, 0], 'Marked done. It will be hidden from this list. Untick to undo.', ' marked done.'],
  ['notForMe', true, 'skipped', [0, 0, 1], 'Marked not for me. It will be hidden from this list. Untick to undo.', ' marked not for me.'],
  ['notForMe', false, 'signed-up', [1, 0, 0], 'Marked done. It will be hidden from this list. Tick it again to undo.', ' marked done.'],
  ['done', false, 'todo', [0, 0, 0], '', ' is back on your list.']
];
const ID = { done: 'tick-done-', received: 'tick-rcv-', notForMe: 'tick-nfm-' };
async function j5(env, g) {
  const { browser } = env;
  for (const mode of MODES) {
    const tag = mode + ': ';
    const profile = Object.assign({}, TXP, { dueDate: isoInDays(73) });
    const h = await openJ(browser, mode, { profile });
    const page = h.page;
    const sp = modelOf(profile);
    const solo = sp.pool.filter((p) => groupSize(p) === 1);
    const P = solo[4], Q = solo[6];
    // --- no select anywhere in a card, and the structure of the tick area, on every card ---
    const struct = await page.evaluate(() => [...document.querySelectorAll('#view-directory article.card[data-program-id]')].map((c) => {
      const id = c.dataset.programId;
      const t = c.querySelector(':scope > div.card-ticks');
      const kids = [...c.children];
      const lab = (k) => { const i = c.querySelector('#tick-' + k + '-' + id); return i ? { text: i.closest('label').querySelector('.tick-text').textContent, hid: i.closest('label').querySelector('.visually-hidden').textContent, key: i.dataset.tick, hiddenLabel: i.closest('label').hidden } : null; };
      return { id, select: c.querySelectorAll('select').length, st: !!document.getElementById('st-' + id), row: c.querySelectorAll('.status-row').length, ticks: !!t, after: t ? kids.indexOf(t) > kids.indexOf(c.querySelector('.card-foot')) && !c.querySelector('.card-more').contains(t) : false, group: t ? (t.querySelector('.ticks') || {}).getAttribute && t.querySelector('.ticks').getAttribute('aria-label') : null, done: lab('done'), rcv: lab('rcv'), nfm: lab('nfm'), note: !!(t && t.querySelector('p.tick-note')), gone: !c.querySelector('.is-ticked') && !c.classList.contains('is-ticked') };
    }));
    const badS = (f) => struct.filter((s) => !f(s)).map((s) => s.id).slice(0, 3).join(',');
    g.check(tag + 'no card has a select, a #st-<id> or a .status-row (' + struct.length + ' cards)', struct.length > 20 && struct.every((s) => s.select === 0 && !s.st && s.row === 0), badS((s) => s.select === 0 && !s.st && s.row === 0));
    g.check(tag + 'no select[data-program-id] anywhere on the page', (await page.locator('select[data-program-id]').count()) === 0);
    g.check(tag + 'every card has div.card-ticks after .card-foot and outside .card-more, with a note line', struct.every((s) => s.ticks && s.after && s.note), badS((s) => s.ticks && s.after && s.note));
    g.check(tag + 'every card has the boxes Done, Received, Not for me (data-tick, ids, labels, a hidden program name) and the group is named "Mark <name>"', struct.every((s) => s.done && s.rcv && s.nfm && s.done.text === 'Done' && s.rcv.text === 'Received' && s.nfm.text === 'Not for me' && s.done.key === 'done' && s.rcv.key === 'received' && s.nfm.key === 'notForMe' && s.done.hid === ': ' + byId[s.id].name && s.group === 'Mark ' + byId[s.id].name), badS((s) => s.done && s.group === 'Mark ' + byId[s.id].name));
    g.check(tag + 'at the start the Received label is hidden, nothing is ticked and no card is a strip', struct.every((s) => s.rcv.hiddenLabel === true && s.gone));
    g.check(tag + 'the boxes have accessible names "Done: <name>" and "Not for me: <name>"', (await page.getByRole('checkbox', { name: new RegExp('^Done ?: ' + P.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).count()) === 1 && (await page.getByRole('checkbox', { name: new RegExp('^Not for me ?: ' + P.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).count()) === 1);
    // --- every status path, through the boxes, against the hand-written table ---
    const card = page.locator('article.card[data-program-id="' + P.id + '"]');
    await card.locator('button.card-toggle').click();
    g.check(tag + 'the card is open before the first tick', (await card.locator('button.card-toggle').getAttribute('aria-expanded')) === 'true');
    const order0 = await cardIds(page);
    const handle = await card.elementHandle();
    let stepNo = 0;
    for (const [box, checked, wantSt, wantBoxes, wantNote, liveSuffix] of PATH) {
      stepNo++;
      const sel = '#' + ID[box] + P.id;
      if (checked) await page.locator(sel).check(); else await page.locator(sel).uncheck();
      await page.waitForTimeout(60);
      const lab = 'step ' + stepNo + ' (' + (checked ? 'tick ' : 'untick ') + box + ')';
      const t = await cardTicks(page, P.id);
      const stored = (await trackerOf(page))[P.id];
      const strip = wantSt !== 'todo';
      g.check(tag + lab + ': status is ' + wantSt, (await statusNow(page, P.id)) === wantSt && ((stored && stored.status) || 'todo') === wantSt, wantSt + ' vs ' + (await statusNow(page, P.id)) + '/' + (stored && stored.status));
      g.check(tag + lab + ': boxes ' + JSON.stringify(wantBoxes) + ' and the Received box is shown only while done', t.done === !!wantBoxes[0] && t.received === !!wantBoxes[1] && t.notForMe === !!wantBoxes[2] && t.rcvVisible === (wantSt === 'signed-up' || wantSt === 'received'), JSON.stringify(t));
      g.check(tag + lab + ': .is-ticked is ' + strip + ', Details closed, note "' + wantNote + '"', t.ticked === strip && t.note === wantNote && (!strip || ((await card.locator('button.card-toggle').getAttribute('aria-expanded')) === 'false' && (await card.locator('.card-more').evaluate((d) => d.hidden)))), JSON.stringify(t));
      g.check(tag + lab + ': the live message is "' + P.name + liveSuffix + '"', await liveHas(page, '#view-directory', P.name + liveSuffix), JSON.stringify(await liveTexts(page, '#view-directory')));
      g.check(tag + lab + ': the same card is still in the same place in the list (nothing redrawn)', JSON.stringify(await cardIds(page)) === JSON.stringify(order0) && (await card.elementHandle().then((x) => x.evaluate((a, b) => a === b, handle).catch(() => false))));
    }
    // --- the card is gone after the next redraw, and the box counted it ---
    await page.locator('#' + ID.done + P.id).check();
    g.check(tag + 'ticked Done again: the card is still listed until the next redraw', (await cardIds(page)).includes(P.id));
    await redraw(page, h);
    const st1 = { [P.id]: 'signed-up' };
    const sp1 = await verifyPrograms(g, tag + 'after a redraw the done program has left the list and the box counts it', page, profile, st1, {});
    g.check(tag + 'after the redraw the card of the done program is gone', !(await cardIds(page)).includes(P.id) && sp1.counts.done === 1);
    const counts = {};
    L.collapseGroups(L.sortPrograms(sp1.pool, 'when')).forEach((x) => { counts[x.lead.when] = (counts[x.lead.when] || 0) + 1; });
    const btns = await page.locator('#view-directory .when-buttons button strong').allInnerTexts();
    const startBtn = norm(await page.getByRole('button', { name: /^Start a guided run with these/ }).innerText());
    g.check(tag + 'the "Start a guided run with these N" button counts only what is still listed', startBtn === 'Start a guided run with these ' + sp1.pool.length, startBtn + ' vs ' + sp1.pool.length);
    g.check(tag + 'the due-date buttons follow (to-do programs only)', JSON.stringify(btns) === JSON.stringify(['pregnancy', 'late-pregnancy', 'after-birth'].filter((k) => counts[k]).map((k) => String(counts[k]))), JSON.stringify(btns));
    // Not for me on another card; its line appears at the next redraw
    await page.locator('#' + ID.notForMe + Q.id).check();
    await redraw(page, h);
    await verifyPrograms(g, tag + 'Not for me on a second program, after a redraw', page, profile, { [P.id]: 'signed-up', [Q.id]: 'skipped' }, {});
    // showing the done line brings P back with its box ticked and the Received box offered
    await toggleReason(page, 'done');
    const tP = await cardTicks(page, P.id);
    g.check(tag + 'Show on the done line lists the program again with Done ticked and the Received box offered', tP && tP.done && !tP.notForMe && tP.rcvVisible && !tP.ticked, JSON.stringify(tP));
    // --- keyboard use (the done line is hidden again, so a done card collapses to a strip) ---
    await toggleReason(page, 'done');
    const K = solo[8];
    const kc = page.locator('article.card[data-program-id="' + K.id + '"]');
    await kc.locator('button.card-toggle').focus();
    let reached = false;
    for (let i = 0; i < 8 && !reached; i++) { await page.keyboard.press('Tab'); reached = await focusOn(page, '#' + ID.done + K.id); }
    g.check(tag + 'Tab from the Details button reaches the Done box', reached);
    await page.keyboard.press('Space'); await page.waitForTimeout(80);
    const tk = await cardTicks(page, K.id);
    g.check(tag + 'Space ticks Done, the card collapses to a strip and focus stays on the box', tk.done && tk.ticked && (await focusOn(page, '#' + ID.done + K.id)) && (await statusNow(page, K.id)) === 'signed-up', JSON.stringify(tk));
    await page.keyboard.press('Tab'); await page.waitForTimeout(60);
    const onRcv = await focusOn(page, '#' + ID.received + K.id);
    g.check(tag + 'Tab goes on to the Received box, which is now offered', onRcv);
    await page.keyboard.press('Space'); await page.waitForTimeout(80);
    g.check(tag + 'Space on Received marks it received and focus stays', (await statusNow(page, K.id)) === 'received' && (await focusOn(page, '#' + ID.received + K.id)));
    await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(40);
    await page.keyboard.press('Space'); await page.waitForTimeout(80);
    g.check(tag + 'Shift+Tab then Space unticks Done: back to to do, card restored, focus on Done', (await statusNow(page, K.id)) === 'todo' && !(await cardTicks(page, K.id)).ticked && (await focusOn(page, '#' + ID.done + K.id)));
    clean(g, h, tag + 'card ticks');
    await h.ctx.close();
  }
  // --- a program back on to do that is still hidden for another reason ---
  for (const mode of MODES) await coveredCase(browser, mode, 'directory', g);
  for (const mode of MODES) {
    for (const [name, profile] of [['state set', TXP], ['no state', {}]]) {
      const tag = mode + ' ' + name + ': ';
      const other = ALL.filter((p) => L.hiddenByState(p, profile.state || '') && groupSize(p) === 1)[0];
      const h = await openJ(browser, mode, { profile, statuses: { [other.id]: 'signed-up' } });
      const page = h.page;
      await toggleReason(page, 'done');
      g.check(tag + 'a done program of another state is listed once the done line is shown', (await cardIds(page)).includes(other.id));
      await page.locator('#' + ID.done + other.id).uncheck();
      await page.waitForTimeout(80);
      const t = await cardTicks(page, other.id);
      const why = profile.state ? 'It is for another state, so it will be hidden from this list.' : 'It is only for some states, so it will be hidden from this list until you add your state in My info.';
      g.check(tag + 'unticking Done: "No longer marked. ' + why + '" and the card is not a strip', t.note === 'No longer marked. ' + why && !t.ticked && !t.done, JSON.stringify(t));
      g.check(tag + 'the live message says it is no longer marked (not that it is back on the list)', await liveHas(page, '#view-directory', other.name + ' is no longer marked.'), JSON.stringify(await liveTexts(page, '#view-directory')));
      await redraw(page, h);
      g.check(tag + 'after a redraw it is hidden again as another state', !(await cardIds(page)).includes(other.id));
      clean(g, h, tag + 'hidden for another reason');
      await h.ctx.close();
    }
  }
}

// Two programs of one group, both signed up; unticking the second leaves it covered by the first.
async function coveredCase(browser, mode, route, g) {
  const spC = modelOf(TXP, { [PUMP]: 'signed-up' });
  const B = ALL.find((p) => p.sameAs === PUMP && spC.reasons[p.id] === 'covered');
  const tag = mode + ' ' + route + ': ';
  g.check(tag + 'data: the pump group has another way that nothing but the pump sign-up hides', !!B);
  if (!B) return;
  const h = await openJ(browser, mode, { profile: TXP, statuses: { [PUMP]: 'signed-up', [B.id]: 'signed-up' }, hash: route });
  const page = h.page;
  if (route === 'directory') {
    await toggleReason(page, 'done');
    await page.locator('#view-directory details.same-group > summary').first().click(); // the other ways sit in a closed fold
    await page.locator('#' + ID.done + B.id).uncheck(); await page.waitForTimeout(80);
    const t = await cardTicks(page, B.id);
    g.check(tag + 'unticking the second sign-up: "No longer marked. You already signed up for another way to get this, so it will be hidden from this list."', t.note === 'No longer marked. You already signed up for another way to get this, so it will be hidden from this list.' && !t.ticked, JSON.stringify(t));
    g.check(tag + 'the live message says it is no longer marked', await liveHas(page, '#view-directory', B.name + ' is no longer marked.'), JSON.stringify(await liveTexts(page, '#view-directory')));
  } else {
    await trkTab(page, 'signed-up');
    await page.locator('#trk-done-' + B.id).uncheck(); await page.waitForTimeout(100);
    const why = 'You already signed up for another way to get this, so it will be left out of your list.';
    g.check(tag + 'unticking the second sign-up: note "No longer marked. ' + why + ' Tick it again to undo."', (await rowNote(page, B.id)) === 'No longer marked. ' + why + ' Tick it again to undo.', String(await rowNote(page, B.id)));
    g.check(tag + 'the live message is "<name> is no longer marked. ' + why + '"', await liveHas(page, '#view-tracker', B.name + ' is no longer marked. ' + why), JSON.stringify(await liveTexts(page, '#view-tracker')));
  }
  clean(g, h, tag + 'covered');
  await h.ctx.close();
}

// ======================= J6 true undo =======================
// The entries compared without updatedAt, which moves forward with every save (merge rules use it); an absent entry is a to-do entry.
const core = (e) => { const o = Object.assign({ status: 'todo', note: '' }, e || {}); delete o.updatedAt; return o; };
async function j6(env, g) {
  const { browser } = env;
  const profile = TXP;
  const sp = modelOf(profile);
  const solo = sp.pool.filter((p) => groupSize(p) === 1);
  const P = solo[5];
  const X = isoDaysAgo(10);
  const seeded = { [P.id]: { status: 'signed-up', note: 'kept note', updatedAt: X, signedUpAt: X } };
  for (const mode of MODES) {
    const tag = mode + ': ';
    const h = await openJ(browser, mode, { profile, entries: seeded });
    const page = h.page;
    await toggleReason(page, 'done');
    const sel = (k) => '#' + ID[k] + P.id;
    const snap0 = await trackerOf(page);
    g.check(tag + 'the seeded entry is signed up ten days ago', snap0[P.id] && snap0[P.id].status === 'signed-up' && snap0[P.id].signedUpAt === X);
    // Received on and off
    await page.locator(sel('received')).check(); await page.waitForTimeout(60);
    const mid = (await trackerOf(page))[P.id];
    g.check(tag + 'Received on: status received and the sign-up date kept', mid.status === 'received' && mid.signedUpAt === X, JSON.stringify(mid));
    await page.locator(sel('received')).uncheck(); await page.waitForTimeout(60);
    let now = await trackerOf(page);
    g.check(tag + 'Received off: the tracker equals the snapshot from before (status, note, sign-up date; updatedAt only moves forward)', JSON.stringify(Object.keys(now)) === JSON.stringify(Object.keys(snap0)) && JSON.stringify(core(now[P.id])) === JSON.stringify(core(snap0[P.id])) && Date.parse(now[P.id].updatedAt) >= Date.parse(snap0[P.id].updatedAt), JSON.stringify(now[P.id]));
    // Not for me on and off
    await page.locator(sel('notForMe')).check(); await page.waitForTimeout(60);
    g.check(tag + 'Not for me on: status skipped', (await statusNow(page, P.id)) === 'skipped');
    await page.locator(sel('notForMe')).uncheck(); await page.waitForTimeout(60);
    now = await trackerOf(page);
    g.check(tag + 'Not for me off: back to signed up with the same sign-up date and note (a true undo, not to do)', JSON.stringify(core(now[P.id])) === JSON.stringify(core(snap0[P.id])), JSON.stringify(now[P.id]));
    // Done off and on again
    await page.locator(sel('done')).uncheck(); await page.waitForTimeout(60);
    g.check(tag + 'Done off: to do', (await statusNow(page, P.id)) === 'todo');
    await page.locator(sel('done')).check(); await page.waitForTimeout(60);
    now = await trackerOf(page);
    g.check(tag + 'Done on again: signed up with the old date (not today)', JSON.stringify(core(now[P.id])) === JSON.stringify(core(snap0[P.id])), JSON.stringify(now[P.id]));
    // Not for me, then Done, then Not for me off: the last tick is not the same box, so the rule is statusAfterTick
    await page.locator(sel('notForMe')).check(); await page.waitForTimeout(60);
    await page.locator(sel('done')).check(); await page.waitForTimeout(60);
    now = await trackerOf(page);
    g.check(tag + 'Not for me, then Done: signed up and the sign-up date is kept', now[P.id].status === 'signed-up' && now[P.id].signedUpAt === X, JSON.stringify(now[P.id]));
    // After a redraw (same visit) the memory is still there (ARCHITECTURE: kept for the visit, forgotten only by a bulk change)
    await page.locator(sel('notForMe')).check(); await page.waitForTimeout(60);
    await redraw(page, h);
    await toggleReason(page, 'notForMe');
    await page.locator(sel('notForMe')).uncheck(); await page.waitForTimeout(60);
    now = await trackerOf(page);
    g.check(tag + 'after a redraw in the same visit the undo still works (back to signed up with the same date)', now[P.id].status === 'signed-up' && now[P.id].signedUpAt === X, JSON.stringify(now[P.id]));
    // After a reload there is no memory: statusAfterTick decides
    await page.locator(sel('notForMe')).check(); await page.waitForTimeout(60);
    await reloadAfterWrite(page);
    await page.waitForSelector('#view-directory article.card');
    await h.showAll();
    await toggleReason(page, 'notForMe');
    g.check(tag + 'after the reload the program is still marked not for me', (await statusNow(page, P.id)) === 'skipped');
    await page.locator(sel('notForMe')).uncheck(); await page.waitForTimeout(60);
    const want = L.statusAfterTick('skipped', 'notForMe', false);
    now = await trackerOf(page);
    g.check(tag + 'after a reload, unticking Not for me gives what statusAfterTick gives (' + want + '), not the status from before the tick', want === 'todo' && (await statusNow(page, P.id)) === want && now[P.id].status === want, JSON.stringify(now[P.id]) + ' want ' + want);
    clean(g, h, tag + 'true undo');
    await h.ctx.close();
  }
  // A fresh program (no entry) that is ticked and unticked ends as a to-do entry, nothing else changed in the store.
  {
    const h = await openJ(browser, 'standalone', { profile, entries: seeded });
    const page = h.page;
    const Q = solo[7];
    const snap = await trackerOf(page);
    await page.locator('#' + ID.done + Q.id).check(); await page.waitForTimeout(60);
    await page.locator('#' + ID.done + Q.id).uncheck(); await page.waitForTimeout(60);
    const now = await trackerOf(page);
    const others = Object.keys(snap);
    g.check('tick then untick on an untouched program leaves it as a to-do entry and every other entry exactly as it was', others.every((k) => JSON.stringify(now[k]) === JSON.stringify(snap[k])) && core(now[Q.id]).status === 'todo' && !core(now[Q.id]).note, JSON.stringify(now[Q.id]));
    await h.ctx.close();
  }
}

// ======================= J7 Tracker =======================
const TAB_NAMES = ['To do', 'Signed up', 'Received', 'Not for me', 'All'];
const readTabs = (page) => page.evaluate(() => [...document.querySelectorAll('#view-tracker button.fx-tab')].map((b) => ({ f: b.dataset.filter, label: b.querySelector('.fx-tab-label').textContent.trim(), n: b.querySelector('.fx-tab-count').textContent.trim(), pressed: b.getAttribute('aria-pressed') })));
const readLeft = (page) => page.evaluate(() => { const l = document.querySelector('#view-tracker .fx-trk-left'); const b = l.querySelector('button'); return { hidden: l.hidden || l.offsetParent === null, text: l.querySelector('p').textContent.replace(/\s+/g, ' ').trim(), btn: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), link: !!l.querySelector('a[data-info-key="state"]') }; });
const rowIds = (page) => page.evaluate(() => [...document.querySelectorAll('#trk-list li.fx-trk-row')].map((r) => r.dataset.id));
const rowNote = (page, id) => page.evaluate((i) => { const e = document.querySelector('#trk-list li.fx-trk-row[data-id="' + i + '"] p.tick-note'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, id);
async function j7(env, g) {
  const { browser } = env;
  const F = fiveReasons();
  for (const mode of MODES) {
    const tag = mode + ': ';
    for (const [name, profile, statuses] of [['Texas, private cover, five reasons', TXP, F.statuses], ['no profile', {}, {}]]) {
      const label = tag + name;
      const h = await openJ(browser, mode, { profile, statuses, hash: 'tracker' });
      const page = h.page;
      const ex = trackerFor({ profile, statuses });
      const tabs = await readTabs(page);
      g.check(label + ': tab labels are To do, Signed up, Received, Not for me, All ("Not for me" has data-filter=skipped), To do pressed', JSON.stringify(tabs.map((t) => t.label)) === JSON.stringify(TAB_NAMES) && tabs[3].f === 'skipped' && tabs.filter((t) => t.pressed === 'true').map((t) => t.f).join() === 'todo', JSON.stringify(tabs));
      g.check(label + ': tab counts equal the model', JSON.stringify(tabs.map((t) => t.n)) === JSON.stringify(['todo', 'signed-up', 'received', 'skipped', 'all'].map((f) => '(' + ex.counts[f] + ')')), JSON.stringify(tabs.map((t) => t.n)));
      const txt = await page.locator('#view-tracker').innerText();
      g.check(label + ': the word "Skipped" is nowhere on the page', !/\bSkipped\b/i.test(txt));
      const left = await readLeft(page);
      const want = leftSentence(ex.sc, !!(profile.state || '').trim());
      g.check(label + ': the left-out line equals trackerScope(...).left worded from it (' + want + ')', want ? !left.hidden && left.text === want && left.btn === 'Show all ' + ex.sc.total + ' programs' && left.pressed === 'false' : left.hidden, JSON.stringify(left) + ' vs ' + want);
      if (!profile.state) g.check(label + ': with no state the line links to My info', left.link === true);
      // the to-do list is what Programs lists as to do
      const todoRows = await rowIds(page);
      const progModel = modelOf(profile, statuses, {});
      const wantTodo = progModel.pool.filter((p) => !progModel.reasons[p.id] && stOf(statuses)(p.id) === 'todo').map((p) => p.id);
      g.check(label + ': the to-do rows (with other ways) are exactly the programs Programs lists that are still to do', sameSet(todoRows, wantTodo), diff(todoRows, wantTodo));
      // Show all N programs / Back to my list
      const prefs0 = await prefsOf(page);
      await page.locator('#view-tracker .fx-trk-left button').click(); await page.waitForTimeout(150);
      const l2 = await readLeft(page);
      const exAll = trackerFor({ profile, statuses, all: true });
      g.check(label + ': Show all N programs: the line says all programs are shown, the button reads Back to my list with aria-pressed true, and the rows equal the model with all switched on', l2.text === 'Showing all ' + ex.sc.total + ' programs, including ones that are not for you.' && l2.btn === 'Back to my list' && l2.pressed === 'true' && sameSet(await rowIds(page), exAll.sc.rows.filter((r) => r.status === 'todo').flatMap((r) => [r.p.id].concat(r.others.map((o) => o.id)))), JSON.stringify(l2));
      g.check(label + ': the show-all switch is not saved', JSON.stringify(await prefsOf(page)) === JSON.stringify(prefs0));
      await reloadAfterWrite(page);
      await page.waitForSelector('#view-tracker button.fx-tab');
      await h.go('tracker');
      const l3 = await readLeft(page);
      g.check(label + ': after a reload the list is the person\'s own again (Show all N programs, not pressed)', l3.text === want && l3.pressed === 'false' && l3.btn === 'Show all ' + ex.sc.total + ' programs', JSON.stringify(l3));
      clean(g, h, label);
      await h.ctx.close();
    }
    // ----- row ticks, notes, moving at the next redraw -----
    {
      const profile = TXP;
      const h = await openJ(browser, mode, { profile, hash: 'tracker' });
      const page = h.page;
      const ex = trackerFor({ profile });
      const lead = ex.secs.now.map((r) => r.p).filter((p) => groupSize(p) === 1);
      const P = lead[0], Q = lead[1], R = lead[2];
      const tid = (k, id) => '#trk-' + k + '-' + id;
      await page.locator(tid('done', P.id)).check(); await page.waitForTimeout(100);
      const row = page.locator('#trk-list li.fx-trk-row[data-id="' + P.id + '"]');
      g.check(tag + 'Tracker: ticking Done leaves the row in place (.fx-moved, data-status signed-up) with the note "Marked done. It is now listed under Signed up. Untick to undo."', (await row.count()) === 1 && (await row.evaluate((li) => li.classList.contains('fx-moved') && li.dataset.status === 'signed-up')) && (await rowNote(page, P.id)) === 'Marked done. It is now listed under Signed up. Untick to undo.', String(await rowNote(page, P.id)));
      g.check(tag + 'Tracker: the live message is "<name> marked done." and no row has a select', await liveHas(page, '#view-tracker', P.name + ' marked done.') && (await page.locator('#trk-list select').count()) === 0, JSON.stringify(await liveTexts(page, '#view-tracker')));
      g.check(tag + 'Tracker: the tab counts moved at once (To do one lower, Signed up one higher) while the row stayed', JSON.stringify((await readTabs(page)).map((t) => t.n)) === JSON.stringify(['todo', 'signed-up', 'received', 'skipped', 'all'].map((f) => '(' + trackerFor({ profile, statuses: { [P.id]: 'signed-up' } }).counts[f] + ')')));
      const dn = await page.evaluate(() => document.querySelector('#view-tracker .fx-progress-text').textContent.replace(/\s+/g, ' ').trim());
      g.check(tag + 'Tracker: the summary says "1 of N done"', /^1 of \d+ done$/.test(dn), dn);
      await page.locator(tid('nfm', Q.id)).check(); await page.waitForTimeout(100);
      g.check(tag + 'Tracker: Not for me gives "Marked not for me. It is now listed under Not for me. Untick to undo." and stores skipped', (await rowNote(page, Q.id)) === 'Marked not for me. It is now listed under Not for me. Untick to undo.' && ((await trackerOf(page))[Q.id] || {}).status === 'skipped', String(await rowNote(page, Q.id)));
      const dn2 = await page.evaluate(() => document.querySelector('#view-tracker .fx-progress-text').textContent.replace(/\s+/g, ' ').trim());
      g.check(tag + 'Tracker: the summary says "(1 not for me)" and the live message says marked not for me', /\(1 not for me\)$/.test(dn2) && await liveHas(page, '#view-tracker', Q.name + ' marked not for me.'), dn2);
      await trkTab(page, 'signed-up');
      const ids2 = await rowIds(page);
      g.check(tag + 'Tracker: after a tab switch the done row is in Signed up (not .fx-moved) and gone from To do', ids2.includes(P.id) && !ids2.includes(Q.id) && (await page.locator('#trk-list li.fx-trk-row[data-id="' + P.id + '"].fx-moved').count()) === 0 && (await rowNote(page, P.id)) === '', ids2.join(',').slice(0, 80));
      await page.locator(tid('rcv', P.id)).check(); await page.waitForTimeout(100);
      g.check(tag + 'Tracker: Received in the Signed up tab: "Marked received. It is now listed under Received. Untick to undo."', (await rowNote(page, P.id)) === 'Marked received. It is now listed under Received. Untick to undo.', String(await rowNote(page, P.id)));
      await page.locator(tid('rcv', P.id)).uncheck(); await page.locator(tid('done', P.id)).uncheck(); await page.waitForTimeout(100);
      g.check(tag + 'Tracker: Done off in the Signed up tab: "No longer marked. It is now listed under To do. Tick it again to undo."', (await rowNote(page, P.id)) === 'No longer marked. It is now listed under To do. Tick it again to undo.' && await liveHas(page, '#view-tracker', P.name + ' is back on your list.'), String(await rowNote(page, P.id)));
      await trkTab(page, 'all');
      await page.locator(tid('done', R.id)).check(); await page.waitForTimeout(100);
      g.check(tag + 'Tracker: in the All tab the note has no "listed under" part: "Marked done. Untick to undo."', (await rowNote(page, R.id)) === 'Marked done. Untick to undo.', String(await rowNote(page, R.id)));
      clean(g, h, tag + 'tracker ticks');
      await h.ctx.close();
    }
    await coveredCase(browser, mode, 'tracker', g);
    // ----- a to-do row that would be left out: the note and the live message say why -----
    for (const [name, profile] of [['state set', TXP], ['no state', {}]]) {
      const other = ALL.filter((p) => L.hiddenByState(p, profile.state || '') && groupSize(p) === 1)[0];
      const h = await openJ(browser, mode, { profile, statuses: { [other.id]: 'signed-up' }, hash: 'tracker' });
      const page = h.page;
      await trkTab(page, 'signed-up');
      await page.locator('#trk-done-' + other.id).uncheck(); await page.waitForTimeout(100);
      const why = profile.state ? 'It is for another state, so it will be left out of your list.' : 'It is only for some states, so it will be left out of your list until you add your state in My info.';
      g.check(tag + name + ': Done off on an other-state program: note "No longer marked. ' + why + ' Tick it again to undo."', (await rowNote(page, other.id)) === 'No longer marked. ' + why + ' Tick it again to undo.', String(await rowNote(page, other.id)));
      g.check(tag + name + ': the live message is "<name> is no longer marked. ' + why + '"', await liveHas(page, '#view-tracker', other.name + ' is no longer marked. ' + why), JSON.stringify(await liveTexts(page, '#view-tracker')));
      await trkTab(page, 'todo');
      g.check(tag + name + ': at the next redraw it is not in the To do list', !(await rowIds(page)).includes(other.id));
      clean(g, h, tag + name + ' left out');
      await h.ctx.close();
    }
  }
}

// ======================= J8 Do it for me =======================
const pickIds = (page) => page.evaluate(() => [...document.querySelectorAll('#view-guided ul.fx-pick input[type=checkbox]')].map((c) => ({ id: c.id.replace('gd-pick-', ''), on: c.checked })));
async function j8(env, g) {
  const { browser } = env;
  const F = fiveReasons();
  for (const mode of MODES) {
    const tag = mode + ': ';
    for (const [name, profile, statuses] of [['Texas, private cover, five reasons', TXP, F.statuses], ['no profile', {}, {}], ['Texas, Medicaid and WIC', PROFILES[2][1], {}]]) {
      const label = tag + name;
      const h = await openJ(browser, mode, { profile, statuses, hash: 'guided' });
      const page = h.page;
      const hasState = !!(profile.state || '').trim();
      const sp = modelOf(profile, statuses, {});
      const rows = await pickIds(page);
      g.check(label + ': the setup list is exactly the programs the model does not hide', sameSet(rows.map((r) => r.id), ids(sp.pool)), diff(rows.map((r) => r.id), ids(sp.pool)));
      const left = await page.locator('#view-guided p.fx-small.gd-left').evaluateAll((els) => els.map((e) => ({ text: e.textContent.replace(/\s+/g, ' ').trim(), prog: !!e.querySelector('a[href="#directory"]'), info: !!e.querySelector('a[data-info-key="state"]') })));
      const want = 'Left out of this list: ' + L.hideCountsText(sp.counts, hasState) + '. To include any of them, show them on the Programs page and start the run from there.' + (!hasState && sp.counts.otherState ? ' Add your state in My info to see the ones for you.' : '');
      g.check(label + ': the left-out line has the module counts (' + L.hideCountsText(sp.counts, hasState) + ') and links to the Programs page' + (hasState ? '' : ' and My info'), left.length === 1 && left[0].text === want && left[0].prog && left[0].info === (!hasState && sp.counts.otherState > 0), JSON.stringify(left) + ' vs ' + want);
      const on = rows.filter((r) => r.on).length;
      const startText = norm(await page.getByRole('button', { name: /^Start \(/ }).innerText());
      g.check(label + ': the start button reads "Start (N program[s])" for the ticked programs', startText === 'Start (' + on + ' program' + (on === 1 ? '' : 's') + ')' && on > 0, startText);
      clean(g, h, label);
      await h.ctx.close();
    }
  }
  // ----- a run: buttons, Not for me stores skipped, Undo restores, Start over asks in the page -----
  for (const mode of MODES) {
    const tag = mode + ': ';
    const profile = TXP;
    const h = await openJ(browser, mode, { profile, hash: 'guided' });
    const page = h.page;
    const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await page.getByRole('button', { name: 'Select none' }).click();
    const sp = modelOf(profile);
    const pick = sp.pool.filter((p) => groupSize(p) === 1 && !['conditional', 'longshot'].includes(L.verdict(p))).slice(0, 3);
    for (const p of pick) { await revealPick(page, p.id); await page.locator('#gd-pick-' + p.id).check(); }
    g.check(tag + 'three programs ticked: the start button says Start (3 programs)', norm(await page.getByRole('button', { name: /^Start \(/ }).innerText()) === 'Start (3 programs)');
    await page.getByRole('button', { name: /^Start \(/ }).click(); await page.waitForTimeout(200);
    const names = await page.locator('#view-guided .fx-actionbar-row button').allInnerTexts();
    g.check(tag + 'the run buttons are Done, Not for me, Problem, Back (no Skip)', JSON.stringify(names.map(norm)) === JSON.stringify(['Done', 'Not for me', 'Problem', 'Back']) && (await page.getByRole('button', { name: 'Skip', exact: true }).count()) === 0, JSON.stringify(names));
    if (mode === 'standalone') g.check(tag + 'the checkbox reads "When I tap Done or Not for me, open the next sign-up page"', (await page.getByLabel('When I tap Done or Not for me, open the next sign-up page', { exact: true }).count()) === 1);
    // The run would open the next sign-up page in a new tab after Done or Not for me; this check is about the statuses, so the option is turned off (the app's own tab opening is covered by group 4).
    if (mode === 'standalone') { const ao = page.getByLabel('When I tap Done or Not for me, open the next sign-up page', { exact: true }); await ao.uncheck(); g.check(tag + 'the checkbox can be turned off', !(await ao.isChecked())); }
    const snap = JSON.stringify(await trackerOf(page));
    // the program the run is on: the first ticked, in rank order
    const firstId = L.rankPrograms(pick)[0].id;
    await page.getByRole('button', { name: 'Not for me', exact: true }).click(); await page.waitForTimeout(150);
    const e1 = (await trackerOf(page))[firstId];
    g.check(tag + 'Not for me in a run stores the status skipped', e1 && e1.status === 'skipped', JSON.stringify(e1));
    g.check(tag + 'the message says "<name> marked not for me."', (await liveTexts(page, '#view-guided')).some((t) => t.startsWith(byId[firstId].name + ' marked not for me.')), JSON.stringify(await liveTexts(page, '#view-guided')).slice(0, 200));
    await page.getByRole('button', { name: /^Undo/ }).click(); await page.waitForTimeout(150);
    const after = JSON.stringify(await trackerOf(page));
    g.check(tag + 'Undo restores the tracker exactly as it was before the tap', after === snap, after.slice(0, 160) + ' vs ' + snap.slice(0, 160));
    await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.waitForTimeout(150);
    g.check(tag + 'Done in a run stores signed-up and the message says "marked as signed up."', ((await trackerOf(page))[firstId] || {}).status === 'signed-up' && (await liveTexts(page, '#view-guided')).some((t) => t.startsWith(byId[firstId].name + ' marked as signed up.')));
    await page.getByRole('button', { name: /^Undo/ }).click(); await page.waitForTimeout(150);
    g.check(tag + 'Undo after Done also restores the tracker exactly', JSON.stringify(await trackerOf(page)) === snap);
    // Start over asks in the page
    await page.getByRole('button', { name: 'Start over' }).click(); await page.waitForTimeout(120);
    const conf = await page.locator('#view-guided .fx-confirm').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    g.check(tag + 'Start over asks in the page: "Start over? Your place in this run is lost. Statuses you already set are kept." and opens no dialog', conf.length === 1 && conf[0].includes('Start over? Your place in this run is lost. Statuses you already set are kept.') && dialogs.length === 0, JSON.stringify(conf));
    clean(g, h, tag + 'run');
    await h.ctx.close();
  }
  // ----- handed over on purpose: stays selected though hidden, until its status changes -----
  for (const mode of MODES) {
    const tag = mode + ': ';
    const h = await openJ(browser, mode, { profile: TXP });
    const page = h.page;
    await toggleReason(page, 'otherState');
    const sp = modelOf(TXP, {}, { otherState: true });
    const btn = page.getByRole('button', { name: /^Start a guided run with these/ });
    g.check(tag + 'Programs with the other states shown: "Start a guided run with these N" counts every listed program', norm(await btn.innerText()) === 'Start a guided run with these ' + sp.pool.length, norm(await btn.innerText()));
    await btn.click();
    await page.waitForSelector('#view-guided:not([hidden])'); await page.waitForTimeout(200);
    const rows = await pickIds(page);
    const osIds = ALL.filter((p) => L.hiddenByState(p, 'TX')).map((p) => p.id);
    g.check(tag + 'the other-state programs handed over are listed and selected although the rule hides them', osIds.every((id) => rows.some((r) => r.id === id && r.on)) && sameSet(rows.filter((r) => r.on).map((r) => r.id), ids(sp.pool)), 'selected ' + rows.filter((r) => r.on).length + ' vs ' + sp.pool.length);
    const gone = osIds[0], kept = osIds[1];
    await page.evaluate((i) => BFF.tracker.setStatus(i, 'signed-up'), gone);
    await h.go('info'); await h.go('guided'); await page.waitForTimeout(200);
    const rows2 = await pickIds(page);
    g.check(tag + 'after one of them is marked done it leaves the list and the selection, and the others stay selected', !rows2.some((r) => r.id === gone) && rows2.some((r) => r.id === kept && r.on) && osIds.filter((id) => id !== gone).every((id) => rows2.some((r) => r.id === id && r.on)), 'rows ' + rows2.length);
    clean(g, h, tag + 'handed over');
    await h.ctx.close();
  }
}

// ======================= J9 the three pages agree =======================
async function j9(env, g) {
  const { browser } = env;
  const F = fiveReasons();
  const solo = modelOf(TXP).pool.filter((p) => groupSize(p) === 1);
  const mixed = (profile) => {
    const pool = modelOf(profile).pool.filter((p) => groupSize(p) === 1);
    return { [PUMP]: 'signed-up', [pool[0].id]: 'signed-up', [pool[1].id]: 'received', [pool[2].id]: 'skipped' };
  };
  const cases = [];
  for (const [name, profile] of PROFILES) { cases.push(['standalone', name + ', nothing marked', profile, {}]); cases.push(['standalone', name + ', pump group and three programs marked', profile, mixed(profile)]); }
  cases.push(['artifact', 'Texas, private cover, five reasons', TXP, F.statuses]);
  cases.push(['artifact', 'empty, nothing marked', {}, {}]);
  let sawCovered = 0;
  for (const [mode, name, profile, statuses] of cases) {
    const label = mode + ' ' + name;
    const h = await openJ(browser, mode, { profile, statuses });
    const page = h.page;
    const hasState = !!(profile.state || '').trim();
    const sp = modelOf(profile, statuses, {});
    // Programs: what is listed, and the numbers per reason in its box
    const listed = await cardIds(page);
    const box = await hiddenBoxState(page);
    const cnt = Object.fromEntries(box.lines.map((l) => [l.reason, parseInt(l.text, 10)]));
    const todoIds = ALL.filter((p) => stOf(statuses)(p.id) === 'todo').map((p) => p.id);
    // Tracker: the to-do list and the left-out numbers
    await h.go('tracker');
    const trkTodo = await rowIds(page);
    const tl = await readLeft(page);
    const ex = trackerFor({ profile, statuses });
    // Do it for me: the setup list and the left-out line
    await h.go('guided');
    const picks = (await pickIds(page)).map((r) => r.id);
    const gl = await page.locator('#view-guided p.fx-small.gd-left').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    const todoListed = todoIds.filter((id) => listed.includes(id));
    g.check(label + ': a to-do program is on the Tracker\'s to-do list exactly when Programs lists it', sameSet(trkTodo, todoListed), diff(trkTodo, todoListed));
    g.check(label + ': a to-do program is in Do it for me\'s setup list exactly when Programs lists it', sameSet(picks.filter((id) => todoIds.includes(id)), todoListed), diff(picks.filter((id) => todoIds.includes(id)), todoListed));
    const marked = ALL.filter((p) => stOf(statuses)(p.id) !== 'todo').map((p) => p.id);
    g.check(label + ': a marked program is not listed on Programs and not in Do it for me\'s setup list', marked.every((id) => !listed.includes(id) && !picks.includes(id)), marked.filter((id) => listed.includes(id) || picks.includes(id)).join(','));
    g.check(label + ': Programs and Do it for me list exactly the same programs', sameSet(picks, listed), diff(picks, listed));
    // reasons: one per hidden program, the same number everywhere
    const hiddenIds = ALL.map((p) => p.id).filter((id) => !listed.includes(id));
    const modelReasons = {};
    hiddenIds.forEach((id) => { const r = sp.reasons[id]; modelReasons[r] = (modelReasons[r] || 0) + 1; });
    g.check(label + ': the programs left off Programs, counted by the module\'s reason, equal the numbers in its box', L.HIDE_REASONS.every((r) => (modelReasons[r] || 0) === (cnt[r] || 0)), JSON.stringify(modelReasons) + ' vs ' + JSON.stringify(cnt));
    g.check(label + ': the Tracker\'s left-out numbers (other state, ruled out, covered) are the same three numbers', tl.text === leftSentence(ex.sc, hasState) && (ex.sc.left.otherState === (cnt.otherState || 0)) && (ex.sc.left.noFit === (cnt.noFit || 0)) && (ex.sc.left.covered === (cnt.covered || 0)), JSON.stringify(ex.sc.left) + ' vs ' + JSON.stringify(cnt));
    const wantGd = L.hideCountsText(Object.fromEntries(L.HIDE_REASONS.map((r) => [r, cnt[r] || 0])), hasState);
    g.check(label + ': Do it for me says it left out the same numbers, in the same words', gl.length === 1 && gl[0].startsWith('Left out of this list: ' + wantGd + '. '), gl[0] + ' vs ' + wantGd);
    if (statuses[PUMP]) {
      const alts = ALL.filter((p) => p.sameAs === PUMP).map((p) => p.id);
      const coveredAlts = alts.filter((id) => sp.reasons[id] === 'covered');
      sawCovered += coveredAlts.length;
      g.check(label + ': the other ways to the signed-up pump (' + alts.length + ') that nothing else hides are covered: not listed on Programs, not in the Tracker\'s to-do list, not in Do it for me', (cnt.covered || 0) === coveredAlts.length && ex.sc.left.covered === coveredAlts.length && coveredAlts.every((id) => !listed.includes(id) && !trkTodo.includes(id) && !picks.includes(id)), JSON.stringify(cnt) + ' alts covered ' + coveredAlts.length);
    }
    clean(g, h, label);
    await h.ctx.close();
  }
  g.check('at least one case really had covered programs (the pump group), so the covered rule was compared on all three pages', sawCovered > 0, String(sawCovered));
}

// ======================= J10 failed saves =======================
async function j10(env, g) {
  const { browser } = env;
  const ROUTES = ['directory', 'info', 'tracker', 'guided', 'safety'];
  for (const mode of MODES) {
    const tag = mode + ': ';
    const profile = TXP;
    const sp = modelOf(profile);
    const solo = sp.pool.filter((p) => groupSize(p) === 1);
    const P = solo[3], Q = solo[9];
    const h = await openJ(browser, mode, { profile, statuses: { [Q.id]: 'signed-up' } });
    const page = h.page;
    const snapshot = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    g.check(tag + 'the notice is hidden before anything fails', !(await page.locator('#storage-notice').isVisible()));
    await page.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
    await page.locator('#' + ID.done + P.id).check(); await page.waitForTimeout(120);
    const t = await cardTicks(page, P.id);
    g.check(tag + 'the tick still counts in the page (status signed-up, card is a strip)', (await statusNow(page, P.id)) === 'signed-up' && t.done && t.ticked, JSON.stringify(t));
    g.check(tag + 'the card note adds the could-not-be-saved sentence', t.note === 'Marked done. It will be hidden from this list. Untick to undo. ' + SAVE_FAIL_CARD, t.note);
    g.check(tag + 'the live message adds it too', await liveHas(page, '#view-directory', P.name + ' marked done. ' + SAVE_FAIL_CARD), JSON.stringify(await liveTexts(page, '#view-directory')));
    for (const r of ROUTES) {
      await h.go(r);
      const n = page.locator('#storage-notice');
      g.check(tag + '#' + r + ': #storage-notice is visible with the exact text', (await n.isVisible()) && norm(await n.innerText()) === NOTICE, norm(await n.innerText()));
    }
    // a tick on a Tracker row while storage still fails
    await h.go('tracker');
    await trkTab(page, 'all');
    await page.locator('#trk-nfm-' + solo[11].id).check(); await page.waitForTimeout(120);
    g.check(tag + 'Tracker: a tick still counts (skipped) and its note adds the Tracker\'s could-not-save sentence', (await statusNow(page, solo[11].id)) === 'skipped' && ((await rowNote(page, solo[11].id)) || '').endsWith(SAVE_FAIL_TRK), String(await rowNote(page, solo[11].id)));
    g.check(tag + 'nothing was written while it failed (localStorage equals the snapshot)', JSON.stringify(await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })) === JSON.stringify(snapshot));
    await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
    await guardedReload(page);
    await page.waitForSelector('.view:not([hidden])');
    await sleep(200);
    g.check(tag + 'after the reload the failed ticks are gone (they were never saved)', (await statusNow(page, P.id)) === 'todo' && (await statusNow(page, solo[11].id)) === 'todo' && (await statusNow(page, Q.id)) === 'signed-up');
    g.check(tag + 'after the reload nothing else was lost: every stored key equals the snapshot', JSON.stringify(await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })) === JSON.stringify(snapshot));
    g.check(tag + 'after the reload the notice is hidden again', !(await page.locator('#storage-notice').isVisible()));
    await h.go('directory');
    await verifyPrograms(g, tag + 'after the failed-save visit, Programs equals the model for the saved statuses', page, profile, { [Q.id]: 'signed-up' }, {});
    clean(g, h, tag + 'failed saves');
    await h.ctx.close();
  }
}

export async function phaseJ(env) {
  const sub = process.env.BFF_E2E_SUB ? process.env.BFF_E2E_SUB.split(',') : null;
  const part = async (id, title, fn) => { if (!sub || sub.includes(id)) await runGroup(id + ' ' + title, (g) => fn(env, g)); };
  await part('J1', 'Phase J Programs: hidden by default for four profiles, the box, the numbers, the due-date buttons', j1);
  await part('J2', 'Phase J Programs: Show and Hide per reason, names, (shown for now), focus, "Nothing is hidden right now"', j2);
  await part('J3', 'Phase J Programs: the choice is never saved, a reload hides again, old saved choices change nothing', j3);
  await part('J4', 'Phase J Programs: the box ignores search, filters and tabs; the empty-state line (one and several)', j4);
  await part('J5', 'Phase J Programs cards: tick boxes, every status path, strip, note, live message, redraw, keyboard', j5);
  await part('J6', 'Phase J true undo: the sign-up date and note come back; after a reload statusAfterTick applies', j6);
  await part('J7', 'Phase J Tracker: tabs, ticks, notes, left-out line, Show all, rows move at the next redraw', j7);
  await part('J8', 'Phase J Do it for me: setup list, left-out line, run buttons, Not for me and Undo, handed-over programs', j8);
  await part('J9', 'Phase J the three pages agree on what is hidden and why', j9);
  await part('J10', 'Phase J failed saves: the tick holds for the visit, the notice on every page, a reload loses only the unsaved ticks', j10);
}
