// Groups 11 and 12: Phase G (what is really free, ranking, same-thing groups, state rule, due-date plan,
// guided run order and plus addresses, tracker value line and email features). Every expected number is
// worked out from data/programs.json in lib/model.mjs, never typed in.
import fs from 'node:fs';
import { PROFILE, open, clean, runGroup, setStatuses, revealPick, openTools, trkTab, showAllRows, revealRow, openRowDetails, openAllPanels, reloadAfterWrite, hiddenBoxState, toggleReason } from './harness.mjs';
import { L, E, ALL, byId, poolFor, shownFor, distinct, summaryFor, isoInDays } from './model.mjs';

const norm = (s) => String(s === null || s === undefined ? '' : s).replace(/\s+/g, ' ').trim();
const MODES = ['standalone', 'artifact'];
const BASE = { firstName: 'Sam', lastName: 'Sample', email: 'e2e.sample.user@gmail.com', phone: '5555550123', address1: '123 Example Street', address2: 'Apt 4B', city: 'Springfield', zip: '75001' };
const prof = (o) => Object.assign({}, BASE, o || {});
const ids = (arr) => arr.map((p) => p.id);
const sameSet = (a, b) => a.length === b.length && new Set(a).size === a.length && b.every((x) => a.includes(x));
const diff = (a, b) => 'page-only: ' + a.filter((x) => !b.includes(x)).slice(0, 3).join(',') + ' | model-only: ' + b.filter((x) => !a.includes(x)).slice(0, 3).join(',');

const SCRAPE = `(() => [...document.querySelectorAll('#view-directory article.card')].map((c) => {
  const t = (s) => { const e = c.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
  return { id: c.dataset.programId, grouped: !!c.closest('details.same-group'), rank: t('.rank'), verdict: t('.badge-verdict'), free: t('.free-line'), value: (t('.value-line') || '') + (t('.value-basis') ? ' ' + t('.value-basis') : ''),
    chips: [...c.querySelectorAll('ul.offer-chips li')].map((x) => x.textContent.trim()),
    facts: [...c.querySelectorAll('dl.facts > div')].map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.replace(/\\s+/g, ' ').trim()]),
    tags: [...c.querySelectorAll('.tag-qualify, .tag-fit, .tag-nomatch, .tag-state')].map((x) => x.textContent.trim()), same: t('.same-as'), more: !!c.querySelector('button.card-toggle[aria-controls]'), level: (c.querySelector('h3,h4') || {}).tagName };
}))()`;
const SECTIONS = `(() => [...document.querySelectorAll('#view-directory section.dir-group')].map((s) => ({ key: s.id.replace('dir-group-', ''), head: s.querySelector('.group-title').textContent.replace(/\\s+/g, ' ').trim(),
  count: s.querySelector('.group-count').textContent, leads: [...s.querySelectorAll('article.card')].filter((c) => !c.closest('details.same-group')).map((c) => c.dataset.programId), cards: s.querySelectorAll('article.card').length })))()`;
const HEADINGS = `(() => [...document.querySelectorAll('#view-directory h1,#view-directory h2,#view-directory h3,#view-directory h4,#view-directory h5,#view-directory h6')].map((h) => +h.tagName[1]))()`;
const shownIds = (page) => page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].map((c) => c.dataset.programId));
const leadIds = (page) => page.evaluate(() => [...document.querySelectorAll('#view-directory article.card')].filter((c) => !c.closest('details.same-group')).map((c) => c.dataset.programId));
const countLine = (page) => page.locator('#view-directory .result-count').innerText();
const chip = (page, name) => page.locator('#view-directory label.chip-toggle', { hasText: name }).locator('input');
const pick = (page, label) => page.locator('#view-directory .field', { has: page.locator('label', { hasText: label }) }).locator('select');
const setSort = (page, v) => pick(page, 'Sort by').selectOption(v);
const settle = (page) => page.waitForTimeout(300);
const money = L.money;
const OSB = '#view-directory details.dir-hidden li[data-reason="otherState"] button';
const focusOnOS = (page) => page.evaluate((s) => document.activeElement === document.querySelector(s), OSB);
const HB_FOOT = 'These numbers count every tab and ignore the search and filters. What you show here is hidden again the next time you open the app.';

const expectedFacts = (p) => {
  const f = [];
  f.push(['How sure', L.CERTAINTY_LABELS[p.certainty]], ['Effort', L.EFFORT_LABELS[p.effort]], ['Best time', L.WHEN_LABELS[p.when] + (p.whenNote ? '. ' + p.whenNote : '')]);
  if (p.states.length) f.push(['Only in', p.states.join(', ')]);
  return f.map((x) => [x[0], norm(x[1])]);
};
const expectedValue = (p) => norm(L.valueText(p) + (p.valueBasis ? ' ' + p.valueBasis : ''));

export async function directoryG(env) {
  const { browser } = env;
  await runGroup('11 Phase G directory: best-value order, ranks, Truly free, filters, summary, Show these, state rule, same-thing groups, due-date plan, old prefs', async (g) => {
    // model facts the checks lean on (computed, so a data change cannot make them stale)
    const stateOnly = ALL.filter((p) => p.states.length);
    g.check('data has state-only programs, same-thing groups, null-value programs and estimate and official values', stateOnly.length > 5 && ALL.some((p) => p.sameAs) && ALL.some((p) => p.valueLow === null) && ALL.some((p) => p.valueSource === 'estimate') && ALL.some((p) => p.valueSource === 'official'));

    for (const mode of MODES) {
      const tag = mode + ': ';
      // ---------- no state, no due date: the default view ----------
      {
        const h = await open(browser, { mode });
        const page = h.page;
        const M = shownFor('', false, {}, 'best');
        const pool = M.pool;
        const nHidden = L.otherStateCount(ALL, '');
        // state line and what is hidden
        const hb0 = await hiddenBoxState(page); const osLine = hb0.lines.find((l) => l.reason === 'otherState') || {};
        g.check(tag + 'no state: the box says N only for some states and asks to add a state', hb0.present && osLine.text === nHidden + ' only for some states. Add your state in My info to see the ones for you.' && hb0.summary === 'Hidden from this list: ' + nHidden + ' programs' && hb0.lines.length === 1, JSON.stringify(hb0));
        g.check(tag + 'no state: the line links to My info (data-info-key=state) and has a Show button', osLine.link === 'My info' && (await page.locator(OSB).count()) === 1 && osLine.btnVisible === 'Show' && hb0.foot === HB_FOOT, JSON.stringify(osLine));
        const cards = await page.evaluate(SCRAPE);
        const cardIds = cards.map((c) => c.id);
        g.check(tag + 'no state: state-only programs are not in the list, everything else is', sameSet(cardIds, ids(pool)) && stateOnly.every((p) => !cardIds.includes(p.id)), diff(cardIds, ids(pool)));
        g.check(tag + 'no state: count line says Showing N of N with the same N as the programs listed', norm(await countLine(page)) === 'Showing ' + pool.length + ' of ' + pool.length + ' programs' && cards.length === pool.length, await countLine(page));
        g.check(tag + 'the sort select defaults to Best value first', (await pick(page, 'Sort by').inputValue()) === 'best');
        const hd = await page.evaluate(HEADINGS);
        g.check(tag + 'heading levels never skip', hd.length > 10 && hd.every((x, i) => i === 0 || x <= hd[i - 1] + 1), hd.slice(0, 12).join(','));

        // best-value groups: order, "(N)", lead cards
        const secs = await page.evaluate(SECTIONS);
        const wantSecs = L.VERDICTS.map((v) => ({ v, items: M.groups.filter((x) => L.verdict(x.lead) === v.id) })).filter((x) => x.items.length);
        g.check(tag + 'all five verdict groups appear in the contract order', wantSecs.length === 5 && JSON.stringify(secs.map((s) => s.key)) === JSON.stringify(L.VERDICTS.map((v) => v.id)), JSON.stringify(secs.map((s) => s.key)));
        g.check(tag + 'group headings read "Label (N)" with N = lead cards under them', secs.length === wantSecs.length && secs.every((s, i) => s.head === wantSecs[i].v.label + ' (' + wantSecs[i].items.length + ')' && s.leads.length === wantSecs[i].items.length), secs.map((s) => s.head + '/' + s.leads.length).join(' | '));
        g.check(tag + 'lead cards sit in the group of their verdict, in best-value order', secs.every((s, i) => JSON.stringify(s.leads) === JSON.stringify(wantSecs[i].items.map((x) => x.lead.id))));
        g.check(tag + 'group headings are h3 and cards are h4', cards.every((c) => c.level === 'H4'));

        // ranks
        const leadsInOrder = cards.filter((c) => !c.grouped);
        const ranks = leadsInOrder.map((c) => +String(c.rank).replace('#', ''));
        g.check(tag + 'every card shows a rank like #3', cards.every((c) => /^#\d+$/.test(c.rank || '')), cards.filter((c) => !/^#\d+$/.test(c.rank || '')).map((c) => c.id).slice(0, 3).join(','));
        g.check(tag + 'lead ranks run 1, 2, 3 ... with no gaps and match the logic module', ranks.every((r, i) => r === i + 1 && r === M.ranks[leadsInOrder[i].id]) && ranks.length === M.groups.length, ranks.slice(0, 12).join(','));
        g.check(tag + 'every card (grouped ones too) shows the module rank', cards.every((c) => c.rank === '#' + M.ranks[c.id]), cards.filter((c) => c.rank !== '#' + M.ranks[c.id]).map((c) => c.id + ' ' + c.rank).slice(0, 3).join(','));

        // card lines, every card
        const bad = { free: [], value: [], chips: [], facts: [], verdict: [], more: [], tags: [], same: [] };
        for (const c of cards) {
          const p = byId[c.id];
          const free = norm(p.freeStuff.trim() ? 'Free with no purchase: ' + p.freeStuff : L.freeNote(p));
          if (c.free !== free) bad.free.push(c.id + ': ' + c.free);
          if (c.value !== expectedValue(p)) bad.value.push(c.id + ': ' + c.value);
          if (JSON.stringify(c.chips) !== JSON.stringify(p.offers.map((o) => L.OFFER_LABELS[o]))) bad.chips.push(c.id);
          if (JSON.stringify(c.facts) !== JSON.stringify(expectedFacts(p))) bad.facts.push(c.id + ': ' + JSON.stringify(c.facts));
          const vl = L.VERDICTS.find((v) => v.id === L.verdict(p)).label;
          if (c.verdict !== vl) bad.verdict.push(c.id + ': ' + c.verdict);
          if (!c.more) bad.more.push(c.id);
          const wantTags = p.certainty === 'if-eligible' ? ['If you qualify'] : [];
          if (JSON.stringify(c.tags) !== JSON.stringify(wantTags)) bad.tags.push(c.id + ': ' + c.tags);
          const wantSame = p.sameAs ? 'Another way to get the same thing as ' + byId[p.sameAs].name + '. You only need one.' : null;
          if (c.same !== wantSame) bad.same.push(c.id + ': ' + c.same);
        }
        g.check(tag + 'every card has its "Free with no purchase" line (or the right note)', bad.free.length === 0, bad.free.slice(0, 2).join(' | '));
        g.check(tag + 'every card has its value line with the basis', bad.value.length === 0, bad.value.slice(0, 2).join(' | '));
        g.check(tag + 'value lines say "our estimate" for estimates and "the program\'s figure" for official figures', cards.every((c) => { const p = byId[c.id]; if (p.valueLow === null) return /^Value not known/.test(c.value); return p.valueSource === 'official' ? c.value.includes("(the program's figure)") : c.value.includes('(our estimate)'); }) && cards.some((c) => c.value.includes('(our estimate)')) && cards.some((c) => c.value.includes("(the program's figure)")) && cards.some((c) => /^Value not known/.test(c.value)));
        g.check(tag + 'every card shows its offer chips in the program\'s order', bad.chips.length === 0, bad.chips.slice(0, 3).join(','));
        g.check(tag + 'every card shows How sure, Effort and Best time (and Only in for state programs)', bad.facts.length === 0, bad.facts.slice(0, 2).join(' | '));
        g.check(tag + 'every card shows its verdict badge', bad.verdict.length === 0, bad.verdict.slice(0, 3).join(' | '));
        g.check(tag + 'if-eligible cards carry the "If you qualify" tag and no other tag shows without a state', bad.tags.length === 0, bad.tags.slice(0, 3).join(' | '));
        g.check(tag + 'same-thing cards say which main program they repeat', bad.same.length === 0 && cards.some((c) => c.same), bad.same.slice(0, 2).join(' | '));
        // More details opens
        const first = page.locator('#view-directory article.card').first();
        const det = first.locator('.card-more');
        g.check(tag + 'card details are closed at first', await det.evaluate((d) => d.hidden));
        await first.locator('button.card-toggle').click();
        g.check(tag + 'Details opens and shows What you need and the verified line', !(await det.evaluate((d) => d.hidden)) && /What you need|Verified/.test(await det.innerText()) && /Verified \d{4}-\d{2}-\d{2}/.test(await det.innerText()));

        // same-thing groups
        const sg = await page.evaluate(() => [...document.querySelectorAll('#view-directory details.same-group')].map((d) => ({ key: d.dataset.group, open: d.open, sum: d.querySelector('summary').textContent.trim(), cards: [...d.querySelectorAll('article.card')].map((c) => ({ id: c.dataset.programId, rank: c.querySelector('.rank').textContent })) })));
        const wantG = M.groups.filter((x) => x.others.length);
        g.check(tag + 'one details.same-group per group with several members, closed at first', sg.length === wantG.length && wantG.length > 0 && sg.every((d) => !d.open), sg.length + ' vs ' + wantG.length);
        g.check(tag + 'same-group summary says "N more ways to get the same thing" with the right N', wantG.every((x) => { const d = sg.find((s) => s.key === L.groupKey(x.lead)); const n = x.others.length; return d && d.sum === (n === 1 ? '1 more way to get the same thing' : n + ' more ways to get the same thing'); }), JSON.stringify(sg.map((d) => d.sum)));
        g.check(tag + 'same-group cards are the other members and share the lead\'s rank', wantG.every((x) => { const d = sg.find((s) => s.key === L.groupKey(x.lead)); return d && sameSet(d.cards.map((c) => c.id), ids(x.others)) && d.cards.every((c) => c.rank === '#' + M.ranks[x.lead.id]); }));
        const sum0 = page.locator('#view-directory details.same-group > summary').first();
        await sum0.click();
        g.check(tag + 'tapping the summary opens the group', await page.locator('#view-directory details.same-group').first().evaluate((d) => d.open));
        await setSort(page, 'name'); await settle(page);
        g.check(tag + 'an open group stays open after the list is drawn again', await page.locator('#view-directory details.same-group').first().evaluate((d) => d.open));
        await setSort(page, 'best'); await settle(page);

        // summary numbers
        const S = summaryFor(pool);
        const main = norm(await page.locator('#view-directory .dir-summary .sum-main').first().innerText());
        // The estimate note and the count of programs with no known value are part of the main line now.
        const skipNote = S.noValue ? '; ' + S.noValue + (S.noValue === 1 ? ' has' : ' have') + ' no known value and ' + (S.noValue === 1 ? 'is' : 'are') + ' not counted' : '';
        const wantMain = S.freeGroups + ' truly free ' + (S.freeGroups === 1 ? 'program' : 'programs') + ' open to everyone' + (S.tv.count ? ', worth about ' + (S.lo === S.hi ? money(S.lo) : money(S.lo) + ' to ' + money(S.hi)) + ' together (our estimate, from ordinary shelf prices' + skipNote + ').' : '. No dollar value is known for these programs yet.');
        g.check(tag + 'summary counts truly free programs open to everyone by distinct group, with the rounded value, the estimate note and the no-value count', main === wantMain, main + ' vs ' + wantMain);
        const sumText = norm(await page.locator('#view-directory .dir-summary').innerText());
        g.check(tag + 'summary says the figure is our estimate (in the main line, no separate note line any more)', sumText.includes('our estimate, from ordinary shelf prices') && !sumText.includes('This is our estimate') && (await page.locator('#view-directory .dir-summary .sum-main').first().locator('xpath=..').locator('.dir-note').count()) === 0, sumText.slice(0, 300));
        g.check(tag + 'summary says how many more are free if you qualify (distinct groups)', sumText.includes(S.more + ' more ' + (S.more === 1 ? 'is' : 'are') + ' free if you qualify.'), sumText);
        g.check(tag + 'summary asks for a due date when none is saved', sumText.includes('Add your due date in My info') && (await page.locator('#view-directory .when-buttons button').count()) === 0);

        // Truly free chip
        await chip(page, 'Truly free').check(); await settle(page);
        const tf = await shownIds(page);
        const tfWant = L.filterPrograms(pool, { trulyFree: true });
        g.check(tag + 'Truly free: exactly the programs the module calls truly free', sameSet(tf, ids(tfWant)) && tf.length > 5, diff(tf, ids(tfWant)));
        g.check(tag + 'Truly free: every shown card passes isTrulyFree', tf.every((id) => L.isTrulyFree(byId[id])));
        g.check(tag + 'Truly free: no card starts with prize draws, coupons, points or testing, none is a chance, none costs', tf.every((id) => { const p = byId[id]; return !['sweepstakes', 'coupons', 'points', 'testing'].includes(p.offers[0]) && p.certainty !== 'chance' && p.costToClaim === 'free' && !p.requirements.includes('purchase') && !p.requirements.includes('membership'); }));
        g.check(tag + 'Truly free: the explanation line is shown', norm(await page.locator('#view-directory .dir-note', { hasText: 'Truly free:' }).first().innerText()) === 'Truly free: real products or samples at no cost. No purchase, no fee, not a prize draw.');
        g.check(tag + 'Truly free: count line matches', norm(await countLine(page)) === 'Showing ' + tfWant.length + ' of ' + pool.length + ' programs', await countLine(page));
        await chip(page, 'Truly free').uncheck(); await settle(page);
        // Open to everyone
        await chip(page, 'Open to everyone').check(); await settle(page);
        const oa = await shownIds(page);
        g.check(tag + 'Open to everyone: exactly the programs the module calls open to all', sameSet(oa, ids(L.filterPrograms(pool, { openToAll: true }))) && oa.every((id) => L.isOpenToAll(byId[id])) && oa.length < pool.length, diff(oa, ids(L.filterPrograms(pool, { openToAll: true }))));
        await chip(page, 'Open to everyone').uncheck(); await settle(page);
        // Email only and Needs a registry
        await chip(page, 'Email only').check(); await settle(page);
        g.check(tag + 'Email only: matches the module', sameSet(await shownIds(page), ids(L.filterPrograms(pool, { emailOnly: true }))));
        await chip(page, 'Email only').uncheck();
        await chip(page, 'Needs a registry').check(); await settle(page);
        g.check(tag + 'Needs a registry: matches the module', sameSet(await shownIds(page), ids(L.filterPrograms(pool, { needsRegistry: true }))));
        await chip(page, 'Needs a registry').uncheck(); await settle(page);
        // What you get
        const sel = pick(page, 'What you get');
        const opts = await sel.locator('option').evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
        g.check(tag + 'What you get lists Anything and the eight kinds with their labels', opts.length === 9 && opts[0][0] === '' && opts[0][1] === 'Anything' && Object.keys(L.OFFER_LABELS).every((k) => opts.some((o) => o[0] === k && o[1] === L.OFFER_LABELS[k])), JSON.stringify(opts));
        const offBad = [];
        for (const k of Object.keys(L.OFFER_LABELS)) {
          await sel.selectOption(k); await settle(page);
          const got = await shownIds(page), want = ids(L.filterPrograms(pool, { offer: k }));
          if (!sameSet(got, want) || !got.length) offBad.push(k + ' ' + got.length + '/' + want.length);
        }
        g.check(tag + 'What you get: each of the eight kinds keeps exactly the programs that give it', offBad.length === 0, offBad.join(', '));
        await sel.selectOption('');
        await page.locator('#view-directory input[type=search]').fill('pump'); await page.waitForTimeout(400);
        g.check(tag + 'search text matches the module (name, brand, what you get, notes, who, free stuff)', sameSet(await shownIds(page), ids(L.filterPrograms(pool, { query: 'pump' }))));
        await page.locator('#view-directory input[type=search]').fill(''); await page.waitForTimeout(300);

        // Show these
        await page.locator('#view-directory input[type=search]').fill('e'); await page.waitForTimeout(300);
        await pick(page, 'Category').selectOption('formula');
        await sel.selectOption('coupons');
        await chip(page, 'Email only').check();
        await chip(page, 'Needs a registry').check();
        await setSort(page, 'name'); await settle(page);
        await page.locator('#view-directory button.show-these').click(); await settle(page);
        const st = await page.evaluate(() => ({
          tf: document.querySelector('label.chip-toggle input[type=checkbox]') && [...document.querySelectorAll('#view-directory label.chip-toggle')].map((l) => l.textContent.trim() + '=' + l.querySelector('input').checked).join('; '),
          q: document.querySelector('#view-directory input[type=search]').value, active: document.activeElement.className, btns: document.querySelectorAll('#view-directory button.show-these').length }));
        g.check(tag + 'Show these: Truly free and Open to everyone on, Email only and Needs a registry off', st.tf === 'Truly free=true; Open to everyone=true; Email only=false; Needs a registry=false; Fits my answers=false', st.tf);
        g.check(tag + 'Show these: search text, Category and What you get are cleared, the sort stays', st.q === '' && (await pick(page, 'Category').inputValue()) === '' && (await sel.inputValue()) === '' && (await pick(page, 'Sort by').inputValue()) === 'name');
        const SS = summaryFor(pool);
        const figure = +(/^(\d+) truly free/.exec(norm(await page.locator('#view-directory .dir-summary .sum-main').first().innerText())) || [0, -1])[1];
        g.check(tag + 'Show these: the count line equals the summary figure and the module', norm(await countLine(page)) === 'Showing ' + SS.free.length + ' of ' + pool.length + ' programs' && figure === SS.freeGroups && SS.free.length === SS.freeGroups, await countLine(page) + ' figure=' + figure);
        g.check(tag + 'Show these: focus is on the result count, and the button is gone', st.active.includes('result-count') && st.btns === 0, st.active);
        g.check(tag + 'Show these: only truly free programs open to everyone are listed', sameSet(await shownIds(page), ids(SS.free)));
        await page.locator('#view-directory button.btn-small', { hasText: 'Clear filters' }).first().click(); await h.showAll(); // Clear filters also returns to the Free stuff tab
        // Show them / Hide them without a state
        await toggleReason(page, 'otherState');
        const hb2 = await hiddenBoxState(page); const os2 = hb2.lines.find((l) => l.reason === 'otherState') || {};
        g.check(tag + 'no state: Show lists the state-only programs, the line says (shown for now) before the full stop and the button becomes Hide', sameSet(await shownIds(page), ids(L.filterPrograms(ALL, {}))) && os2.text === nHidden + ' only for some states (shown for now). Add your state in My info to see the ones for you.' && os2.btnVisible === 'Hide' && hb2.summary === 'Nothing is hidden right now (' + nHidden + ' normally are)', JSON.stringify(hb2));
        g.check(tag + 'no state: focus stays on the Show / Hide button', await focusOnOS(page));
        const rk = await page.evaluate(SCRAPE);
        const M2 = shownFor('', true, {}, 'best');
        g.check(tag + 'with them shown, ranks are worked out over all programs and still have no gaps', rk.every((c) => c.rank === '#' + M2.ranks[c.id]) && new Set(rk.map((c) => c.rank)).size === M2.groups.length);
        await toggleReason(page, 'otherState');
        g.check(tag + 'Hide hides them again and keeps focus on the button', sameSet(await shownIds(page), ids(pool)) && (await focusOnOS(page)));
        clean(g, h, tag + 'default view');
        await h.ctx.close();
      }

      // ---------- state TX ----------
      {
        const h = await open(browser, { mode, profile: prof({ state: 'TX' }) });
        const page = h.page;
        const M = shownFor('TX', false, {}, 'best');
        const nHidden = L.otherStateCount(ALL, 'TX');
        const txOnly = ALL.filter((p) => p.states.includes('TX'));
        const hbT = await hiddenBoxState(page); const osT = hbT.lines.find((l) => l.reason === 'otherState') || {};
        g.check(tag + 'state TX: the box says N for other states and does not ask for a state', osT.text === nHidden + ' for other states' && osT.link === null && hbT.lines.length === 1 && hbT.summary === 'Hidden from this list: ' + nHidden + ' programs', JSON.stringify(hbT));
        const got = await shownIds(page);
        g.check(tag + 'state TX: programs of other states are hidden, Texas and nationwide programs shown', sameSet(got, ids(M.pool)) && got.every((id) => !byId[id].states.length || byId[id].states.includes('TX')), diff(got, ids(M.pool)));
        const cards = await page.evaluate(SCRAPE);
        g.check(tag + 'state TX: Texas programs carry the "In your state" tag and others do not', txOnly.length > 0 && cards.every((c) => c.tags.includes('In your state') === byId[c.id].states.includes('TX')), cards.filter((c) => c.tags.includes('In your state') !== byId[c.id].states.includes('TX')).map((c) => c.id).slice(0, 3).join(','));
        g.check(tag + 'state TX: ranks and group counts come from the shown programs and have no gaps', cards.every((c) => c.rank === '#' + M.ranks[c.id]) && JSON.stringify((await page.evaluate(SECTIONS)).map((s) => s.head)) === JSON.stringify(L.VERDICTS.map((v) => ({ v, n: M.groups.filter((x) => L.verdict(x.lead) === v.id).length })).filter((x) => x.n).map((x) => x.v.label + ' (' + x.n + ')')));
        await toggleReason(page, 'otherState');
        const all2 = await shownIds(page);
        const hbT2 = await hiddenBoxState(page); const osT2 = hbT2.lines.find((l) => l.reason === 'otherState') || {};
        g.check(tag + 'state TX: Show adds the other states, the line says (shown for now) and focus stays on the button', sameSet(all2, ids(L.filterPrograms(ALL, {}))) && osT2.text === nHidden + ' for other states (shown for now)' && (await focusOnOS(page)), JSON.stringify(osT2));
        await reloadAfterWrite(page); await page.waitForSelector('#view-directory article.card', { timeout: 4000 }).catch(() => {}); await settle(page);
        g.check(tag + 'state TX: the Show choice is never saved: after a reload the other states are hidden again and prefs holds no show key', sameSet(await shownIds(page), ids(M.pool)) && await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bff.prefs.v1') || '{}'); return !('showOtherStates' in p) && !('showNoFit' in p); }));
        await toggleReason(page, 'otherState');
        g.check(tag + 'state TX: Show then Hide, and Hide keeps focus', await toggleReason(page, 'otherState').then(async () => sameSet(await shownIds(page), ids(M.pool)) && (await focusOnOS(page))));
        clean(g, h, tag + 'state TX');
        await h.ctx.close();
      }

      // ---------- due date ----------
      const DUE = [
        { name: '10 weeks ahead (TX)', due: isoInDays(73), state: 'TX', head: null },
        { name: 'less than a week ahead', due: isoInDays(3), state: '', head: 'Your due date is less than a week away.' },
        { name: 'passed', due: isoInDays(-10), state: 'TX', head: 'Your due date has passed.' },
        { name: '10 weeks ahead with Truly free on', due: isoInDays(73), state: '', head: null, tf: true },
        { name: 'none', due: '', state: '', head: 'none' }
      ];
      for (const sc of DUE) {
        const h = await open(browser, { mode, profile: prof({ state: sc.state, dueDate: sc.due }) });
        const page = h.page;
        const label = tag + 'due date ' + sc.name + ': ';
        if (sc.tf) { await chip(page, 'Truly free').check(); await settle(page); }
        const opts = sc.tf ? { trulyFree: true } : {};
        const M = shownFor(sc.state, false, opts, 'when');
        const counts = {};
        M.groups.forEach((x) => { counts[x.lead.when] = (counts[x.lead.when] || 0) + 1; });
        const wk = sc.due ? L.weeksUntil(sc.due) : null;
        const sumText = norm(await page.locator('#view-directory .dir-summary').innerText());
        const btns = await page.locator('#view-directory .when-buttons button').evaluateAll((bs) => bs.map((b) => ({ n: b.querySelector('strong').textContent, text: b.textContent.replace(/\s+/g, ' ').trim(), vis: b.firstElementChild.textContent + '|' + b.childNodes[1].textContent, hidden: b.querySelector('.visually-hidden').textContent })));
        if (sc.head === 'none') {
          g.check(label + 'the summary says Add your due date in My info and offers no buttons', sumText.includes('Add your due date in My info to see what to do when. It stays on this device.') && btns.length === 0, sumText);
          clean(g, h, label); await h.ctx.close(); continue;
        }
        const head = sc.head || (wk + (wk === 1 ? ' week' : ' weeks') + ' until your due date.');
        g.check(label + 'the weeks-left text is right (' + wk + ')', sumText.includes(head) && !sumText.includes('Add your due date'), sumText.slice(0, 260));
        const defs = [['pregnancy', 'do now'], ['late-pregnancy', 'in the last weeks'], ['after-birth', 'after the birth']].filter((d) => wk === null || wk >= 0 || d[0] === 'after-birth');
        const want = defs.filter((d) => counts[d[0]]).map((d) => ({ key: d[0], label: d[1], n: counts[d[0]] }));
        g.check(label + 'buttons are the ones with a count above zero, in order, with the module counts', JSON.stringify(btns.map((b) => b.n)) === JSON.stringify(want.map((w) => String(w.n))) && want.length === btns.length, JSON.stringify(btns.map((b) => b.text)) + ' vs ' + JSON.stringify(want));
        if (wk !== null && wk < 0) g.check(label + 'only the after-birth button shows', btns.length === 1 && /after the birth/.test(btns[0].text), JSON.stringify(btns.map((b) => b.text)));
        else g.check(label + 'every button with a zero count is absent (and the page offers at most three)', btns.length <= 3 && defs.every((d) => !!counts[d[0]] === btns.some((b) => b.text.includes(d[1]))), JSON.stringify(btns.map((b) => b.text)));
        g.check(label + 'accessible names start with the visible text: "N do now, show these programs" (singular at 1)', want.every((w, i) => btns[i] && btns[i].text === w.n + ' ' + w.label + ', show ' + (w.n === 1 ? 'this program' : 'these programs')), JSON.stringify(btns.map((b) => b.text)));
        for (const w of want) {
          const name = w.n + ' ' + w.label + ', show ' + (w.n === 1 ? 'this program' : 'these programs');
          // Chrome puts a space before the comma because the hidden text is absolutely positioned; the words are the contract.
          const b = page.getByRole('button', { name: new RegExp('^' + w.n + ' ' + w.label + ' ?, show ' + (w.n === 1 ? 'this program' : 'these programs') + '$') });
          if ((await b.count()) !== 1) { g.check(label + 'button "' + name + '" found by its accessible name', false, String(await b.count())); continue; }
          await b.click(); await settle(page);
          const r = await page.evaluate((k) => { const s = document.getElementById('dir-group-' + k); const hd = s && s.querySelector('.group-title'); return { sort: document.querySelector('#view-directory select').value, exists: !!s, count: s ? s.querySelector('.group-count').textContent : '', leads: s ? [...s.querySelectorAll('article.card')].filter((c) => !c.closest('details.same-group')).length : -1, focus: !!hd && document.activeElement === hd }; }, w.key);
          const sortVal = await pick(page, 'Sort by').inputValue();
          g.check(label + '"' + name + '" jumps to its section: sort is by when, section "(' + w.n + ')" holds ' + w.n + ' lead cards, heading has focus', sortVal === 'when' && r.exists && r.count === '(' + w.n + ')' && r.leads === w.n && r.focus, JSON.stringify(r) + ' sort=' + sortVal);
        }
        if (!sc.tf && sc.state === 'TX' && wk >= 0) {
          const secs = await page.evaluate(SECTIONS);
          g.check(label + 'under the when sort the groups are in the when order and each lead is in its own section', secs.length > 0 && secs.every((s) => s.leads.every((id) => byId[id].when === s.key || s.key === 'none')), secs.map((s) => s.head).join(' | '));
        }
        clean(g, h, label);
        await h.ctx.close();
      }

      // ---------- saved preferences from older versions ----------
      for (const [name, prefs] of [
        ['sort recommended', { filters: { sort: 'recommended', query: '', category: '', trulyFree: false } }],
        ['offer constructor', { filters: { offer: 'constructor', sort: 'best' } }],
        ['offer __proto__ and unknown sort', { filters: { offer: '__proto__', category: 'toString', sort: 'nope', query: 7 } }],
        ['prefs is not an object', 'oops']
      ]) {
        const h = await open(browser, { mode, seed: { 'bff.prefs.v1': JSON.stringify(prefs) } });
        const page = h.page;
        const n = (await shownIds(page)).length;
        const M = shownFor('', false, {}, 'best');
        g.check(tag + 'old saved prefs (' + name + ') load: list is not empty and nothing is filtered by the bad value', n === M.pool.length && n > 0 && (await pick(page, 'What you get').inputValue()) === '' && (await pick(page, 'Sort by').inputValue()) === 'best', 'n=' + n + ' pool=' + M.pool.length);
        clean(g, h, tag + 'prefs ' + name);
        await h.ctx.close();
      }

      // ---------- phone width ----------
      {
        const h = await open(browser, { mode, viewport: { width: 375, height: 800 }, profile: prof({ state: 'TX', dueDate: isoInDays(80) }) });
        const page = h.page;
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        const m1 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        g.check(tag + '375px wide, every group and card open: no horizontal scroll on the directory', m1.sw <= m1.cw, m1.sw + ' > ' + m1.cw);
        await pick(page, 'Sort by').selectOption('when'); await settle(page);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        const m2 = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        g.check(tag + '375px wide, when sort: no horizontal scroll', m2.sw <= m2.cw, m2.sw + ' > ' + m2.cw);
        await h.ctx.close();
      }
    }
  });
}

// ---------------- group 12 ----------------
const PLUS_PROFILE = prof({ state: 'TX', usePlusTags: true });
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&');

export async function guidedTrackerG(env) {
  const { browser } = env;
  await runGroup('12 Phase G guided run, tracker value line and email features: rank order, state rule, plus addresses, one-benefit total, filters and searches', async (g) => {
    const plain = prof({ state: 'TX' });
    for (const mode of MODES) {
      const tag = mode + ': ';
      // ---------- guided setup ----------
      {
        const h = await open(browser, { mode, profile: plain, hash: 'guided' });
        const page = h.page;
        const M = shownFor('TX', false, {}, 'best');
        const dialogs = []; page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
        await h.go('guided');
        const rows = await page.evaluate(() => [...document.querySelectorAll('#view-guided ul.fx-pick input[type=checkbox]')].map((c) => ({ id: c.id.replace('gd-pick-', ''), on: c.checked })));
        // One row per group of the same thing (its other ways folded under it); offers that need a purchase and long shots come last.
        const gGroups = L.collapseGroups(L.rankPrograms(M.pool));
        const isSide = (x) => ['conditional', 'longshot'].includes(L.verdict(x.lead));
        const flat = (list) => list.flatMap((x) => [x.lead].concat(x.others));
        const wantOrder = ids(flat(gGroups.filter((x) => !isSide(x))).concat(flat(gGroups.filter(isSide))));
        g.check(tag + 'guided list follows the rank order of the programs left after the state rule (groups together, optional section last)', JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(wantOrder), rows.slice(0, 3).map((r) => r.id).join(','));
        // The default ticks at most one program per group: the best ranked one that is guidedDefault.
        const wantDefault = ids(gGroups.map((x) => flat([x]).find((p) => L.guidedDefault(p))).filter(Boolean));
        g.check(tag + 'guided default selection = the best guidedDefault program of each group, minus state-hidden programs', sameSet(rows.filter((r) => r.on).map((r) => r.id), wantDefault) && wantDefault.length > 3, diff(rows.filter((r) => r.on).map((r) => r.id), wantDefault));
        const hiddenIds = ALL.filter((p) => L.hiddenByState(p, 'TX')).map((p) => p.id);
        g.check(tag + 'guided list does not list a state-hidden program that is not selected', hiddenIds.length > 0 && hiddenIds.every((id) => !rows.some((r) => r.id === id)));
        g.check(tag + 'guided count line and Start button agree with the selection', (await page.locator('#view-guided .fx-count').innerText()) === wantDefault.length + ' of ' + gGroups.length + ' selected' && (await page.getByRole('button', { name: /^Start \(/ }).innerText()) === 'Start (' + wantDefault.length + ' program' + (wantDefault.length === 1 ? '' : 's') + ')');
        await page.getByRole('button', { name: 'Truly free only' }).click();
        const tfOn = await page.evaluate(() => [...document.querySelectorAll('#view-guided ul.fx-pick input:checked')].map((c) => c.id.replace('gd-pick-', '')));
        const tfWant = ids(gGroups.map((x) => x.lead).filter((p) => L.isTrulyFree(p))); // the lead of each group, never its other ways
        g.check(tag + 'guided "Truly free only" selects exactly the truly free lead program of each group (new meaning)', sameSet(tfOn, tfWant) && tfWant.length > 3, diff(tfOn, tfWant));
        // Start over asks inside the page
        await page.getByRole('button', { name: /^Start \(/ }).click(); await settle(page);
        const runLine = await page.locator('#view-guided .fx-run-count').innerText();
        await page.getByRole('button', { name: 'Start over' }).click(); await settle(page);
        g.check(tag + 'guided Start over asks for confirmation inside the page and no confirm() dialog opens', (await page.locator('#view-guided .fx-confirm').count()) === 1 && dialogs.length === 0 && (await page.locator('#view-guided .fx-run-count').innerText()) === runLine);
        await page.locator('#view-guided .fx-confirm').getByRole('button', { name: 'Cancel' }).click(); await settle(page);
        g.check(tag + 'guided Cancel keeps the run where it was', (await page.locator('#view-guided .fx-run-count').innerText()) === runLine && (await page.locator('#view-guided .fx-confirm').count()) === 0);
        await page.getByRole('button', { name: 'Start over' }).click();
        await page.locator('#view-guided .fx-confirm').getByRole('button', { name: 'Start over' }).click(); await settle(page);
        g.check(tag + 'guided confirming Start over returns to the list', (await page.getByRole('button', { name: /^Start \(/ }).count()) === 1 && dialogs.length === 0);
        clean(g, h, tag + 'guided setup');
        await h.ctx.close();
      }
      // ---------- guided: a selected state-hidden program stays listed ----------
      {
        const h = await open(browser, { mode, profile: plain });
        const page = h.page;
        const M = shownFor('TX', true, { trulyFree: true }, 'best');
        await toggleReason(page, 'otherState');
        await chip(page, 'Truly free').check(); await settle(page);
        await page.getByRole('button', { name: /^Start a guided run with these/ }).click();
        await page.waitForSelector('#view-guided:not([hidden])'); await settle(page);
        await h.go('directory');
        await toggleReason(page, 'otherState'); // Hide
        await h.go('guided');
        const listed = await page.evaluate(() => [...document.querySelectorAll('#view-guided ul.fx-pick input[type=checkbox]')].map((c) => ({ id: c.id.replace('gd-pick-', ''), on: c.checked })));
        const otherSel = ALL.filter((p) => L.hiddenByState(p, 'TX') && L.isTrulyFree(p)).map((p) => p.id);
        const otherNot = ALL.filter((p) => L.hiddenByState(p, 'TX') && !L.isTrulyFree(p)).map((p) => p.id);
        g.check(tag + 'guided: other-state programs picked from the directory stay listed and ticked, the ones not picked stay out', otherSel.length > 0 && otherSel.every((id) => listed.some((r) => r.id === id && r.on)) && otherNot.every((id) => !listed.some((r) => r.id === id)), 'sel=' + otherSel.length + ' listed=' + listed.length);
        g.check(tag + 'guided: the picked programs are the shown truly free ones', sameSet(listed.filter((r) => r.on).map((r) => r.id), ids(M.shown)), diff(listed.filter((r) => r.on).map((r) => r.id), ids(M.shown)));
        await h.ctx.close();
      }
      // ---------- guided run with plus addresses ----------
      {
        const h = await open(browser, { mode, profile: PLUS_PROFILE, hash: 'guided' });
        const page = h.page;
        const M = shownFor('TX', false, {}, 'best');
        const tags = await page.evaluate(() => BFF.plusTags.map());
        const plusOf = (id) => { const [l, d] = PLUS_PROFILE.email.split('@'); return l + '+' + tags[id] + '@' + d; };
        const feat = M.pool.find((p) => E.inEmailFeatures(p) && L.guidedDefault(p));
        const gov = M.pool.find((p) => !E.inEmailFeatures(p) && E.isGovDomain(E.domainOfUrl(p.signupUrl)));
        const noMail = M.pool.find((p) => !E.inEmailFeatures(p) && !E.isGovDomain(E.domainOfUrl(p.signupUrl)));
        g.check(tag + 'plus run: the data has a brand program, a government program and a non-gov program without an email requirement', !!feat && !!gov && !!noMail, [feat, gov, noMail].map((x) => x && x.id).join(','));
        for (const [kind, p, wantTag] of [['brand program that passes inEmailFeatures', feat, true], ['government program', gov, false], ['program with no email requirement', noMail, false]]) {
          if (!p) continue;
          await h.go('guided');
          await page.getByRole('button', { name: 'Select none' }).click();
          await revealPick(page, p.id);
          await page.locator('#gd-pick-' + p.id).check();
          await page.getByRole('button', { name: /^Start \(1 program\)$/ }).click(); await settle(page);
          const det = await page.evaluate(() => [...document.querySelectorAll('#view-guided ul.fx-details li')].map((li) => [li.querySelector('.fx-d-label').textContent.trim(), li.querySelector('button').textContent.trim()]));
          const tagged = det.find((d) => d[0] === 'Email for this program');
          const plainRow = det.find((d) => d[0] === 'Email' || d[0] === 'Email (plain)');
          if (wantTag) g.check(tag + 'plus run: ' + kind + ' shows its tagged address and the plain one', !!tagged && tagged[1] === plusOf(p.id) && plainRow && plainRow[1] === PLUS_PROFILE.email && plainRow[0] === 'Email (plain)', JSON.stringify(det.filter((d) => /mail/i.test(d[0]))));
          else g.check(tag + 'plus run: ' + kind + ' shows no tagged address, only the plain email', !tagged && !det.some((d) => d[1].includes('+')) && plainRow && plainRow[1] === PLUS_PROFILE.email && plainRow[0] === 'Email', JSON.stringify(det.filter((d) => /mail/i.test(d[0]))));
          await page.getByRole('button', { name: 'Start over' }).click();
          await page.locator('#view-guided .fx-confirm').getByRole('button', { name: 'Start over' }).click(); await settle(page);
        }
        clean(g, h, tag + 'plus run');
        await h.ctx.close();
      }
      // ---------- tracker ----------
      {
        const h = await open(browser, { mode, profile: PLUS_PROFILE, hash: 'tracker', perms: ['clipboard-read', 'clipboard-write'] });
        const page = h.page;
        await h.go('tracker');
        await openTools(page);
        const line = () => page.evaluate(() => { const p = [...document.querySelectorAll('#view-tracker p')].find((x) => /^Estimated value/.test(x.textContent) && !x.hidden); return p ? p.textContent.replace(/\s+/g, ' ').trim() : null; });
        const pump = 'healthcare-gov-insurance-covered-breast-pump';
        const doors = ALL.filter((p) => p.sameAs === pump).map((p) => p.id);
        const nullOne = ALL.find((p) => p.valueLow === null && !p.sameAs && !doors.includes(p.id) && p.id !== pump);
        const two = [pump].concat(doors.slice(0, 2));
        await setStatuses(page, Object.fromEntries(two.map((id) => [id, 'signed-up']))); await settle(page);
        const tv = L.totalValue(two.map((id) => byId[id]));
        const l1 = await line();
        g.check(tag + 'tracker: a main program and two of its doors count the benefit once, and nothing says a program has no known value', tv.count === 1 && tv.missing === 0 && l1 === 'Estimated value of what you have signed up for: about ' + (tv.low === tv.high ? money(tv.low) : money(tv.low) + ' to ' + money(tv.high)) + ' (our estimate)' && !/no known value/.test(l1), l1);
        await setStatuses(page, { [nullOne.id]: 'signed-up' }); await settle(page);
        const l2 = await line();
        g.check(tag + 'tracker: one program with no value adds the note "1 program with no known value is not counted"', /about .* \(our estimate; 1 program with no known value is not counted\)$/.test(l2 || '') && /\$/.test(l2), l2);
        await setStatuses(page, Object.fromEntries(two.map((id) => [id, 'todo']))); await settle(page);
        const l3 = await line();
        g.check(tag + 'tracker: only a no-value program signed up gives "not known (1 program with no known value)"', l3 === 'Estimated value of what you have signed up for: not known (1 program with no known value)', l3);
        await setStatuses(page, { [nullOne.id]: 'todo' }); await settle(page);
        g.check(tag + 'tracker: nothing signed up, no value line', (await line()) === null);

        // per-row address and Gmail link: they live in each row's Details panel, so show every program and open every panel
        await showAllRows(page); await openAllPanels(page);
        const rows = await page.evaluate(() => [...document.querySelectorAll('#view-tracker li.fx-trk-row')].map((r) => { const a = r.querySelector('.fx-trk-addr'); const gm = [...r.querySelectorAll('a')].find((x) => /Search my Gmail/.test(x.textContent)); return { id: r.dataset.id, addrShown: !a.hidden, addr: a.textContent, gmShown: !gm.hidden, href: gm.getAttribute('href') || '' }; }));
        const tags = await page.evaluate(() => BFF.plusTags.map());
        const plusOf = (id) => { const [l, d] = PLUS_PROFILE.email.split('@'); return l + '+' + tags[id] + '@' + d; };
        const rowBad = [];
        for (const r of rows) {
          const p = byId[r.id], inF = E.inEmailFeatures(p);
          if (inF) { if (!(r.addrShown && r.addr === 'Sign up with: ' + plusOf(r.id) && r.gmShown && r.href.startsWith('https://mail.google.com/mail/'))) rowBad.push(r.id + ' (should show)'); }
          else if (r.addrShown || r.gmShown || r.addr || r.href) rowBad.push(r.id + ' (should be bare)');
        }
        g.check(tag + 'tracker: every row has Sign up with and Search my Gmail only when the program passes inEmailFeatures (Gmail address, plus on)', rows.length === ALL.length && rowBad.length === 0, rowBad.slice(0, 4).join(', '));
        const govRow = rows.find((r) => r.id === 'tenncare-diaper-benefit') || rows.find((r) => !E.inEmailFeatures(byId[r.id]) && E.isGovDomain(E.domainOfUrl(byId[r.id].signupUrl)));
        const brand = rows.find((r) => E.inEmailFeatures(byId[r.id]));
        const rowOf = (id) => page.locator('#trk-p-' + id); // the row's own Details panel (a lead row also contains its other ways)
        if (govRow) await revealRow(page, govRow.id);
        if (brand) await revealRow(page, brand.id);
        g.check(tag + 'tracker: a government program row has no "Sign up with:" address and no "Search my Gmail" link', !!govRow && !(await rowOf(govRow.id).locator('.fx-trk-addr').isVisible()) && !(await rowOf(govRow.id).getByRole('link', { name: /Search my Gmail/ }).isVisible()) && !/Sign up with|Search my Gmail/.test(await rowOf(govRow.id).innerText()), govRow && JSON.stringify(govRow));
        g.check(tag + 'tracker: a brand program row has both', !!brand && (await rowOf(brand.id).getByText('Sign up with: ' + plusOf(brand.id)).isVisible()) && (await rowOf(brand.id).getByRole('link', { name: /Search my Gmail/ }).isVisible()));
        const nF = E.emailPrograms(ALL).length;
        g.check(tag + 'tracker: the number of visible plus addresses and Gmail links equals the programs that pass inEmailFeatures (' + nF + ')', rows.filter((r) => r.addrShown).length === nF && rows.filter((r) => r.gmShown).length === nF && nF < ALL.length);

        // Gmail filters (a real file in the standalone page)
        if (mode === 'standalone') {
          const [d] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), page.getByRole('button', { name: 'Download Gmail filters' }).click()]);
          const xml = fs.readFileSync(await d.path(), 'utf8');
          const labels = [...xml.matchAll(/name="label" value="([^"]*)"/g)].map((m) => unxml(m[1]));
          const tos = [...xml.matchAll(/name="to" value="([^"]*)"/g)].map((m) => unxml(m[1]));
          const wantLabels = E.emailPrograms(ALL).map((p) => 'Baby Freebies/' + p.name.replace(/\//g, '-').trim());
          const wantXml = E.gmailFiltersXml(ALL, { email: PLUS_PROFILE.email, usePlus: true, archive: false, tagMap: tags, allPrograms: ALL });
          g.check(tag + 'filters download: one filter per program that passes inEmailFeatures, with plus addresses', (xml.match(/<entry>/g) || []).length === nF && labels.length === nF && sameSet(labels, wantLabels) && tos.length === nF && tos.every((t) => /^e2e\.sample\.user\+[^@]+@gmail\.com$/.test(t)), 'entries=' + (xml.match(/<entry>/g) || []).length + ' want=' + nF);
          g.check(tag + 'filters download: no government or no-email program is labelled', ALL.filter((p) => !E.inEmailFeatures(p)).every((p) => !labels.includes('Baby Freebies/' + p.name.replace(/\//g, '-').trim())) && xml === wantXml);
        }
        clean(g, h, tag + 'tracker');
        await h.ctx.close();
      }
      // tracker filters without plus addresses: domain filters only for allowed programs
      if (mode === 'standalone') {
        const h = await open(browser, { mode, profile: prof({ state: 'TX', usePlusTags: false }), hash: 'tracker' });
        const page = h.page;
        await h.go('tracker');
        await openTools(page);
        const [d] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), page.getByRole('button', { name: 'Download Gmail filters' }).click()]);
        const xml = fs.readFileSync(await d.path(), 'utf8');
        const want = E.gmailFiltersXml(ALL, { email: BASE.email, usePlus: false, allPrograms: ALL });
        const froms = [...xml.matchAll(/name="from" value="([^"]*)"/g)].map((m) => m[1]);
        g.check(tag + 'filters download without plus: matches the module, only "from" domains, none from .gov or big retailers', xml === want && froms.length > 5 && froms.every((f) => !E.isBroadDomain(f)) && !/name="to"/.test(xml), froms.length + ' froms');
        await showAllRows(page); await openAllPanels(page);
        const rows = await page.evaluate(() => [...document.querySelectorAll('li.fx-trk-row')].map((r) => ({ addr: !r.querySelector('.fx-trk-addr').hidden })));
        g.check(tag + 'tracker without plus: no row shows a plus address', rows.length === ALL.length && rows.every((r) => !r.addr));
        clean(g, h, tag + 'tracker without plus');
        await h.ctx.close();
      }
    }
  });
}
