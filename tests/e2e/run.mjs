// End-to-end browser test for both build outputs (index.html and artifact.html). Run: node tests/e2e/run.mjs [--shots <dir>]
// Needs Playwright with Chromium (preinstalled locally, not in CI). Not part of `node --test`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, OUT, loadPlaywright, stats, TMP } from './lib/harness.mjs';

const chromium = await loadPlaywright();
if (!chromium) { console.log('e2e skipped: Playwright not available'); process.exit(0); }

const si = process.argv.indexOf('--shots');
const shotDir = si > 0 ? path.resolve(process.argv[si + 1] || 'e2e-shots') : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const shot = async (h, name) => { if (shotDir) await h.page.screenshot({ path: path.join(shotDir, name + '.png') }).catch(() => {}); };

// Fresh outputs. If the page does not boot (a source file may be mid-edit), rebuild and retry up to three times.
const build = () => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: 'pipe' });
if (OUT === ROOT) build(); // a mutation run (BFF_E2E_BUILD_DIR) tests the files it was given

const browser = await chromium.launch();
async function bootsOnce() {
  const { open } = await import('./lib/harness.mjs');
  const h = await open(browser, { mode: 'standalone' });
  const ok = h.errors.length === 0 && (await h.page.locator('#view-directory:not([hidden]) .card').count()) > 0;
  const why = h.errors.slice(0, 2).join(' | ');
  await h.ctx.close();
  return { ok, why };
}
let b = await bootsOnce();
for (let i = 0; i < 3 && !b.ok; i++) {
  console.log('page did not boot (' + b.why + '); waiting a minute, rebuilding, retrying (' + (i + 1) + '/3)');
  await new Promise((r) => setTimeout(r, 60000));
  if (OUT === ROOT) build();
  b = await bootsOnce();
}

const env = { browser, shot };
const A = await import('./lib/groups-a.mjs');
const B = await import('./lib/groups-b.mjs');
const C = await import('./lib/groups-c.mjs');
const D = await import('./lib/groups-d.mjs');
const t0 = Date.now();
const oi = process.argv.indexOf('--only');
const only = oi > 0 ? process.argv[oi + 1].split(',') : null; // e.g. --only 4,7 runs those group numbers
const steps = [['1', A.boot], ['2', A.routes], ['3', A.links], ['4', A.clickThrough], ['5', B.downloads], ['6', B.backup], ['7', B.gmail], ['8', C.fill], ['9', C.persistence], ['10', C.a11y], ['11', D.directoryG], ['12', D.guidedTrackerG]];
try {
  for (const [id, fn] of steps) if (!only || only.includes(id)) await fn(env);
} finally {
  await browser.close();
}
if (A.suspects.length) {
  console.log('\nsuspect buttons (clicked, nothing visible changed):');
  A.suspects.forEach((s) => console.log('  - ' + s));
}
const toolsSeen = [...new Set(B.gmailCalls.map((c) => c.tool || ('listTools')))].sort().join(', ');
console.log('\nGmail tools seen across the run: ' + toolsSeen);
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* temp only */ }
console.log('\n' + stats.checks + ' checks, ' + stats.failed + ' failed (' + Math.round((Date.now() - t0) / 1000) + 's)');
process.exit(stats.failed ? 1 : 0);
