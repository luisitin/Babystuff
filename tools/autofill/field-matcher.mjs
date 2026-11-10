// Thin wrapper: the matcher lives in src/js/fieldmatch.js (one source of truth for the app,
// the fill script and this helper). Re-exported here so existing imports keep working.
import { createRequire } from 'node:module';

const fm = createRequire(import.meta.url)('../../src/js/fieldmatch.js');

export const cleanText = fm.cleanText;
export const registrableDomain = fm.registrableDomain;
export const sameSite = fm.sameSite;
export const isGuidedDefault = fm.isGuidedDefault;
export const classifyField = fm.classifyField;
export const valueFor = fm.valueFor;
