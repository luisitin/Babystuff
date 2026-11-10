// The expected answers for the Phase G checks, worked out in Node from data/programs.json with the real
// logic, email and fieldmatch modules. The browser checks compare what the page shows with these numbers,
// so no count is typed in by hand.
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, PROGRAMS } from './harness.mjs';

const req = createRequire(path.join(ROOT, 'src', 'js', 'model.cjs'));
export const L = req('./logic.js');
export const E = req('./email.js');
export const FM = req('./fieldmatch.js');
export const ALL = PROGRAMS;
export const byId = Object.fromEntries(ALL.map((p) => [p.id, p]));

// What the Directory works on for a state ('' for none) and the "Show them" setting.
export function poolFor(state, showOther) {
  const hide = L.otherStateCount(ALL, state) > 0 && !showOther;
  return L.filterPrograms(ALL, { state, hideOtherStates: hide });
}
// The lead cards (and the programs behind them) for a sort and a filter set.
export function shownFor(state, showOther, opts, sort) {
  const pool = poolFor(state, showOther);
  const hide = L.otherStateCount(ALL, state) > 0 && !showOther;
  const shown = L.sortPrograms(L.filterPrograms(pool, Object.assign({}, opts, { state, hideOtherStates: hide })), sort || 'best');
  return { pool, shown, groups: L.collapseGroups(shown), ranks: L.rankMap(pool) };
}
export const distinct = (list) => new Set(list.map(L.groupKey)).size;

// Summary numbers the Directory shows over a pool.
export function summaryFor(pool) {
  const free = pool.filter((p) => L.isTrulyFree(p) && L.isOpenToAll(p));
  const tv = L.totalValue(free);
  const more = distinct(pool.filter((p) => { const v = L.verdict(p); return L.needsQualifying(p) && (v === 'top' || v === 'good' || v === 'small'); }));
  return {
    free, freeGroups: distinct(free), tv, more,
    lo: L.roundTotal(tv.low), hi: L.roundTotal(tv.high),
    noValue: free.filter((p) => L.valueMid(p) === null).length
  };
}

// ISO date n days from today in local time (the page reads its own clock the same way).
export function isoInDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

// Registrable domain of a sign-up page, and the programs on each domain.
export const domainOf = (p) => FM.registrableDomain(p.signupUrl);
export const byDomain = (() => {
  const m = {};
  ALL.forEach((p) => { (m[domainOf(p)] = m[domainOf(p)] || []).push(p); });
  return m;
})();
