// Group 14: Phase I. The Tracker as the person's own to-do list, the shorter Do it for me list, and the missing-info
// lines, notices, hints and hand-off to My info. Both outputs, 390 wide, plus 320 wide for layout.
import {
  PROGRAMS, open, clean, runGroup, lsDump, seedStore, trackerSeed, openFold, foldOpen, trkTab, openRowDetails,
  settleScroll, contrast, sleep, reloadAfterWrite
} from './harness.mjs';
import {
  L, ALL, byId, isoInDays, trackerFor, doneText, claimText, missLineFor, countsFor, keysWithCount, withLine, statusFn, MISSING_KEYS
} from './model.mjs';

// ---- synthetic people ----
const JANE = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address1: '123 Main St', city: 'Austin', state: 'TX', zip: '78701' };
const FULL = Object.assign({}, JANE, { cover: 'private', lowIncome: 'no', job: 'yes' });
const FULL_I = Object.assign({}, FULL, { insurer: 'Aetna' });
const NAME_ONLY = { firstName: 'Jane' }; // not empty, so Do it for me shows its notice, and no state yet
const PROFILES = [['empty', {}], ['state only', { state: 'TX' }], ['full sample', FULL], ['full sample + insurer', FULL_I]];
const MODES = ['standalone', 'artifact'];

async function openP(browser, mode, o = {}) {
  const seed = {};
  if (o.prefs) Object.assign(seed, seedStore('prefs', o.prefs));
  if (o.statuses) Object.assign(seed, seedStore('tracker', trackerSeed(o.statuses)));
  return open(browser, { mode, viewport: o.vp, scheme: o.scheme, profile: o.profile || {}, seed, hash: o.hash || 'tracker', all: false });
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const idsOf = (rows) => rows.map((r) => r.p.id);
const TAB_LABELS = { todo: 'To do', 'signed-up': 'Signed up', received: 'Received', skipped: 'Not for me', all: 'All' };
const EMPTY = {
  todo: 'Nothing left to do. Everything on your list is signed up, received or marked not for me.',
  'signed-up': 'Nothing signed up yet. Tick Done on a program after you sign up.',
  received: 'Nothing marked received yet.',
  skipped: 'Nothing marked not for me.',
  all: 'Nothing here yet.'
};

// ---- A. what the Tracker shows ----
const readTrk = (page) => page.evaluate(() => {
  const txt = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const list = document.getElementById('trk-list');
  const secs = [...list.querySelectorAll(':scope > [data-sec]')].map((s) => {
    const rows = [...s.querySelectorAll(':scope > ul > li.fx-trk-row')];
    return {
      sec: s.dataset.sec, tag: s.tagName, open: s.tagName === 'DETAILS' ? s.open : null, title: txt(s.querySelector('.fx-trk-sec-title')),
      count: txt(s.querySelector('.fx-trk-count')), ids: rows.map((li) => li.dataset.id), status: rows.map((li) => li.dataset.status),
      moved: rows.map((li) => li.classList.contains('fx-moved')),
      line3: rows.map((li) => txt(li.querySelector(':scope > .fx-trk-main .fx-trk-line3'))),
      others: rows.map((li) => [...li.querySelectorAll(':scope > details.fx-trk-others > ul > li.fx-trk-row')].map((x) => x.dataset.id)),
      othersText: rows.map((li) => txt(li.querySelector(':scope > details.fx-trk-others > summary')))
    };
  });
  const left = document.querySelector('#view-tracker .fx-trk-left');
  const prog = document.querySelector('#view-tracker progress');
  return {
    secs, tab: list.getAttribute('data-tab'), empty: txt(list.querySelector(':scope > .fx-trk-empty')),
    summary: txt(document.querySelector('#view-tracker .fx-progress-text')), bar: prog ? { max: prog.max, value: prog.value } : null,
    claim: txt(document.getElementById('trk-toclaim')),
    tabs: [...document.querySelectorAll('#view-tracker button.fx-tab')].map((b) => ({ f: b.dataset.filter, label: txt(b.querySelector('.fx-tab-label')), n: txt(b.querySelector('.fx-tab-count')), pressed: b.getAttribute('aria-pressed') })),
    left: { hidden: left.hidden || left.offsetParent === null, text: txt(left.querySelector('p')), btn: txt(left.querySelector('button')), pressed: left.querySelector('button').getAttribute('aria-pressed') },
    live: txt(document.querySelector('#view-tracker [role=status].fx-sr'))
  };
});

// The "Left out of your list" sentence, worded from the module's counts (see ARCHITECTURE.md, Phase I).
export function leftSentence(sc, hasState) {
  const l = sc.left, parts = [];
  let first = true;
  const noun = (n) => { const t = first ? plural(n, 'program') : String(n); first = false; return t; };
  if (l.otherState) parts.push(hasState ? noun(l.otherState) + ' for other states' : noun(l.otherState) + ' only for some states (add your state in My info)');
  if (l.noFit) parts.push(noun(l.noFit) + ' that your answers in My info rule out');
  if (l.covered) parts.push(l.covered + ' other ' + (l.covered === 1 ? 'way' : 'ways') + ' to get something you already signed up for');
  return parts.length ? 'Left out of your list: ' + parts.join(', ') + '.' : '';
}

// Compare everything the Tracker shows with what the module and the data say. o: {profile, prefs, statuses, all, tab, soft}.
// soft: the page was changed with a row's own control, so rows have not moved; only the numbers are compared.
async function verifyTracker(g, label, page, o) {
  const tab = o.tab || 'todo';
  const ex = trackerFor(o);
  const d = await readTrk(page);
  const c = ex.counts;
  g.check(label + ': summary reads "X of N done"', d.summary === doneText(c), d.summary + ' vs ' + doneText(c));
  g.check(label + ': progress bar equals done and active', d.bar && Number(d.bar.max) === Math.max(c.active, 1) && Number(d.bar.value) === Math.min(c.done, Math.max(c.active, 1)), JSON.stringify(d.bar));
  g.check(label + ': "Still to claim" line equals L.toClaim', d.claim === claimText(ex.sc, ex.secs), d.claim + ' vs ' + claimText(ex.sc, ex.secs));
  g.check(label + ': tab counts equal the rows by status', eq(d.tabs.map((t) => [t.f, t.n]), ['todo', 'signed-up', 'received', 'skipped', 'all'].map((f) => [f, '(' + c[f] + ')'])), JSON.stringify(d.tabs.map((t) => t.f + t.n)));
  g.check(label + ': tab labels and the pressed tab', eq(d.tabs.map((t) => t.label), ['To do', 'Signed up', 'Received', 'Not for me', 'All']) && d.tabs.filter((t) => t.pressed === 'true').map((t) => t.f).join() === tab, JSON.stringify(d.tabs.map((t) => t.label + t.pressed)));
  g.check(label + ': list says which tab it shows', d.tab === tab, d.tab);
  const left = leftSentence(ex.sc, !!String(o.profile && o.profile.state || '').trim());
  const anyLeft = !!left;
  if (o.all) {
    g.check(label + ': show-all line says all programs are shown', !d.left.hidden && d.left.text === 'Showing all ' + ex.sc.total + ' programs, including ones that are not for you.' && d.left.btn === 'Back to my list' && d.left.pressed === 'true', JSON.stringify(d.left));
  } else if (anyLeft) {
    g.check(label + ': left-out line has the module counts', !d.left.hidden && d.left.text === left, d.left.text + ' vs ' + left);
    g.check(label + ': button says Show all N programs', d.left.btn === 'Show all ' + ex.sc.total + ' programs' && d.left.pressed === 'false', d.left.btn);
  } else g.check(label + ': nothing left out, so the left-out line is hidden', d.left.hidden, JSON.stringify(d.left));
  const by = Object.fromEntries(d.secs.map((s) => [s.sec, s]));
  if (o.soft) {
    // rows stay put; only the section numbers follow
    const want = tab === 'todo' ? { now: ex.secs.now.length, later: ex.secs.later.length, optional: ex.secs.optional.length } : { all: tab === 'all' ? c.all : c[tab] };
    for (const k of Object.keys(want)) if (by[k]) g.check(label + ': "' + k + '" title count follows the change', by[k].count === '(' + want[k] + ')', by[k].count + ' vs ' + want[k]);
    return d;
  }
  if (tab === 'todo') {
    if (!c.todo) { g.check(label + ': empty to-do message', d.empty === EMPTY.todo && d.secs.length === 0, d.empty); return d; }
    const t = [['now', 'Do now', ex.secs.now], ['later', 'Later', ex.secs.later], ['optional', 'Only if you would buy anyway, and long shots', ex.secs.optional]];
    g.check(label + ': sections are Do now, Later (if any), optional (if any), in that order', eq(d.secs.map((s) => s.sec), t.filter(([k, , rows]) => k === 'now' || rows.length).map(([k]) => k)), d.secs.map((s) => s.sec).join());
    for (const [k, title, rows] of t) {
      const s = by[k];
      if (!s) { g.check(label + ': no "' + k + '" section only when it has no rows', k !== 'now' && rows.length === 0); continue; }
      g.check(label + ': ' + k + ' rows equal trackerSections ids and order', eq(s.ids, idsOf(rows)), s.ids.length + ' on the page vs ' + rows.length + ' expected; first diff ' + s.ids.findIndex((x, i) => x !== idsOf(rows)[i]));
      g.check(label + ': ' + k + ' title is "' + title + ' (N)"', s.title === title + ' (' + rows.length + ')', s.title);
      g.check(label + ': ' + k + ' rows are all to do', s.status.every((x) => x === 'todo'));
      g.check(label + ': ' + k + ' other ways sit under their lead row, in rank order', eq(s.others, rows.map((r) => r.others.map((p) => p.id))) && s.othersText.every((tx, i) => (rows[i].others.length ? tx === (rows[i].others.length === 1 ? '1 more way to get the same thing' : rows[i].others.length + ' more ways to get the same thing') : tx === null)), JSON.stringify(s.others.filter((x) => x.length)).slice(0, 120));
    }
    if (by.optional) g.check(label + ': the optional section is a closed details by default', by.optional.tag === 'DETAILS' && by.optional.open === false || o.optionalOpen === true);
    if (by.later) g.check(label + ': every Later row carries its timing tag', by.later.line3.every((tx, i) => tx === (L.WHEN_LABELS[ex.secs.later[i].p.when] || null)), by.later.line3.slice(0, 3).join(' | '));
    const lateFirst = ex.secs.later.map((r) => r.p.when === 'late-pregnancy');
    g.check(label + ': Later puts late-pregnancy programs before the rest', lateFirst.every((v, i) => !v || lateFirst.slice(0, i).every(Boolean)));
    g.check(label + ': Do now only holds programs ready now (weeks ' + ex.weeks + ')', ex.secs.now.every((r) => L.readyNow(r.p, ex.weeks)) && ex.secs.later.every((r) => !L.readyNow(r.p, ex.weeks)));
    const optionalOnly = ex.secs.optional.every((r) => ['conditional', 'longshot'].includes(L.verdict(r.p))) && ex.secs.now.concat(ex.secs.later).every((r) => !['conditional', 'longshot'].includes(L.verdict(r.p)));
    g.check(label + ': the optional section holds exactly the conditional and long-shot programs', optionalOnly);
  } else {
    const rows = ex.sc.rows.filter((r) => tab === 'all' || r.status === tab);
    if (!rows.length) { g.check(label + ': empty "' + tab + '" message', d.empty === EMPTY[tab] && d.secs.length === 0, d.empty); return d; }
    const s = by.all;
    g.check(label + ': one flat section in rank order', !!s && d.secs.length === 1 && eq(s.ids, idsOf(rows)), s ? s.ids.length + ' vs ' + rows.length : 'no section');
    g.check(label + ': title "' + TAB_LABELS[tab] + ' (N)"', !!s && s.title === TAB_LABELS[tab] + ' (' + rows.length + ')', s && s.title);
    if (s) g.check(label + ': row statuses', eq(s.status, rows.map((r) => r.status)));
  }
  return d;
}

async function trackerChecks(env, g) {
  const { browser } = env;
  const dueFar = isoInDays(150), dueNear = isoInDays(28), duePast = isoInDays(-10);
  const cases = [];
  for (const mode of MODES) for (const [name, profile] of PROFILES) cases.push([mode, name, profile, {}]);
  [['due in 150 days', dueFar], ['due in 4 weeks', dueNear], ['due date passed', duePast]].forEach(([n, due]) => cases.push(['standalone', 'full sample, ' + n, Object.assign({}, FULL, { dueDate: due }), {}]));
  // a group already signed up for, and a not-for-me and a received program: the covered rule and the other tabs
  const grp = L.collapseGroups(L.rankPrograms(ALL)).find((x) => x.others.length > 0 && !L.hiddenByState(x.lead, 'TX') && !x.others.some((o) => L.hiddenByState(o, 'TX')) && !L.hiddenByAnswers(x.lead, FULL, 'todo'));
  const some = L.rankPrograms(ALL).filter((p) => !L.hiddenByState(p, 'TX') && !L.hiddenByAnswers(p, FULL, 'todo') && L.groupKey(p) !== L.groupKey(grp.lead));
  const statuses = { [grp.lead.id]: 'signed-up', [some[0].id]: 'received', [some[1].id]: 'skipped', [some[2].id]: 'signed-up' };
  for (const mode of MODES) cases.push([mode, 'full sample with a signed up group, a received and a not-for-me program', FULL, { statuses }]);
  // Phase J: the old saved Programs choices are gone. The app neither reads nor writes them, so the Tracker must equal the model without them.
  cases.push(['standalone', 'full sample, old saved Programs preferences (showOtherStates, showNoFit) change nothing', FULL, { prefs: { showOtherStates: true, showNoFit: true } }]);

  for (const [mode, name, profile, extra] of cases) {
    const label = mode + ' ' + name;
    const h = await openP(browser, mode, { profile, statuses: extra.statuses, prefs: extra.prefs });
    const page = h.page;
    const o = { profile, prefs: extra.prefs || {}, statuses: extra.statuses || {} };
    await verifyTracker(g, label + ' (To do)', page, Object.assign({ tab: 'todo' }, o));
    if (extra.statuses || /^standalone full sample/.test(label)) {
      for (const tab of ['signed-up', 'received', 'skipped', 'all']) {
        await trkTab(page, tab);
        await verifyTracker(g, label + ' (' + TAB_LABELS[tab] + ' tab)', page, Object.assign({ tab }, o));
      }
      await trkTab(page, 'todo');
    }
    // "Show all N programs" and "Back to my list"
    const ex = trackerFor(o);
    const anyLeft = ex.sc.left.otherState + ex.sc.left.noFit + ex.sc.left.covered > 0;
    if (anyLeft && (mode === 'standalone' || extra.statuses)) {
      const btn = page.locator('#view-tracker .fx-trk-left button');
      await btn.click();
      await verifyTracker(g, label + ' after Show all', page, Object.assign({ tab: 'todo', all: true }, o));
      g.check(label + ': the Back to my list button replaced it', norm(await btn.textContent()) === 'Back to my list');
      await btn.click();
      await verifyTracker(g, label + ' after Back to my list', page, Object.assign({ tab: 'todo' }, o));
    }
    clean(g, h, label);
    await h.ctx.close();
  }
}

async function trackerBehaviour(env, g) {
  const { browser } = env;
  for (const mode of MODES) {
    const label = mode + ' tracker';
    const profile = FULL;
    // ---- a status change through a row's own tick box leaves the row in place ----
    {
      const h = await openP(browser, mode, { profile });
      const page = h.page;
      const ex0 = trackerFor({ profile });
      const lead = ex0.secs.now.find((r) => r.others.length) || ex0.secs.now[0];
      const id = lead.p.id;
      const before = await readTrk(page);
      const secIdx = before.secs.find((s) => s.ids.includes(id));
      const idx = secIdx.ids.indexOf(id);
      await page.locator('#trk-done-' + id).check();
      await page.waitForTimeout(150);
      const o = { profile, statuses: { [id]: 'signed-up' } };
      const d = await verifyTracker(g, label + ' after marking ' + id + ' Signed up (row stays)', page, Object.assign({ soft: true }, o));
      const sec = d.secs.find((s) => s.ids.includes(id));
      g.check(label + ': the row stays where it was', !!sec && sec.sec === secIdx.sec && sec.ids.indexOf(id) === idx && eq(sec.ids, secIdx.ids), sec && sec.ids.indexOf(id) + ' vs ' + idx);
      const r = await page.locator('#trk-list li.fx-trk-row[data-id="' + id + '"]').evaluate((li) => ({ moved: li.classList.contains('fx-moved'), status: li.dataset.status, done: li.querySelector('input[data-tick="done"]').checked, hasSelect: !!li.querySelector('select'), note: li.querySelector('p.tick-note').textContent.replace(/\s+/g, ' ').trim() }));
      g.check(label + ': the row is marked .fx-moved, shows the new status, has the Done box ticked, no select, and the note says where it will go', r.moved && r.status === 'signed-up' && r.done && !r.hasSelect && r.note === 'Marked done. It is now listed under Signed up. Untick to undo.', JSON.stringify(r));
      g.check(label + ': the live region says what changed', d.live === byId[id].name + ' marked done.', d.live);
      // numbers moved at once, rows did not: compare the two
      g.check(label + ': the row count in the list did not change but the title count did', d.secs.map((s) => s.ids.length).join() === before.secs.map((s) => s.ids.length).join() && (before.secs.find((s) => s.sec === sec.sec).count !== sec.count || sec.sec === 'optional'), sec.count + ' vs ' + before.secs.find((s) => s.sec === sec.sec).count);
      // it moves after a tab switch
      await trkTab(page, 'signed-up');
      let d2 = await verifyTracker(g, label + ' Signed up tab after the change', page, Object.assign({ tab: 'signed-up' }, o));
      g.check(label + ': the row is now in the Signed up tab, no longer .fx-moved', d2.secs.length === 1 && d2.secs[0].ids.includes(id) && d2.secs[0].moved.every((m) => !m));
      await trkTab(page, 'todo');
      d2 = await verifyTracker(g, label + ' To do tab after the change', page, Object.assign({ tab: 'todo' }, o));
      g.check(label + ': the row has left the To do list (and its group is covered)', !d2.secs.some((s) => s.ids.includes(id) || s.others.some((x) => x.includes(id))));
      // a change from elsewhere (Programs page) is a full render
      await page.evaluate((i) => BFF.tracker.setStatus(i, 'todo'), id);
      await page.waitForTimeout(100);
      await verifyTracker(g, label + ' after a change made elsewhere (full render)', page, { profile });
      clean(g, h, label + ' status change');
      await h.ctx.close();
    }
    // ---- Do these with help ----
    {
      const h = await openP(browser, mode, { profile });
      const page = h.page;
      const ex = trackerFor({ profile });
      await page.locator('#view-tracker .fx-trk-help').click();
      await page.waitForSelector('#view-guided:not([hidden])');
      await page.waitForTimeout(150);
      const checked = await page.evaluate(() => [...document.querySelectorAll('#view-guided input[id^="gd-pick-"]:checked')].map((c) => c.id.replace('gd-pick-', '')));
      g.check(label + ': "Do these with help" lands on #guided', (await page.evaluate(() => location.hash)) === '#guided');
      g.check(label + ': exactly the Do now programs are selected', eq([...checked].sort(), idsOf(ex.secs.now).sort()), checked.length + ' ticked vs ' + ex.secs.now.length + ' in Do now');
      const startText = norm(await page.locator('#view-guided .fx-sticky button.fx-btn--primary').first().textContent());
      g.check(label + ': the Start button counts them', startText === 'Start (' + checked.length + ' programs)', startText);
      clean(g, h, label + ' do these with help');
      await h.ctx.close();
    }
    // ---- folds: closed by default, open state survives a reload ----
    // The saved prefs must survive a reload. If the browser empties the whole store, guardedReload says so and runGroup repeats the group.
    {
    const h = await openP(browser, mode, { profile });
    const page = h.page;
    for (const k of ['email', 'gmail', 'backup']) g.check(label + ': fold "' + k + '" is closed by default', (await page.locator('#view-tracker details.fx-fold[data-fold="' + k + '"]').count()) === 1 && !(await foldOpen(page, k)));
    g.check(label + ': a closed fold keeps its controls out of sight', !(await page.locator('#trk-archive').isVisible()) && !(await page.locator('#trk-restore').isVisible()) && !(await page.locator('#trk-inbox').isVisible()));
    await openFold(page, 'email');
    await openFold(page, 'backup');
    g.check(label + ': opening shows the controls', (await page.locator('#trk-archive').isVisible()) && (await page.getByRole('button', { name: 'Download backup (JSON)' }).isVisible()));
    await page.waitForTimeout(150);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bff.prefs.v1') || '{}').trkOpen);
    g.check(label + ': prefs.trkOpen records the open folds', saved && saved.email === true && saved.backup === true && !saved.gmail, JSON.stringify(saved));
    await reloadAfterWrite(page);
    await page.waitForSelector('#view-tracker details.fx-fold');
    await page.waitForTimeout(250);
    const afterReload = await page.evaluate(() => [localStorage.getItem('bff.prefs.v1'), [...document.querySelectorAll('details.fx-fold')].map((d) => d.dataset.fold + ':' + d.open).join()]);
    g.check(label + ': after a reload the same folds are open, the others closed', (await foldOpen(page, 'email')) && (await foldOpen(page, 'backup')) && !(await foldOpen(page, 'gmail')), JSON.stringify(afterReload));
    await page.locator('#view-tracker details.fx-fold[data-fold="email"] > summary').click();
    await page.waitForTimeout(150);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('bff.prefs.v1') || '{}').trkOpen);
    g.check(label + ': closing a fold is remembered too', saved2 && saved2.email === false && saved2.backup === true, JSON.stringify(saved2));
    // a full render (tab switch, status change elsewhere) never touches the folds
    await trkTab(page, 'all');
    await page.evaluate((i) => BFF.tracker.setStatus(i, 'skipped'), ALL[5].id);
    await page.waitForTimeout(100);
    g.check(label + ': tab switches and renders leave the folds as they were', !(await foldOpen(page, 'email')) && (await foldOpen(page, 'backup')));
    clean(g, h, label + ' folds');
    await h.ctx.close();
    }
    // ---- the Details panel and a saved note ----
    {
    const h = await openP(browser, mode, { profile });
    const page = h.page;
    const ex = trackerFor({ profile });
    const id = idsOf(ex.secs.now)[0];
    const p = byId[id];
    const btn = page.locator('#trk-d-' + id);
    g.check(label + ': Details starts closed and points at its panel', (await btn.getAttribute('aria-expanded')) === 'false' && (await btn.getAttribute('aria-controls')) === 'trk-p-' + id && !(await page.locator('#trk-p-' + id).isVisible()));
    g.check(label + ': no note box exists until the panel is first opened', (await page.locator('#trk-n-' + id).count()) === 0);
    await openRowDetails(page, id);
    g.check(label + ': the panel opens with what you get, the note box and Search my Gmail logic', (await btn.getAttribute('aria-expanded')) === 'true' && norm(await page.locator('#trk-p-' + id + ' .fx-trk-what').textContent()) === norm(p.whatYouGet) && (await page.locator('#trk-n-' + id).isVisible()));
    await page.locator('#trk-n-' + id).fill('Jane, sent the form on the 3rd');
    await page.waitForFunction((i) => BFF.tracker.getNote(i) === 'Jane, sent the form on the 3rd', id, { timeout: 2500 });
    g.check(label + ': the note is saved in bff.tracker.v1', (await page.evaluate((i) => (JSON.parse(localStorage.getItem('bff.tracker.v1') || '{}')[i] || {}).note, id)) === 'Jane, sent the form on the 3rd');
    g.check(label + ': Details now says the row has a note', /\(has a note\)/.test(await btn.textContent()));
    await reloadAfterWrite(page);
    await page.waitForSelector('#trk-list li.fx-trk-row');
    await page.waitForTimeout(200);
    await openRowDetails(page, id);
    g.check(label + ': the note is back after a reload', (await page.locator('#trk-n-' + id).inputValue()) === 'Jane, sent the form on the 3rd');
    clean(g, h, label + ' details');
    await h.ctx.close();
    }
  }
}

// ---- B. the Do it for me list ----
const readGuided = (page) => page.evaluate(() => {
  const rows = [...document.querySelectorAll('#view-guided .fx-pick-row')].map((r) => {
    const cb = r.querySelector('input[type=checkbox]');
    const alt = r.closest('details.fx-alt'), side = r.closest('details.fx-side');
    return { id: cb.id.replace('gd-pick-', ''), checked: cb.checked, altRow: r.classList.contains('fx-pick-alt'), inAlt: !!alt, altOpen: alt ? alt.open : null, inSide: !!side, sideOpen: side ? side.open : null };
  });
  const side = document.querySelector('#view-guided details.fx-side');
  const items = [...document.querySelectorAll('#view-guided li.fx-pick-item')].map((li) => ({
    lead: li.querySelector(':scope > .fx-pick-row input').id.replace('gd-pick-', ''),
    inSide: !!li.closest('details.fx-side'),
    others: [...li.querySelectorAll(':scope > details.fx-alt .fx-pick-row input')].map((c) => c.id.replace('gd-pick-', '')),
    altSummary: li.querySelector(':scope > details.fx-alt > summary') ? li.querySelector(':scope > details.fx-alt > summary').textContent.trim() : null,
    altOpen: li.querySelector(':scope > details.fx-alt') ? li.querySelector(':scope > details.fx-alt').open : null
  }));
  return { rows, items, sideSummary: side ? side.querySelector('summary').textContent.trim() : null, sideOpen: side ? side.open : null, count: document.querySelector('#view-guided .fx-count').textContent.trim() };
});

async function guidedChecks(env, g) {
  const { browser } = env;
  const grp = L.collapseGroups(L.rankPrograms(ALL)).find((x) => x.others.length > 0 && !L.hiddenByState(x.lead, 'TX') && !L.hiddenByAnswers(x.lead, FULL, 'todo'));
  for (const mode of MODES) {
    for (const [name, profile, statuses] of [['full sample', FULL, {}], ['full sample with a group signed up', FULL, { [grp.lead.id]: 'signed-up' }], ['name only', NAME_ONLY, {}], ['full sample + insurer', FULL_I, {}]]) {
      const label = mode + ' Do it for me, ' + name;
      const h = await openP(browser, mode, { profile, statuses, hash: 'guided' });
      const page = h.page;
      const d = await readGuided(page);
      const st = statusFn(statuses);
      // Phase J: the one hide rule (other state, ruled out, done, not for me, covered by another sign-up).
      const shown = L.splitHidden(ALL, { state: profile.state || '', profile, statusOf: st }, {}).pool;
      const groups = L.collapseGroups(L.rankPrograms(shown));
      const side = groups.filter((x) => ['conditional', 'longshot'].includes(L.verdict(x.lead)));
      const main = groups.filter((x) => !['conditional', 'longshot'].includes(L.verdict(x.lead)));
      g.check(label + ': one row per group (a lead plus its other ways), main and optional groups as the module says', eq(d.items.filter((x) => !x.inSide).map((x) => x.lead), main.map((x) => x.lead.id)) && eq(d.items.filter((x) => x.inSide).map((x) => x.lead), side.map((x) => x.lead.id)), d.items.length + ' on the page vs ' + groups.length);
      g.check(label + ': other ways sit in each group item in rank order', d.items.every((it) => eq(it.others, (groups.find((x) => x.lead.id === it.lead) || { others: [] }).others.map((o) => o.id))));
      g.check(label + ': alternates are never outside a "more ways" fold', d.rows.filter((r) => r.altRow).every((r) => r.inAlt));
      g.check(label + ': each fold says how many more ways', d.items.filter((it) => it.others.length).every((it) => it.altSummary === (it.others.length === 1 ? '1 more way to get the same thing' : it.others.length + ' more ways to get the same thing')));
      if (Object.keys(statuses).length) g.check(label + ': the signed-up program and every other way to get it are left out of the list', ALL.filter((p) => L.groupKey(p) === L.groupKey(grp.lead)).every((p) => !d.rows.some((r) => r.id === p.id)), d.rows.filter((r) => L.groupKey(byId[r.id]) === L.groupKey(grp.lead)).map((r) => r.id).join());
      g.check(label + ': the optional section is one closed fold with its count', side.length === 0 ? d.sideSummary === null : d.sideSummary === 'Only if you would buy anyway, and long shots (' + side.length + ')', d.sideSummary);
      const ticked = d.rows.filter((r) => r.checked).map((r) => r.id);
      const perGroup = {};
      ticked.forEach((id) => { const k = L.groupKey(byId[id]); perGroup[k] = (perGroup[k] || 0) + 1; });
      g.check(label + ': at most one default tick per group', Object.values(perGroup).every((n) => n <= 1), JSON.stringify(Object.entries(perGroup).filter(([, n]) => n > 1)));
      g.check(label + ': something is ticked by default', ticked.length > 0, String(ticked.length));
      const doneKeys = new Set(Object.keys(statuses).filter((i) => ['signed-up', 'received'].includes(statuses[i])).map((i) => L.groupKey(byId[i])));
      g.check(label + ': no tick in a group already signed up for', ticked.every((id) => !doneKeys.has(L.groupKey(byId[id]))), ticked.filter((id) => doneKeys.has(L.groupKey(byId[id]))).join());
      g.check(label + ': a tick is a lead or sits in an open fold (nothing ticked out of sight)', d.rows.filter((r) => r.checked).every((r) => (!r.inAlt || r.altOpen) && (!r.inSide || r.sideOpen)));
      const wantSideOpen = d.rows.some((r) => r.checked && r.inSide);
      g.check(label + ': the optional fold is closed unless something in it is ticked', d.sideSummary === null || d.sideOpen === wantSideOpen, String(d.sideOpen));
      g.check(label + ': programs ticked by default are ones the module defaults on', ticked.every((id) => L.guidedDefault(byId[id])), ticked.filter((id) => !L.guidedDefault(byId[id])).join());
      const tickedGroups = new Set(ticked.map((id) => L.groupKey(byId[id]))).size;
      g.check(label + ': the count line is "N of M selected" by group', d.count === tickedGroups + ' of ' + groups.length + ' selected', d.count);
      clean(g, h, label);
      await h.ctx.close();
    }
  }
}

// Today's data has no group with two programs that are both ticked by default, so the rule "none in a group already signed up for"
// would be checked on nothing. This test makes the page's own copy of the data say that two such programs are the same thing
// (JSON.parse of the inlined data is wrapped before the app reads it) and checks the rule on that.
async function guidedGroupRule(env, g) {
  const { browser } = env;
  const cand = L.rankPrograms(ALL).filter((p) => L.guidedDefault(p) && !p.sameAs && !(p.states || []).length && !(p.audience || []).length && !L.hiddenByAnswers(p, FULL, 'todo')
    && !ALL.some((q) => q.sameAs === p.id));
  const A = cand[0], B = cand[1];
  const patch = '(function(){var A=' + JSON.stringify(A.id) + ',B=' + JSON.stringify(B.id) + ',o=JSON.parse;JSON.parse=function(t,r){var v=o.call(this,t,r);try{if(Array.isArray(v)&&v.length>50&&v[0]&&v[0].signupUrl){v.forEach(function(p){if(p.id===B)p.sameAs=A;});}}catch(e){}return v;};})();';
  for (const mode of MODES) {
    for (const [name, statuses] of [['neither is signed up', {}], ['the second is signed up', { [B.id]: 'signed-up' }], ['the first is received', { [A.id]: 'received' }]]) {
      const label = mode + ' same-thing group (patched data), ' + name;
      const h = await open(browser, { mode, profile: FULL, init: [patch], seed: seedStore('tracker', trackerSeed(statuses)), hash: 'guided', all: false });
      const d = await readGuided(h.page);
      const inGroup = d.rows.filter((r) => r.id === A.id || r.id === B.id);
      const done = Object.keys(statuses).length > 0;
      const ticked = inGroup.filter((r) => r.checked).map((r) => r.id);
      if (done) {
        // Phase J: the signed-up program is left out (done) and so is its other way (covered): the group is not listed at all.
        const left = await h.page.locator('#view-guided p.gd-left').innerText();
        g.check(label + ': neither program is listed (one is done, the other is covered by it) and the left-out line counts both', inGroup.length === 0 && left.includes(L.hideReasonText('done', 1, true)) && left.includes(L.hideReasonText('covered', 1, true)), inGroup.map((r) => r.id).join() + ' | ' + left.slice(0, 200));
      } else {
        g.check(label + ': the two programs are one group (one is under the other as "another way")', d.items.some((it) => it.lead === A.id && eq(it.others, [B.id])), JSON.stringify(d.items.filter((it) => it.others.length).map((it) => [it.lead, it.others])));
      }
      if (done) { /* nothing more to tick */ }
      else g.check(label + ': exactly one of the two is ticked by default (the better one)', eq(ticked, [A.id]), ticked.join());
      clean(g, h, label);
      await h.ctx.close();
    }
  }
}

// ---- C. missing info: lines, notices, counts ----
const LINE_JS = `window.__lineInfo = (l) => { const a = l.querySelector('a.miss-add'); return { tag: l.tagName, data: l.dataset.missing, text: l.querySelector('.miss-text').textContent, link: a ? a.firstChild.textContent : null, linkFull: a ? a.textContent : null, key: a ? a.dataset.infoKey : null, href: a ? a.getAttribute('href') : null, aria: a ? a.getAttribute('aria-label') : null, srClass: a && a.querySelector('.fx-sr') ? true : false }; };`;
async function addHelpers(page) { await page.evaluate(LINE_JS); }
// page.evaluate bodies cannot see Node helpers; these use window.__lineInfo, set by addHelpers.
async function readLines(page, view) {
  await addHelpers(page);
  return page.evaluate((view) => {
    const li = window.__lineInfo;
    if (view === 'directory') return [...document.querySelectorAll('#view-directory article.card[data-program-id]')].map((c) => ({ id: c.dataset.programId, status: null, lines: [...c.querySelectorAll('.miss-line')].map(li) }));
    if (view === 'tracker') return [...document.querySelectorAll('#trk-list li.fx-trk-row')].map((r) => ({ id: r.dataset.id, status: r.dataset.status, lines: [...r.querySelectorAll(':scope > .fx-trk-main .fx-trk-miss .miss-line')].map(li) }));
    return [...document.querySelectorAll('#view-guided .fx-pick-row')].map((r) => { const nx = r.nextElementSibling; return { id: r.querySelector('input').id.replace('gd-pick-', ''), status: null, lines: nx && nx.classList.contains('gd-miss') ? [...nx.querySelectorAll('.miss-line')].map(li) : [] }; });
  }, view);
}
function verifyLines(g, label, rows, profile, statuses) {
  const st = statusFn(statuses);
  let withLines = 0, bad = [];
  rows.forEach((r) => {
    const p = byId[r.id];
    const want = st(r.id) === 'todo' ? missLineFor(p, profile) : null;
    if (r.status && r.status !== st(r.id)) bad.push(r.id + ' status ' + r.status);
    if (!want) { if (r.lines.length) bad.push(r.id + ' should have no line but has "' + r.lines[0].text + '"'); return; }
    if (r.lines.length !== 1) { bad.push(r.id + ' has ' + r.lines.length + ' lines, wants 1'); return; }
    withLines++;
    const l = r.lines[0];
    if (l.tag !== 'P' || l.data !== want.data) bad.push(r.id + ' data-missing "' + l.data + '" vs "' + want.data + '"');
    if (l.text !== want.text) bad.push(r.id + ' text "' + l.text + '" vs "' + want.text + '"');
    if (l.link !== want.link || l.linkFull !== want.link + ' in My info' || !l.srClass) bad.push(r.id + ' link "' + l.linkFull + '" vs "' + want.link + ' in My info"');
    if (l.key !== want.first || l.href !== '#info') bad.push(r.id + ' data-info-key "' + l.key + '" vs "' + want.first + '"');
    if (l.aria) bad.push(r.id + ' link has an aria-label that replaces "in My info"');
  });
  g.check(label + ': ' + rows.length + ' rows checked, ' + withLines + ' carry a line, each equal to L.missingInfo (data-missing, sentence, link, first key)', bad.length === 0, bad.slice(0, 3).join(' | '));
  return withLines;
}

async function readNotice(page, sel) {
  return page.evaluate((sel) => {
    const wrap = document.querySelector(sel);
    const b = wrap && wrap.querySelector('.miss-box');
    if (!b) return { box: false, wrapHidden: wrap ? wrap.hidden || wrap.offsetParent === null : null };
    const t = (e) => e.textContent.replace(/\s+/g, ' ').trim();
    return {
      box: true, shown: b.offsetParent !== null, total: b.dataset.missingTotal, keys: b.dataset.missingKeys, cls: b.className, lead: t(b.querySelector('.miss-lead')).replace(/^!\s*/, ''),
      chips: [...b.querySelectorAll('a.miss-chip')].map((c) => ({ key: c.dataset.infoKey, href: c.getAttribute('href'), label: c.querySelector('.miss-label').textContent, n: c.querySelector('.miss-n').firstChild.textContent, sr: c.querySelector('.miss-n .fx-sr') ? c.querySelector('.miss-n .fx-sr').textContent : '' })),
      adds: [...b.querySelectorAll('a.miss-add')].map((a) => ({ key: a.dataset.infoKey, text: t(a) })), chipList: !!b.querySelector('ul.miss-chips')
    };
  }, sel);
}
// The notice the page should show for a profile and statuses. form: 'full' (Programs) or 'compact' (Tracker, Do it for me).
function noticeExpect(profile, statuses, form) {
  const counts = countsFor(profile, statuses);
  const keys = keysWithCount(counts);
  if (!counts.total) return null;
  const one = keys.length === 1 || form === 'compact';
  const n = counts.total;
  let lead;
  if (keys.length === 1) lead = 'My info is missing ' + L.MISSING_LABELS[keys[0]] + '. ' + plural(n, 'program') + ' ' + (n === 1 ? 'depends' : 'depend') + ' on it.';
  else lead = 'My info is missing details that ' + plural(n, 'program') + ' ' + (n === 1 ? 'depends' : 'depend') + ' on.';
  if (one) lead += ' ' + (keys.length > 1 ? 'Add them' : 'Add it') + ' in My info';
  return { counts, keys, one, lead, first: keys[0] };
}
function verifyNotice(g, label, d, ex, form) {
  if (!ex) { g.check(label + ': no notice when nothing is missing (total 0)', !d.box || !d.shown, JSON.stringify(d).slice(0, 100)); return; }
  g.check(label + ': a notice is shown', d.box && d.shown);
  if (!d.box) return;
  g.check(label + ': data-missing-total and data-missing-keys equal L.missingInfoCounts', d.total === String(ex.counts.total) && d.keys === ex.keys.join(' '), d.total + ' [' + d.keys + '] vs ' + ex.counts.total + ' [' + ex.keys.join(' ') + ']');
  g.check(label + ': the sentence', d.lead === ex.lead, d.lead + ' vs ' + ex.lead);
  if (ex.one) {
    g.check(label + ': one-sentence form (miss-box--one), no chips', /\bmiss-box--one\b/.test(d.cls) && d.chips.length === 0 && !d.chipList, d.cls + ' chips=' + d.chips.length);
    g.check(label + ': one link, "' + (ex.keys.length > 1 ? 'Add them' : 'Add it') + '", for the first key with a count', d.adds.length === 1 && d.adds[0].key === ex.first && d.adds[0].text === (ex.keys.length > 1 ? 'Add them' : 'Add it') + ' in My info', JSON.stringify(d.adds));
  } else {
    g.check(label + ': full form has no miss-box--one class and no inline link', !/miss-box--one/.test(d.cls) && d.adds.length === 0, d.cls);
    g.check(label + ': one chip per key with a count, in key order', eq(d.chips.map((c) => c.key), ex.keys), d.chips.map((c) => c.key).join());
    g.check(label + ': each chip shows its own label and count', d.chips.every((c) => c.href === '#info' && c.label === L.MISSING_SHORT[c.key] && c.n === String(ex.counts.keys[c.key]) && c.sr === (ex.counts.keys[c.key] === 1 ? ' program' : ' programs')), JSON.stringify(d.chips.slice(0, 2)));
  }
}

async function missingLinesAndNotices(env, g) {
  const { browser } = env;
  // statuses: a few programs that carry a line under {} are signed up, received, skipped (cards and rows must lose their line)
  const lined = withLine({}, {});
  const statuses = { [lined[0].id]: 'signed-up', [lined[3].id]: 'received', [lined[5].id]: 'skipped' };
  const PROFS = PROFILES.concat([['name only', NAME_ONLY]]);
  for (const mode of MODES) {
    for (const [name, profile] of PROFS) {
      for (const [sname, sts] of [['no statuses', {}], ['three statuses set', statuses]]) {
        if (sname !== 'no statuses' && name !== 'empty' && name !== 'full sample' && name !== 'name only') continue;
        const label = mode + ' ' + name + ' / ' + sname;
        const h = await openP(browser, mode, { profile, statuses: sts, hash: 'directory' });
        const page = h.page;
        // Programs: cards (every kind) and the full-form notice
        await h.showAll();
        verifyLines(g, label + ' Programs cards', await readLines(page, 'directory'), profile, sts);
        const ex = noticeExpect(profile, sts, 'full');
        verifyNotice(g, label + ' Programs notice', await readNotice(page, '#view-directory .dir-miss'), ex, 'full');
        if (ex && ex.keys.length > 1) g.check(label + ': Programs notice uses chips (' + ex.keys.length + ' keys)', !ex.one);
        // Tracker
        await h.go('tracker');
        await sleep(150);
        const rows = await readLines(page, 'tracker');
        g.check(label + ': Tracker shows rows', rows.length > 0);
        verifyLines(g, label + ' Tracker to-do rows', rows, profile, sts);
        await trkTab(page, 'all');
        verifyLines(g, label + ' Tracker All tab (rows with a status have no line)', await readLines(page, 'tracker'), profile, sts);
        await trkTab(page, 'todo');
        verifyNotice(g, label + ' Tracker notice', await readNotice(page, '#view-tracker .fx-trk-miss-notice'), noticeExpect(profile, sts, 'compact'), 'compact');
        // Do it for me
        await h.go('guided');
        await sleep(150);
        const emptyInfo = !profile.firstName && !profile.email && !profile.address1;
        const warns = await page.locator('#view-guided .fx-warn:visible').count();
        const boxes = await page.locator('#view-guided .gd-miss-box').count();
        verifyLines(g, label + ' Do it for me rows', await readLines(page, 'guided'), profile, sts);
        if (emptyInfo) {
          g.check(label + ': My info is empty, so exactly one warning shows and no notice box', warns === 1 && boxes === 0 && /My info is empty/.test(await page.locator('#view-guided .fx-warn:visible').first().textContent()), warns + ' warnings, ' + boxes + ' boxes');
        } else {
          g.check(label + ': My info has something, so no "My info is empty" warning', (await page.locator('#view-guided .fx-warn:visible', { hasText: 'My info is empty' }).count()) === 0);
          const exg = noticeExpect(profile, sts, 'compact');
          if (!exg) g.check(label + ': Do it for me has no notice box when nothing is missing', boxes === 0, String(boxes));
          else { g.check(label + ': exactly one notice box under the intro', boxes === 1, String(boxes)); verifyNotice(g, label + ' Do it for me notice', await readNotice(page, '#view-guided .gd-miss-box'), exg, 'compact'); }
        }
        clean(g, h, label);
        await h.ctx.close();
      }
    }
  }
}

// Counting rule: a program that has a line, marked Signed up, lowers the total on all three pages.
async function countingRule(env, g) {
  const { browser } = env;
  for (const mode of MODES) {
    const profile = NAME_ONLY;
    const label = mode + ' counting rule';
    const h = await openP(browser, mode, { profile, hash: 'tracker' });
    const page = h.page;
    const ex = trackerFor({ profile });
    const row = ex.secs.now.concat(ex.secs.later).find((r) => missLineFor(r.p, profile));
    const id = row.p.id;
    const total0 = countsFor(profile, {}).total;
    const total = async (sel) => { const n = await readNotice(page, sel); return n.box ? Number(n.total) : 0; };
    const before = await total('#view-tracker .fx-trk-miss-notice');
    g.check(label + ': Tracker notice starts at the module total', before === total0, before + ' vs ' + total0);
    g.check(label + ': the row carries a line before the change', (await page.locator('#trk-list li.fx-trk-row[data-id="' + id + '"] > .fx-trk-main .miss-line').count()) === 1);
    await page.locator('#trk-done-' + id).check();
    await page.waitForTimeout(150);
    const after = await total('#view-tracker .fx-trk-miss-notice');
    g.check(label + ': marking it Signed up lowers the Tracker total by one, at once', after === total0 - 1 && after === countsFor(profile, { [id]: 'signed-up' }).total, before + ' -> ' + after);
    g.check(label + ': its line is gone and the row did not move', (await page.locator('#trk-list li.fx-trk-row[data-id="' + id + '"] > .fx-trk-main .miss-line').count()) === 0 && (await page.locator('#trk-list li.fx-trk-row[data-id="' + id + '"].fx-moved').count()) === 1);
    await h.go('directory');
    const dn = await total('#view-directory .dir-miss');
    g.check(label + ': Programs total is one lower too', dn === total0 - 1, dn + ' vs ' + (total0 - 1));
    g.check(label + ': the Programs card for it has no line', (await page.locator('article.card[data-program-id="' + id + '"] .miss-line').count()) === 0);
    await h.go('guided');
    await sleep(150);
    const gn = await total('#view-guided .gd-miss-box');
    g.check(label + ': Do it for me total is one lower too', gn === total0 - 1, gn + ' vs ' + (total0 - 1));
    // and back to to-do: the totals and the line return on every page
    await page.evaluate((i) => BFF.tracker.setStatus(i, 'todo'), id);
    await h.go('tracker');
    await sleep(100);
    g.check(label + ': back to To do, the Tracker total and the line return', (await total('#view-tracker .fx-trk-miss-notice')) === total0 && (await page.locator('#trk-list li.fx-trk-row[data-id="' + id + '"] > .fx-trk-main .miss-line').count()) === 1);
    await h.go('directory');
    g.check(label + ': back to To do, the Programs total returns', (await total('#view-directory .dir-miss')) === total0);
    clean(g, h, label);
    await h.ctx.close();
  }
}

// My info: "N programs depend on this." under each unanswered field.
async function infoHints(env, g) {
  const { browser } = env;
  const KEYS = ['state', 'cover', 'insurer', 'lowIncome', 'job'];
  const readNeeds = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((k) => { const e = document.getElementById('info-' + k + '-need'); const c = document.getElementById('info-' + k); return [k, { shown: !!e && !e.hidden && e.offsetParent !== null, text: e ? e.textContent : null, cls: e ? e.className : '', desc: c ? c.getAttribute('aria-describedby') : '' }]; })), KEYS);
  const wantText = (counts, profile, k) => (profile[k] || !counts.keys[k] ? null : counts.keys[k] === 1 ? '1 program depends on this.' : counts.keys[k] + ' programs depend on this.');
  for (const mode of MODES) {
    for (const [name, profile] of [['empty', {}], ['state only', { state: 'TX' }], ['full sample', FULL], ['full sample + insurer', FULL_I]]) {
      const label = mode + ' My info hints, ' + name;
      const h = await openP(browser, mode, { profile, hash: 'info' });
      const page = h.page;
      const counts = countsFor(profile, {});
      const d = await readNeeds(page);
      const bad = KEYS.filter((k) => { const w = wantText(counts, profile, k); return w === null ? d[k].shown : !(d[k].shown && d[k].text === w); });
      g.check(label + ': each unanswered field shows "N programs depend on this." with the module count; answered ones show nothing', bad.length === 0, bad.map((k) => k + ': ' + JSON.stringify(d[k])).join(' | '));
      g.check(label + ': each field points at its hint with aria-describedby', KEYS.every((k) => (d[k].desc || '').split(' ').includes('info-' + k + '-need')));
      clean(g, h, label);
      await h.ctx.close();
    }
    // answering one field removes its hint and the others follow
    const label = mode + ' My info hints change as fields are answered';
    const h = await openP(browser, mode, { profile: {}, hash: 'info' });
    const page = h.page;
    const answers = [['state', 'TX'], ['cover', 'private'], ['lowIncome', 'no'], ['job', 'yes'], ['insurer', 'Aetna']];
    const prof = {};
    for (const [k, v] of answers) {
      await page.locator('#info-' + k).selectOption(v);
      prof[k] = v;
      await page.waitForFunction((kk) => { const e = document.getElementById('info-' + kk + '-need'); return e.hidden; }, k, { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(120);
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('bff.profile.v1') || '{}'));
      const counts = countsFor(stored, {});
      const d = await readNeeds(page);
      const bad = KEYS.filter((kk) => { const w = wantText(counts, stored, kk); return w === null ? d[kk].shown : !(d[kk].shown && d[kk].text === w); });
      g.check(label + ' after answering ' + k + ': hints equal the module counts for the saved answers', bad.length === 0 && stored[k] === v, bad.map((kk) => kk + ': ' + JSON.stringify(d[kk])).join(' | '));
    }
    g.check(label + ': with all five answered no hint shows', !(await page.locator('#view-info .fx-need:visible').count()));
    clean(g, h, label);
    await h.ctx.close();
  }
}

// ---- hand-off to My info ----
const CTRL = { state: 'info-state', cover: 'info-cover', insurer: 'info-insurer', lowIncome: 'info-lowIncome', job: 'info-job', dueDate: 'info-dueDate', email: 'info-email', plus: 'info-plus' };
const BACK = { directory: 'Back to Programs', tracker: 'Back to Tracker', guided: 'Back to Do it for me' };
const SELECT = { state: 'TX', cover: 'private', insurer: 'Aetna', lowIncome: 'no', job: 'yes' };

// Where a link for each key lives on each page for a given profile (all are real links a person can tap).
function linkLocator(page, from, key) {
  if (from === 'directory') {
    if (key === 'dueDate') return page.locator('#view-directory .dir-note a[data-info-key="dueDate"]').first();
    return page.locator('#view-directory .dir-miss a.miss-chip[data-info-key="' + key + '"]').first();
  }
  if (from === 'tracker') {
    if (key === 'dueDate') return page.locator('#view-tracker .fx-trk-help-line a[data-info-key="dueDate"]').first();
    if (key === 'email') return page.locator('#view-tracker details.fx-fold[data-fold="email"] a[data-info-key="email"]').first();
    if (key === 'plus') return page.locator('#view-tracker details.fx-fold[data-fold="email"] a[data-info-key="plus"]').first();
    return page.locator('#view-tracker .fx-trk-miss-notice a[data-info-key="' + key + '"], #view-tracker .fx-trk-miss a[data-info-key="' + key + '"]').first();
  }
  return page.locator('#view-guided .gd-miss-box a[data-info-key="' + key + '"], #view-guided .gd-miss a[data-info-key="' + key + '"]').first();
}
// Open any closed details around a link, the way a person would unfold them to reach it.
async function reveal(loc) {
  await loc.evaluate((a) => { for (let n = a.parentElement; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true; });
}
const readInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  const asks = [...document.querySelectorAll('#view-info .fx-ask')].map((w) => [...w.querySelectorAll('input,select')].map((c) => c.id).join('+'));
  const backs = [...document.querySelectorAll('#view-info a.fx-ask-back')].map((b) => ({ text: b.textContent.trim(), href: b.getAttribute('href'), within: [...b.parentElement.querySelectorAll('input,select')].map((c) => c.id).join('+'), parentAsk: b.parentElement.classList.contains('fx-ask') }));
  return { hash: location.hash, active: a && a.id, tag: a && a.tagName, asks, backs, viewHidden: document.getElementById('view-info').hidden };
});

async function handoffs(env, g) {
  const { browser } = env;
  const combos = []; // [mode, from, key, profile, preset]
  const NAME = { firstName: 'Jane' };
  for (const key of ['state', 'cover', 'insurer', 'lowIncome', 'job', 'dueDate']) combos.push(['standalone', 'directory', key, {}]);
  for (const key of ['state', 'cover', 'insurer', 'lowIncome', 'job', 'dueDate', 'email', 'plus']) combos.push(['standalone', 'tracker', key, key === 'plus' ? Object.assign({}, NAME, { email: 'jane@example.com' }) : NAME]);
  for (const key of ['state', 'cover', 'insurer', 'lowIncome', 'job']) combos.push(['standalone', 'guided', key, NAME]);
  for (const [from, key, prof] of [['directory', 'state', {}], ['tracker', 'cover', NAME], ['guided', 'state', NAME], ['tracker', 'email', NAME], ['directory', 'dueDate', {}]]) combos.push(['artifact', from, key, prof]);
  for (const [mode, from, key, profile] of combos) {
    const label = mode + ' ' + from + ' -> ' + key;
    const h = await openP(browser, mode, { profile, hash: from });
    const page = h.page;
    if (from === 'tracker' && (key === 'email' || key === 'plus')) await openFold(page, 'email');
    const link = linkLocator(page, from, key);
    const found = (await link.count()) > 0;
    g.check(label + ': a link carrying data-info-key="' + key + '" is on the page', found);
    if (!found) { await h.ctx.close(); continue; }
    await reveal(link);
    const ls0 = await lsDump(page);
    await link.click();
    await page.waitForSelector('#view-info:not([hidden])');
    await sleep(60);
    await settleScroll(page);
    const d = await readInfo(page);
    const ctrl = CTRL[key];
    g.check(label + ': My info opens (#info)', d.hash === '#info' && !d.viewHidden, d.hash);
    g.check(label + ': focus is on ' + ctrl, d.active === ctrl, d.active + ' ' + d.tag);
    g.check(label + ': exactly that field\'s wrapper is highlighted (fx-ask)', eq(d.asks, [ctrl]), JSON.stringify(d.asks));
    g.check(label + ': one back link, "' + BACK[from] + '", href #' + from + ', inside the same wrapper', d.backs.length === 1 && d.backs[0].text === BACK[from] && d.backs[0].href === '#' + from && d.backs[0].within === ctrl && d.backs[0].parentAsk, JSON.stringify(d.backs));
    const vis = await page.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, ctrl);
    g.check(label + ': the field was scrolled into view', vis);
    const ls1 = await lsDump(page);
    g.check(label + ': the hand-off stored nothing (localStorage unchanged)', eq(ls0, ls1), JSON.stringify(Object.keys(ls1)));
    // answering removes the highlight
    const ctl = page.locator('#' + ctrl);
    if (key === 'email') {
      await ctl.pressSequentially('jane');
      g.check(label + ': typing in the email field keeps the highlight', eq((await readInfo(page)).asks, [ctrl]));
      await ctl.pressSequentially('@example.com');
      g.check(label + ': a full address typed but not yet left keeps the highlight', eq((await readInfo(page)).asks, [ctrl]));
      await page.keyboard.press('Tab');
    } else if (key === 'dueDate') await ctl.fill(isoInDays(100));
    else if (key === 'plus') await ctl.check();
    else await ctl.selectOption(SELECT[key]);
    await page.waitForTimeout(100);
    const d2 = await readInfo(page);
    g.check(label + ': once answered the highlight is gone', d2.asks.length === 0, JSON.stringify(d2.asks));
    g.check(label + ': the back link stays', d2.backs.length === 1);
    const wantKey = key === 'plus' ? 'usePlusTags' : key;
    const wantVal = { state: 'TX', cover: 'private', insurer: 'Aetna', lowIncome: 'no', job: 'yes', dueDate: isoInDays(100), email: 'jane@example.com', plus: true }[key];
    await page.waitForFunction(([k, v]) => { try { return JSON.parse(localStorage.getItem('bff.profile.v1') || '{}')[k] === v; } catch (e) { return false; } }, [wantKey, wantVal], { timeout: 3500 }).catch(() => {});
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem('bff.profile.v1') || '{}'));
    g.check(label + ': the answer is saved in bff.profile.v1', prof[wantKey] === wantVal, JSON.stringify(prof[wantKey]));
    // the back link goes home with focus on that page's heading
    await page.locator('#view-info a.fx-ask-back').click();
    await page.waitForSelector('#view-' + from + ':not([hidden])');
    await page.waitForTimeout(150);
    const back = await page.evaluate((from) => ({ hash: location.hash, tag: document.activeElement && document.activeElement.tagName, inView: document.getElementById('view-' + from).contains(document.activeElement) }), from);
    g.check(label + ': the back link returns to #' + from + ' with focus on its heading', back.hash === '#' + from && back.tag === 'H2' && back.inView, JSON.stringify(back));
    // used once: the normal nav shows no highlight and no back link, and neither does a reload
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My info' }).click();
    await page.waitForSelector('#view-info:not([hidden])');
    await page.waitForTimeout(150);
    const d3 = await readInfo(page);
    g.check(label + ': coming back through the nav shows no highlight and no back link', d3.asks.length === 0 && d3.backs.length === 0, JSON.stringify(d3.asks) + JSON.stringify(d3.backs));
    await reloadAfterWrite(page);
    await page.waitForSelector('#view-info:not([hidden])');
    await page.waitForTimeout(250);
    const d4 = await readInfo(page);
    g.check(label + ': a reload on #info shows none either', d4.asks.length === 0 && d4.backs.length === 0, JSON.stringify(d4.asks) + JSON.stringify(d4.backs));
    const keys = Object.keys(await lsDump(page));
    g.check(label + ': localStorage holds only the known bff.*.v1 keys', keys.every((k) => ['bff.profile.v1', 'bff.tracker.v1', 'bff.prefs.v1', 'bff.guided.v1'].includes(k)), keys.join());
    clean(g, h, label);
    await h.ctx.close();
  }

  // a field that already has an answer: focus and back link, no highlight. The link is injected so a real click is used.
  {
    const profile = Object.assign({}, FULL_I, { dueDate: isoInDays(90), usePlusTags: true });
    for (const key of ['state', 'cover', 'insurer', 'lowIncome', 'job', 'dueDate', 'email', 'plus']) {
      const label = 'standalone, field already answered -> ' + key;
      const h = await openP(browser, 'standalone', { profile, hash: 'tracker' });
      const page = h.page;
      await page.evaluate((k) => { const a = document.createElement('a'); a.href = '#info'; a.setAttribute('data-info-key', k); a.id = 'e2e-link'; a.textContent = 'ask ' + k; a.style.cssText = 'display:inline-block;padding:12px'; document.querySelector('#view-tracker').prepend(a); }, key);
      await page.locator('#e2e-link').click();
      await page.waitForSelector('#view-info:not([hidden])');
      await sleep(60);
      await settleScroll(page);
      const d = await readInfo(page);
      g.check(label + ': focus lands on the field', d.active === CTRL[key], d.active);
      g.check(label + ': no highlight (it is answered)', d.asks.length === 0, JSON.stringify(d.asks));
      g.check(label + ': the back link is there ("Back to Tracker")', d.backs.length === 1 && d.backs[0].text === 'Back to Tracker' && d.backs[0].href === '#tracker', JSON.stringify(d.backs));
      clean(g, h, label);
      await h.ctx.close();
    }
    // the plan field is hidden (no health cover): a request for the plan lands on the cover field
    const hi = await openP(browser, 'standalone', { profile: { firstName: 'Jane', cover: 'none' }, hash: 'directory' });
    const pg = hi.page;
    await pg.evaluate(() => { const a = document.createElement('a'); a.href = '#info'; a.setAttribute('data-info-key', 'insurer'); a.id = 'e2e-link'; a.textContent = 'plan'; a.style.cssText = 'display:inline-block;padding:12px'; document.querySelector('#view-directory').prepend(a); });
    await pg.locator('#e2e-link').click();
    await pg.waitForSelector('#view-info:not([hidden])');
    await sleep(60);
    await settleScroll(pg);
    const hidden = await pg.evaluate(() => document.querySelector('#view-info [data-situation="insurer"]').hidden);
    const dd = await readInfo(pg);
    g.check('insurer asked while the plan field is hidden: focus lands on the cover field (answered "none": no highlight), back link kept', hidden && dd.active === 'info-cover' && dd.asks.length === 0 && dd.backs.length === 1 && dd.backs[0].text === 'Back to Programs', JSON.stringify(dd) + ' hidden=' + hidden);
    clean(g, hi, 'insurer fallback');
    await hi.ctx.close();
    // and with no cover answer the plan field is shown, so the plan field itself is asked for
    const hj = await openP(browser, 'standalone', { profile: { firstName: 'Jane' }, hash: 'directory' });
    await hj.page.locator('#view-directory .dir-miss a.miss-chip[data-info-key="insurer"]').click();
    await hj.page.waitForSelector('#view-info:not([hidden])');
    await settleScroll(hj.page);
    const de = await readInfo(hj.page);
    g.check('insurer asked with the plan field shown: it gets focus and the highlight', de.active === 'info-insurer' && eq(de.asks, ['info-insurer']), JSON.stringify(de));
    clean(g, hj, 'insurer shown');
    await hj.ctx.close();
  }
}

// ---- accessibility and layout ----
const COLOR_JS = `(sel) => {
  const parse = (s) => { const m = /rgba?\\(([^)]+)\\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]));
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const canvas = dark ? [18, 18, 18] : [255, 255, 255];
  const bgOf = (e) => { const chain = []; for (let n = e; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); const c = parse(s.backgroundColor); if (c && c[3] > 0) { chain.push(c); if (c[3] >= 1) break; } } let b = canvas; for (let i = chain.length - 1; i >= 0; i--) b = over(chain[i], b).concat(1); return b.slice(0, 3); };
  const out = [];
  document.querySelectorAll(sel).forEach((root) => {
    const r0 = root.getBoundingClientRect();
    if (!r0.width || !r0.height || root.closest('[hidden]')) return;
    const nodes = [root].concat([...root.querySelectorAll('*')]);
    nodes.forEach((e) => {
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own) return;
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      if (r.width < 2 || r.height < 2 || s.visibility === 'hidden' || s.display === 'none' || e.closest('.fx-sr,[aria-hidden=true]')) return;
      const fg = parse(s.color); if (!fg) return;
      const bg = bgOf(e);
      out.push({ sel, el: e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0], text: e.textContent.trim().slice(0, 40), fg: over(fg, bg), bg, size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400 });
    });
  });
  return out;
}`;

async function a11yAndLayout(env, g) {
  const { browser } = env;
  // 44 px targets: every visible .miss-add and .miss-chip (every client rect of a wrapped link)
  const SMALL = (sel) => `() => [...document.querySelectorAll('${sel}')].filter((a) => a.closest('[hidden]') === null && a.getClientRects().length).flatMap((a) => { const out = []; [...a.getClientRects()].forEach((r) => { if (r.width > 0 && r.height > 0 && r.height < 43.5) out.push((a.className + ' ' + a.textContent.trim()).slice(0, 40) + ' h=' + r.height.toFixed(1)); }); const r = a.getBoundingClientRect(); if (r.height < 43.5) out.push('box ' + a.className + ' h=' + r.height.toFixed(1)); return out; })`;
  const OVER = `() => { const w = document.documentElement.clientWidth; const bad = []; document.querySelectorAll('.miss-box, .miss-box *, .miss-line, .miss-line *, .fx-need, .fx-ask, .fx-ask *, .fx-ask-back, .gd-miss, .gd-miss-box, .dir-miss, .fx-trk-miss-notice').forEach((e) => { if (e.closest('.fx-sr') || e.closest('[hidden]')) return; const r = e.getBoundingClientRect(); if (r.width && r.right > w + 0.5) bad.push(e.tagName + '.' + String(e.className).split(' ')[0] + ' right=' + Math.round(r.right) + ' w=' + w); if (r.width && r.left < -0.5) bad.push(e.tagName + '.' + String(e.className).split(' ')[0] + ' left=' + Math.round(r.left)); }); return { bad, sw: document.documentElement.scrollWidth, w }; }`;
  const FORMS = [
    ['Programs full notice (empty)', 'directory', {}, null],
    ['Programs one-key notice (full sample)', 'directory', FULL, null],
    ['Tracker compact several keys (empty)', 'tracker', {}, null],
    ['Tracker compact one key (full sample)', 'tracker', FULL, null],
    ['Do it for me compact several keys (name only)', 'guided', NAME_ONLY, null],
    ['Do it for me compact one key (full sample)', 'guided', FULL, null]
  ];
  for (const mode of MODES) {
    for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
      for (const [name, view, profile] of FORMS) {
        const label = mode + ' ' + vp.width + ' ' + name;
        const h = await openP(browser, mode, { profile, hash: view, vp });
        const page = h.page;
        if (view === 'directory') await h.showAll();
        await sleep(100);
        const shown = await page.locator('#view-' + view + ' .miss-box:visible').count();
        g.check(label + ': the notice is showing', shown === 1, String(shown));
        const lines = await page.locator('#view-' + view + ' .miss-line:visible').count();
        const small = await page.evaluate(eval(SMALL('#view-' + view + ' .miss-add, #view-' + view + ' .miss-chip')));
        const links = await page.locator('#view-' + view + ' .miss-add:visible, #view-' + view + ' .miss-chip:visible').count();
        g.check(label + ': ' + links + ' .miss-add and .miss-chip targets (' + lines + ' lines) are at least 44px tall', links > 0 && small.length === 0, small.slice(0, 3).join(' | '));
        const o = await page.evaluate(eval(OVER));
        g.check(label + ': nothing reaches past the right edge', o.bad.length === 0 && o.sw <= o.w, o.bad.slice(0, 3).join(' | ') + ' sw=' + o.sw + ' w=' + o.w);
        clean(g, h, label);
        await h.ctx.close();
      }
      // My info with hints, a highlight and the back link
      const label = mode + ' ' + vp.width + ' My info after a hand-off';
      const h = await openP(browser, mode, { profile: {}, hash: 'directory', vp });
      const page = h.page;
      await page.locator('#view-directory .dir-miss a.miss-chip[data-info-key="job"]').click();
      await page.waitForSelector('#view-info:not([hidden])');
      await settleScroll(page);
      const o = await page.evaluate(eval(OVER));
      g.check(label + ': hint, highlight and back link stay inside the screen', o.bad.length === 0 && o.sw <= o.w, o.bad.slice(0, 3).join(' | '));
      const small = await page.evaluate(eval(SMALL('#view-info a.fx-ask-back')));
      g.check(label + ': the back link is at least 44px tall', small.length === 0 && (await page.locator('a.fx-ask-back:visible').count()) === 1, small.join(' | '));
      clean(g, h, label);
      await h.ctx.close();
    }
    // contrast, light and dark
    for (const scheme of ['light', 'dark']) {
      const fails = [];
      let sampled = 0;
      const seenSel = {};
      const grab = async (page, sels) => {
        for (const sel of sels) {
          const items = await page.evaluate(eval(COLOR_JS), sel);
          sampled += items.length;
          seenSel[sel] = (seenSel[sel] || 0) + items.length;
          for (const it of items) {
            const large = it.size >= 24 || (it.size >= 18.66 && it.weight >= 700);
            const c = contrast(it.fg, it.bg);
            if (c < (large ? 3 : 4.5)) fails.push(sel + ' ' + it.el + ' "' + it.text + '" ' + c.toFixed(2) + ' fg=' + it.fg.map(Math.round) + ' bg=' + it.bg.map(Math.round));
          }
        }
      };
      for (const [view, profile] of [['directory', {}], ['directory', FULL], ['tracker', {}], ['guided', NAME_ONLY]]) {
        const h = await openP(browser, mode, { profile, hash: view, scheme });
        if (view === 'directory') await h.showAll();
        await grab(h.page, ['.miss-line', '.miss-box']);
        await h.ctx.close();
      }
      {
        const h = await openP(browser, mode, { profile: {}, hash: 'directory', scheme });
        await h.page.locator('#view-directory .dir-miss a.miss-chip[data-info-key="cover"]').click();
        await h.page.waitForSelector('#view-info:not([hidden])');
        await settleScroll(h.page);
        await grab(h.page, ['.fx-need', '.fx-ask-back', '.fx-ask']);
        await h.ctx.close();
      }
      g.check(mode + ' ' + scheme + ': text contrast of .miss-line, .miss-box, .fx-need and .fx-ask-back is at least 4.5:1 (' + sampled + ' styles sampled)', fails.length === 0 && ['.miss-line', '.miss-box', '.fx-need', '.fx-ask-back'].every((s) => seenSel[s] > 0), fails.slice(0, 3).join(' | ') + ' seen=' + JSON.stringify(seenSel));
    }
  }
}

// BFF_E2E_SUB=I2,I6 runs only those parts of group 14 (handy while working on one of them).
export async function phaseI(env) {
  const sub = process.env.BFF_E2E_SUB ? process.env.BFF_E2E_SUB.split(',') : null;
  const part = async (id, title, fn) => { if (!sub || sub.includes(id)) await runGroup(id + ' ' + title, fn); };
  await part('I1', 'Phase I Tracker: scope, sections, counts, left-out line, tabs, show all (both outputs)', (g) => trackerChecks(env, g));
  await part('I2', 'Phase I Tracker behaviour: rows stay put, Do these with help, folds, Details and notes', (g) => trackerBehaviour(env, g));
  await part('I3', 'Phase I Do it for me list: one tick per group, folds, optional section', async (g) => { await guidedChecks(env, g); await guidedGroupRule(env, g); });
  await part('I4', 'Phase I missing info: lines and notices on all three pages, counting rule', async (g) => { await missingLinesAndNotices(env, g); await countingRule(env, g); });
  await part('I5', 'Phase I My info hints: N programs depend on this', (g) => infoHints(env, g));
  await part('I6', 'Phase I hand-off to My info: focus, highlight, back link, used once, nothing stored', (g) => handoffs(env, g));
  await part('I7', 'Phase I accessibility and layout: 44px targets, contrast, no sideways overflow at 390 and 320', (g) => a11yAndLayout(env, g));
}
