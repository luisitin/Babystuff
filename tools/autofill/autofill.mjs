#!/usr/bin/env node
// Baby Freebies autofill helper.
// Opens sign-up pages in a visible browser and fills the obvious fields from
// profile.json. It NEVER submits: no clicks, no Enter, no form.submit().
// It does not touch CAPTCHAs or bot checks. You review and press Submit yourself.

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import { classifyField, valueFor, cleanText, sameSite, isGuidedDefault } from './field-matcher.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PROGRAMS = path.resolve(here, '../../data/programs.json');
const PROFILE = path.join(here, 'profile.json');

function usage() {
  console.log(`Usage:
  node autofill.mjs --list                 list program ids
  node autofill.mjs <id> [<id>...]         fill these programs, one at a time
  node autofill.mjs --all-free             programs the app's guided run picks by default:
                                           free, no purchase/membership/insurance/eligibility,
                                           not health-benefits or assistance

Local testing only (not for real sites):
  node autofill.mjs --fixture <file.html|file:// URL> [--headless]
`);
}

function loadPrograms() {
  return JSON.parse(readFileSync(PROGRAMS, 'utf8'));
}

function domain(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return '?'; }
}

function loadProfile(fixtureMode = false) {
  // Fixture (local test) mode may fall back to the placeholder example profile.
  if (fixtureMode && !existsSync(PROFILE)) return JSON.parse(readFileSync(path.join(here, 'profile.example.json'), 'utf8'));
  if (!existsSync(PROFILE)) {
    console.error('No profile.json found in tools/autofill/.\nCopy profile.example.json to profile.json and put your own details in it:\n  cp profile.example.json profile.json');
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(PROFILE, 'utf8'));
  } catch (e) {
    console.error(`profile.json is not valid JSON: ${e.message}\nCompare it with profile.example.json.`);
    process.exit(1);
  }
}

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch (e1) {
    try {
      // Fallback for globally installed Playwright (CommonJS resolution honours NODE_PATH).
      return createRequire(import.meta.url)('playwright').chromium;
    } catch {
      console.error('Playwright is not installed. Run:\n  npm install && npx playwright install chromium');
      process.exit(1);
    }
  }
}

function ask(rl, q) {
  return new Promise((res) => rl.question(q, res));
}

// Runs inside each frame. Tags usable fields with data-bff-idx and describes them.
function scanFrame() {
  const out = [];
  const els = document.querySelectorAll('input, select, textarea');
  let n = 0;
  const labelOf = (el) => {
    const bits = [];
    if (el.labels) for (const l of el.labels) bits.push(l.textContent);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) for (const id of lb.split(/\s+/)) { const x = document.getElementById(id); if (x) bits.push(x.textContent); }
    if (!bits.length) { const l = el.closest('label'); if (l) bits.push(l.textContent); }
    return bits.join(' ').replace(/\s+/g, ' ').trim();
  };
  for (const el of els) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    if (el.disabled || el.readOnly) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width < 2 || r.height < 2) continue;
    // Honeypots and fields a person cannot see: never filled, not even listed.
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
    let hidden = false;
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (a.getAttribute('aria-hidden') === 'true' || a.hidden || parseFloat(s.opacity) === 0) hidden = true;
      if (s.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(\s*(50|100)%/.test(s.clipPath || '')) hidden = true;
      if (s.overflow === 'hidden' && (a.offsetWidth < 2 || a.offsetHeight < 2) && a !== document.body) hidden = true;
    }
    const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth);
    const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight);
    const ax = r.left + window.scrollX, ay = r.top + window.scrollY;
    if (ax + r.width <= 0 || ay + r.height <= 0 || ax >= docW || ay >= docH) hidden = true;
    const hasLabel = !!labelOf(el) || !!el.getAttribute('aria-label');
    if (el.getAttribute('tabindex') === '-1' && !hasLabel) hidden = true;
    if (hidden) continue;
    const idx = String(n++);
    el.setAttribute('data-bff-idx', idx);
    const isSelect = tag === 'select';
    // Page scripts that submit on change: skip when there is no submit button.
    const form = el.form;
    const hasSubmitBtn = !!(form && form.querySelector('button:not([type]), button[type=submit], input[type=submit], input[type=image]'));
    const changeAttr = (el.getAttribute('onchange') || '') + ' ' + (form ? form.getAttribute('onchange') || '' : '');
    const autoSubmit = el.hasAttribute('data-auto-submit') || (!hasSubmitBtn && /submit/i.test(changeAttr));
    let empty;
    if (isSelect) {
      const o = el.options[el.selectedIndex];
      empty = !o || o.value === '' || (el.selectedIndex === 0 && o.disabled);
    } else empty = el.value === '';
    out.push({
      idx, tag, type, empty, autoSubmit,
      name: el.getAttribute('name') || '', id: el.id || '',
      autocomplete: el.getAttribute('autocomplete') || '',
      placeholder: el.getAttribute('placeholder') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      label: labelOf(el),
      options: isSelect ? Array.from(el.options).map((o) => ({ value: o.value, label: o.textContent.trim() })) : null,
    });
  }
  return out;
}

async function markFilled(frame, idx) {
  await frame.evaluate((i) => {
    const el = document.querySelector(`[data-bff-idx="${i}"]`);
    if (!el) return;
    if (!document.getElementById('bff-style')) {
      const s = document.createElement('style');
      s.id = 'bff-style';
      s.textContent = '[data-bff-filled]{outline:3px solid #1a7f37 !important;outline-offset:2px !important}';
      document.head.appendChild(s);
    }
    el.setAttribute('data-bff-filled', '1');
  }, idx);
}

// Fill one page (and same-origin iframes). Returns {filled, skipped}.
async function fillPage(page, profile) {
  const filled = [];
  const skipped = [];
  const origin = new URL(page.url()).origin;
  for (const frame of page.frames()) {
    let sameOrigin = true;
    try { sameOrigin = frame === page.mainFrame() || new URL(frame.url()).origin === origin; } catch { sameOrigin = false; }
    if (!sameOrigin) continue;
    let fields;
    try { fields = await frame.evaluate(scanFrame); } catch { continue; }
    for (const f of fields) {
      const desc = cleanText(f.label || f.ariaLabel || f.name || f.id || f.placeholder || f.type);
      const kind = classifyField(f);
      if (f.autoSubmit) { skipped.push(`${desc} (page may auto-submit on change; do it by hand)`); continue; }
      if (!kind) { skipped.push(`${desc} (not recognised or intentionally skipped)`); continue; }
      if (!f.empty) { skipped.push(`${desc} (already has a value)`); continue; }
      const value = valueFor(kind, profile, { inputType: f.type, options: f.options });
      if (value == null) { skipped.push(`${desc} (${kind}: nothing in your profile to use)`); continue; }
      const loc = frame.locator(`[data-bff-idx="${f.idx}"]`);
      try {
        if (f.tag === 'select') await loc.selectOption(value, { timeout: 3000 });
        else await loc.fill(value, { timeout: 3000 });
        await markFilled(frame, f.idx);
        filled.push(`${desc} -> ${kind}`);
      } catch (e) {
        skipped.push(`${desc} (${kind}: could not fill)`);
      }
    }
  }
  return { filled, skipped };
}

function printSummary(title, { filled, skipped }) {
  console.log(`\n=== ${cleanText(title)} ===`);
  console.log(`Filled (${filled.length}), outlined in green:`);
  for (const l of filled) console.log(`  + ${l}`);
  if (!filled.length) console.log('  (nothing)');
  console.log(`Left alone (${skipped.length}):`);
  for (const l of skipped) console.log(`  - ${l}`);
  console.log('\nNote: some sites run their own scripts when a field changes. Review the page');
  console.log('before anything else happens, and stop if it moved on by itself.');
  console.log('\nNow, by hand in the browser: check every field, fill anything missing,');
  console.log('tick or untick consent boxes yourself, solve any CAPTCHA, then press Submit.');
  console.log('This tool never submits for you.');
}

async function dumpFixture(page) {
  const state = await page.evaluate(() => ({
    submitted: !!window.__submitted,
    fields: Array.from(document.querySelectorAll('input, select, textarea')).map((e) => ({
      name: String(e.name || e.id).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 80), type: e.type, value: e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value,
    })),
  }));
  console.log('\n[fixture] final state:');
  for (const f of state.fields) console.log(`  ${f.name} (${f.type}) = ${JSON.stringify(f.value)}`);
  console.log(`[fixture] form submitted flag: ${state.submitted}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--help') || args.includes('-h')) { usage(); return; }
  const programs = loadPrograms();

  if (args.includes('--list')) {
    for (const p of programs) console.log(`${p.id}\t${p.name}\t${domain(p.signupUrl)}`);
    return;
  }

  // Build the list of [label, url] to visit.
  const fixtureAt = args.indexOf('--fixture');
  const headless = args.includes('--headless');
  let targets = [];
  if (fixtureAt >= 0) {
    // LOCAL TESTING ONLY: a file:// page, never a real site.
    const raw = args[fixtureAt + 1] || '';
    const url = raw.startsWith('file://') ? raw : (path.isAbsolute(raw) ? pathToFileURL(raw).href : '');
    if (!url) { console.error('--fixture needs an absolute file path or a file:// URL.'); process.exit(1); }
    targets = [{ title: 'fixture', url }];
  } else {
    if (headless) { console.error('--headless is only allowed together with --fixture (local testing). Real sign-ups open in a visible browser.'); process.exit(1); }
    const ids = args.includes('--all-free')
      ? programs.filter(isGuidedDefault).map((p) => p.id)
      : args.filter((a) => !a.startsWith('--'));
    if (!ids.length) { usage(); process.exit(1); }
    for (const id of ids) {
      const p = programs.find((x) => x.id === id);
      if (!p) { console.error(`Unknown program id: ${id} (try --list)`); process.exit(1); }
      let u;
      try { u = new URL(p.signupUrl); } catch { u = null; }
      if (!u || u.protocol !== 'https:') { console.error(`Refusing ${id}: signupUrl is not https.`); process.exit(1); }
      targets.push({ title: `${p.name} (${domain(p.signupUrl)})`, url: p.signupUrl });
    }
  }

  const profile = loadProfile(fixtureAt >= 0);
  const chromium = await loadChromium();
  // Plain Chromium: no stealth, no user-agent changes, nothing to hide automation.
  const browser = await chromium.launch({ headless: fixtureAt >= 0 && headless });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      console.log(`\n[${i + 1}/${targets.length}] Opening ${cleanText(t.title)}`);
      const page = await browser.newPage();
      try {
        await page.goto(t.url, { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(1500); // let late-rendering forms appear
      } catch (e) {
        console.log(`Could not load the page fully: ${cleanText(e.message.split('\n')[0], 200)}`);
      }
      if (fixtureAt < 0 && !sameSite(page.url(), t.url)) {
        console.log(`\nWARNING: this page ended up on ${cleanText(domain(page.url()))}, not ${domain(t.url)}.`);
        console.log('Nothing was filled. Check the address bar; fill by hand only if you trust it.');
        const a2 = (await ask(rl, 'Press Enter for the next site (q + Enter to quit): ')).trim().toLowerCase();
        await page.close();
        if (a2 === 'q') break;
        continue;
      }
      const result = await fillPage(page, profile);
      printSummary(t.title, result);
      if (fixtureAt >= 0) { await dumpFixture(page); await page.close(); continue; }
      const ans = (await ask(rl, i + 1 < targets.length
        ? '\nPress Enter when you are done with this site to open the next one (q + Enter to quit): '
        : '\nPress Enter to finish and close the browser (q + Enter also quits): ')).trim().toLowerCase();
      if (ans === 'q') break;
    }
  } finally {
    rl.close();
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
