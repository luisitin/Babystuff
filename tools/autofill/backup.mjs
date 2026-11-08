// Pure helpers for the web app's backup file. No Playwright, no file access.
// Validation mirrors importJSON in src/js/tracker.js.
import { createRequire } from 'node:module';
import path from 'node:path';
import { isGuidedDefault } from './field-matcher.mjs';

const email = createRequire(import.meta.url)('../../src/js/email.js');

export const APP = 'baby-freebies-finder';
export const STATUSES = ['todo', 'signed-up', 'received', 'skipped'];
const MAX_BYTES = 1024 * 1024;
const MAX_ENTRIES = 2000;
const MAX_NOTE = 500;
const PROFILE_KEYS = ['firstName', 'lastName', 'email', 'phone', 'address1', 'address2', 'city', 'state', 'zip', 'dueDate'];
const TAG_RE = /^[a-z0-9-]{1,24}$/;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Parse and validate backup text. Returns { raw, tracker, profile|null }. Throws Error with a friendly message. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('That file is too large to be a backup (the limit is 1 MB).');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('That file is not valid JSON, so it cannot be a backup.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('That file is not a Baby Freebies Finder backup.');
  if (data.app !== APP) throw new Error('That file is not a Baby Freebies Finder backup (wrong app name).');
  if (data.version !== 1) throw new Error(`This backup has an unsupported version (${String(data.version)}).`);
  const t = data.tracker;
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new Error('The backup has no tracker section.');
  const ids = Object.keys(t).filter((id) => !BAD_KEYS.has(id));
  if (ids.length > MAX_ENTRIES) throw new Error(`This backup has too many entries (${ids.length}).`);
  const tracker = {};
  for (const id of ids) {
    const e = t[id];
    if (!e || typeof e !== 'object') throw new Error(`Entry "${id}" is malformed.`);
    if (!STATUSES.includes(e.status)) throw new Error(`Entry "${id}" has an unknown status.`);
    if (e.note !== undefined && typeof e.note !== 'string') throw new Error(`Entry "${id}" has a note that is not text.`);
    if (e.updatedAt !== undefined && typeof e.updatedAt !== 'string') throw new Error(`Entry "${id}" has a bad date.`);
    if (e.signedUpAt !== undefined && typeof e.signedUpAt !== 'string') throw new Error(`Entry "${id}" has a bad sign-up date.`);
    tracker[id] = { status: e.status, note: (e.note || '').slice(0, MAX_NOTE), updatedAt: (e.updatedAt || '').slice(0, 40) };
    if (e.signedUpAt) tracker[id].signedUpAt = e.signedUpAt.slice(0, 40);
  }
  let profile = null;
  if (data.profile !== undefined && data.profile !== null) {
    if (typeof data.profile !== 'object' || Array.isArray(data.profile)) throw new Error('The profile section is malformed.');
    profile = {};
    for (const k of PROFILE_KEYS) if (typeof data.profile[k] === 'string') profile[k] = data.profile[k].slice(0, 200);
    if (typeof data.profile.usePlusTags === 'boolean') profile.usePlusTags = data.profile.usePlusTags;
    const m = data.profile.plusTagMap;
    if (m !== undefined && m !== null) {
      if (typeof m !== 'object' || Array.isArray(m)) throw new Error('The saved plus-tag list is malformed.');
      const keys = Object.keys(m).filter((k) => !BAD_KEYS.has(k));
      if (keys.length > 5000) throw new Error('The saved plus-tag list is too long.');
      profile.plusTagMap = {};
      for (const k of keys) if (typeof m[k] === 'string' && TAG_RE.test(m[k])) profile.plusTagMap[k] = m[k];
    }
    if (profile.dueDate) profile.dueDate = toIsoDate(profile.dueDate);
  }
  return { raw: data, tracker, profile };
}

/** Accept YYYY-MM-DD or M/D/YYYY; anything else is returned unchanged. */
export function toIsoDate(s) {
  const v = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : v;
}

/** Programs still to do (missing entry counts as todo), in data order. */
export function selectTodo(programs, tracker, { includeAllTodo = false, only = null } = {}) {
  const onlySet = only ? new Set(only) : null;
  return programs.filter((p) => {
    if (onlySet && !onlySet.has(p.id)) return false;
    const st = tracker && tracker[p.id] ? tracker[p.id].status : 'todo';
    if (st !== 'todo') return false;
    return includeAllTodo || isGuidedDefault(p);
  });
}

/** Per-program profile: with plus tags on and supported, email becomes local+tag@domain. */
export function profileForProgram(profile, programs, id, { plusTags = false } = {}) {
  const base = { ...profile };
  const want = plusTags || profile.usePlusTags === true;
  if (!want || !profile.email) return { profile: base, plus: false, address: base.email || '' };
  if (email.supportsPlus(profile.email) === false) return { profile: base, plus: false, address: base.email };
  const saved = profile.plusTagMap && typeof profile.plusTagMap === 'object' ? profile.plusTagMap[id] : undefined;
  const tag = typeof saved === 'string' && TAG_RE.test(saved) ? saved : email.tagMap(programs)[id];
  const addr = email.plusAddress(profile.email, tag);
  if (!addr) return { profile: base, plus: false, address: base.email };
  base.email = addr;
  return { profile: base, plus: true, address: addr };
}

/** Map a prompt answer to a result, or null if unknown. Enter leaves the entry alone. */
export function parseAnswer(s) {
  const a = String(s ?? '').trim().toLowerCase();
  if (a === '') return 'leave';
  if (a === 'd') return 'done';
  if (a === 's') return 'skip';
  if (a === 'p') return 'problem';
  if (a === 'q') return 'quit';
  return null;
}

/**
 * Build the updated backup object. answers: { id: {result:'done'|'skip'|'problem'|'leave', note?} }.
 * Only answered entries change; everything else (entries, profile, unknown keys) is carried over.
 */
export function applyAnswers(raw, answers, nowIso) {
  const out = JSON.parse(JSON.stringify(raw));
  out.exportedAt = nowIso;
  for (const [id, a] of Object.entries(answers)) {
    if (BAD_KEYS.has(id) || !a || a.result === 'leave' || a.result === 'quit') continue;
    const prev = out.tracker[id] && typeof out.tracker[id] === 'object' ? out.tracker[id] : { status: 'todo', note: '' };
    if (a.result === 'done') out.tracker[id] = { ...prev, status: 'signed-up', updatedAt: nowIso, signedUpAt: prev.signedUpAt || nowIso };
    else if (a.result === 'skip') out.tracker[id] = { ...prev, status: 'skipped', updatedAt: nowIso };
    else if (a.result === 'problem') {
      const note = String(a.note || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
      out.tracker[id] = { ...prev, status: 'todo', note: `Problem: ${note}`.slice(0, MAX_NOTE), updatedAt: nowIso };
    }
  }
  return out;
}

/** <input-basename>-updated.json next to the input. */
export function defaultOutPath(inputPath) {
  const p = path.parse(inputPath);
  return path.join(p.dir, `${p.name}-updated.json`);
}
