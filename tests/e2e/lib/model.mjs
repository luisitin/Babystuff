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

// Phase J: the one hide rule. What the Programs page works on for a state ('' for none), the person's answers, the statuses
// ({ id: status }) and the reasons the person chose to show for now ({ reason: true }). Everything goes through L.splitHidden.
export function splitFor({ state = '', profile = {}, statuses = {}, shown = {}, list = ALL } = {}) {
  return L.splitHidden(list, { state, profile: Object.assign({ state }, profile), statusOf: (id) => (statuses && statuses[id]) || 'todo' }, shown);
}
// showOther (old name): true shows the other-state programs. Optional profile (answers) and statuses.
export function poolFor(state, showOther, profile, statuses) {
  return splitFor({ state, profile: profile || {}, statuses: statuses || {}, shown: showOther ? { otherState: true } : {} }).pool;
}
// The lead cards (and the programs behind them) for a sort and a filter set.
export function shownFor(state, showOther, opts, sort, profile, statuses) {
  const pool = poolFor(state, showOther, profile, statuses);
  const shown = L.sortPrograms(L.filterPrograms(pool, Object.assign({}, opts, { state })), sort || 'best');
  return { pool, shown, groups: L.collapseGroups(shown), ranks: L.rankMap(pool) };
}
export const distinct = (list) => new Set(list.map(L.groupKey)).size;

// Summary numbers the Directory shows over a pool.
export function summaryFor(pool, profile) {
  const free = pool.filter((p) => L.isTrulyFree(p) && L.isOpenToAll(p));
  const tv = L.totalValue(free);
  const more = distinct(pool.filter((p) => { const v = L.verdict(p); return L.needsQualifying(p) && (v === 'top' || v === 'good' || v === 'small') && L.fit(p, L.hasSituation(profile) ? profile : {}) !== 'no'; }));
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

// ---- Phase I: the Tracker's own to-do list and the missing-info lines ----
export const MISSING_KEYS = L.MISSING_KEYS;
export const statusFn = (map) => (id) => (map && map[id]) || 'todo';
// What the Tracker works out from the profile, the statuses and the "show all" switch.
export function trackerFor({ profile = {}, statuses = {}, all = false } = {}) {
  const sc = L.trackerScope(ALL, { state: profile.state, profile, all, statusOf: statusFn(statuses) });
  const weeks = L.weeksUntil(profile.dueDate);
  const secs = L.trackerSections(sc.rows, weeks);
  const c = { todo: 0, 'signed-up': 0, received: 0, skipped: 0, all: sc.rows.length };
  sc.rows.forEach((r) => { c[r.status]++; });
  c.done = c['signed-up'] + c.received;
  c.active = sc.rows.length - c.skipped;
  return { sc, weeks, secs, counts: c, ids: (rows) => rows.map((r) => r.p.id) };
}
// "X of N done (S not for me)" and the "Still to claim" sentence, worded from the module's own numbers.
export function doneText(c) { return c.done + ' of ' + c.active + ' done' + (c.skipped ? ' (' + c.skipped + ' not for me)' : ''); }
export function rangeText(t) {
  let lo = t.low, hi = t.high;
  if (t.count > 1) { lo = L.roundTotal(lo); hi = L.roundTotal(hi); }
  return Math.round(lo) === Math.round(hi) ? L.money(lo) : L.money(lo) + ' to ' + L.money(hi);
}
export function claimText(sc, secs) {
  const t = L.toClaim(sc.rows), parts = [];
  if (t.free.count) parts.push('about ' + rangeText(t.free) + ' in free things and covered care');
  if (t.money.count) parts.push('about ' + rangeText(t.money) + ' in money programs (tax credits, deposits, paid leave) if you qualify');
  if (parts.length) return 'Still to claim: ' + parts.join(', and ') + '.';
  if (secs.now.length + secs.later.length) return 'Still to claim: no known dollar value for what is left on your list.';
  return 'Nothing left to claim on your list.';
}
// The sentence of a missing-info line for a program (null when nothing is missing).
export function missLineFor(p, profile) {
  const keys = L.missingInfo(p, profile);
  if (!keys.length) return null;
  let lead = '';
  if (keys.includes('state')) { lead = L.onlyInText(p); if (lead) lead += '. '; }
  return { keys, data: keys.join(' '), text: lead + 'My info is missing ' + L.missingInfoText(keys) + '.', link: keys.length > 1 ? 'Add them' : 'Add it', first: keys[0] };
}
export const countsFor = (profile, statuses) => L.missingInfoCounts(ALL, profile, statusFn(statuses));
export const keysWithCount = (counts) => MISSING_KEYS.filter((k) => counts.keys[k] > 0);
// Programs that carry a missing-info line for a profile (still to do), best first.
export const withLine = (profile, statuses) => L.rankPrograms(ALL).filter((p) => statusFn(statuses)(p.id) === 'todo' && L.missingInfo(p, profile).length > 0);
