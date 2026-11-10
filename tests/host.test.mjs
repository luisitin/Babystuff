// BFF.zip (CRC-32, stored zip layout) and BFF.host (saveFile, use, copyText, flags) with stubbed browser globals.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

// Load as CommonJS regardless of any "type": "module" in package.json.
const SOURCES = {}; // read once: tests below replace globalThis.URL
for (const f of ['zip.js', 'host.js']) SOURCES[f] = readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
function load(file) {
  const mod = { exports: {} };
  new Function('module', SOURCES[file])(mod);
  return mod.exports;
}
const Z = load('zip.js');
const H = load('host.js');

// ---- zip ----
const SAMPLES = ['', 'a', 'hello world', 'Baby Freebies Finder', 'café – über \u{1F37C} 中文', 'x'.repeat(100000)];

test('crc32 equals node:zlib crc32 for ASCII, non-ASCII and large inputs', () => {
  assert.equal(typeof zlib.crc32, 'function', 'this test needs a Node with zlib.crc32');
  for (const s of SAMPLES) {
    const bytes = new TextEncoder().encode(s);
    assert.equal(Z.crc32(bytes), zlib.crc32(Buffer.from(bytes)), JSON.stringify(s.slice(0, 20)));
  }
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.equal(Z.crc32(all), zlib.crc32(Buffer.from(all)));
});

// A tiny reader: walks the central directory and reads each stored entry.
function readZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const end = u8.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50, 'end record signature');
  const count = dv.getUint16(end + 10, true), cdSize = dv.getUint32(end + 12, true), cdOff = dv.getUint32(end + 16, true);
  assert.equal(cdOff + cdSize, end, 'central directory ends at the end record');
  const out = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50, 'central header signature');
    const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), time = dv.getUint16(p + 12, true), date = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(u8.subarray(p + 46, p + 46 + nlen));
    // local header
    assert.equal(dv.getUint32(off, true), 0x04034b50, 'local header signature');
    const lnlen = dv.getUint16(off + 26, true), lxlen = dv.getUint16(off + 28, true);
    assert.equal(dv.getUint16(off + 6, true), flags, 'same flags in both headers');
    const start = off + 30 + lnlen + lxlen;
    const data = u8.slice(start, start + csize);
    out.push({ name, flags, method, time, date, crc, csize, usize, data });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

test('store() writes a readable zip: names, sizes, bytes, UTF-8 flag, fixed date, CRC', () => {
  const files = [{ name: 'baby-freebies-gmail-filters.xml', text: '<?xml version="1.0"?>\n<feed>café</feed>' }, { name: 'résumé/中.ics', text: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' }];
  const zip = Z.store(files);
  assert.ok(zip instanceof Uint8Array);
  const entries = readZip(zip);
  assert.equal(entries.length, 2);
  entries.forEach((e, i) => {
    const bytes = new TextEncoder().encode(files[i].text);
    assert.equal(e.name, files[i].name);
    assert.equal(e.flags & 0x0800, 0x0800, 'UTF-8 name flag');
    assert.equal(e.method, 0, 'stored');
    assert.equal(e.time, 0);
    assert.equal(e.date, 0x0021, '1980-01-01');
    assert.equal(e.csize, bytes.length);
    assert.equal(e.usize, bytes.length);
    assert.deepEqual(Buffer.from(e.data), Buffer.from(bytes));
    assert.equal(e.crc, zlib.crc32(Buffer.from(bytes)));
  });
});

test('store() is deterministic and handles an empty list and empty text', () => {
  const a = Z.store([{ name: 'a.txt', text: 'same' }]), b = Z.store([{ name: 'a.txt', text: 'same' }]);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
  assert.equal(Z.store([]).length, 22);
  assert.equal(readZip(Z.store([{ name: 'empty.txt', text: '' }]))[0].usize, 0);
  assert.throws(() => Z.store([{ name: '', text: 'x' }]));
  assert.throws(() => Z.store('nope'));
});

// ---- host ----
const saved = {};
function setGlobals(g) {
  for (const k of Object.keys(g)) {
    if (!(k in saved)) saved[k] = Object.getOwnPropertyDescriptor(globalThis, k) || null;
    Object.defineProperty(globalThis, k, { value: g[k], writable: true, configurable: true, enumerable: true });
  }
}
beforeEach(() => {
  setGlobals({ BFF: { zip: Z }, claude: undefined }); // each test loads a fresh host (it memoizes use())
});
afterEach(() => {
  for (const k of Object.keys(saved)) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k]; delete saved[k]; }
});
const freshHost = () => load('host.js');

function fakeClaude(save, extra) {
  const calls = { use: [], save: [] };
  setGlobals({ claude: {
    use(name) {
      calls.use.push(name);
      if (name !== 'downloads') return Promise.resolve(null);
      return Promise.resolve(extra === 'nosave' ? {} : { save(req) { calls.save.push(req); return save(req); } });
    },
  } });
  return calls;
}

test('host without a runtime: use resolves null, flags are standalone, never throws', async () => {
  const h = freshHost();
  assert.equal(h.inArtifact, false);
  assert.equal(h.canPopup, true);
  assert.equal(h.mailtoNote, '');
  assert.equal(await h.use('downloads'), null);
  assert.equal(await h.use('mcp'), null);
  assert.equal(h.use('downloads'), h.use('downloads'), 'memoized per name');
});

test('host with a runtime: flags, use() memoized, null and rejection become null', async () => {
  const calls = fakeClaude(() => Promise.resolve({ status: 'saved' }));
  const h = freshHost();
  assert.equal(h.inArtifact, true);
  assert.equal(h.canPopup, false);
  assert.equal(h.mailtoNote, 'May not open from here');
  const a = await h.use('downloads'), b = await h.use('downloads');
  assert.equal(a, b);
  assert.equal(calls.use.filter((n) => n === 'downloads').length, 1, 'runtime asked once per name');
  assert.equal(await h.use('mcp'), null);
  setGlobals({ claude: { use() { return Promise.reject(new Error('boom')); } } });
  assert.equal(await freshHost().use('x'), null);
  setGlobals({ claude: { use() { throw new Error('sync boom'); } } });
  assert.equal(await freshHost().use('x'), null);
});

test('saveFile in the artifact: allowed extensions go straight through, others are zipped', async () => {
  const calls = fakeClaude(() => Promise.resolve({ status: 'saved' }));
  const h = freshHost();
  let r = await h.saveFile({ name: 'backup.json', text: '{"a":1}', mime: 'application/json' });
  assert.deepEqual({ status: r.status, name: r.name, zipped: r.zipped }, { status: 'saved', name: 'backup.json', zipped: false });
  assert.equal(calls.save[0].filename, 'backup.json');
  assert.equal(calls.save[0].data, '{"a":1}');

  for (const [name, text] of [['filters.xml', '<feed/>'], ['reminders.ics', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'], ['card.vcf', 'BEGIN:VCARD']]) {
    r = await h.saveFile({ name, text });
    assert.equal(r.status, 'saved');
    assert.equal(r.zipped, true);
    assert.equal(r.inner, name);
    const req = calls.save[calls.save.length - 1];
    assert.equal(req.filename, name.replace(/\.\w+$/, '') + '.zip');
    assert.ok(req.data instanceof Uint8Array);
    const entries = readZip(req.data);
    assert.equal(entries[0].name, name);
    assert.equal(new TextDecoder().decode(entries[0].data), text);
  }
});

test('saveFile maps downloads errors: declined, rate_limited, anything else falls through to shown', async () => {
  const reject = (code) => () => Promise.reject({ code, message: 'm' });
  let calls = fakeClaude(reject('declined'));
  let r = await freshHost().saveFile({ name: 'a.json', text: 'x' });
  assert.equal(r.status, 'declined');
  assert.equal(calls.save.length, 1, 'no automatic retry');

  fakeClaude(reject('rate_limited'));
  r = await freshHost().saveFile({ name: 'a.json', text: 'x' });
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'rate_limited');
  assert.match(r.message, /wait/i);

  for (const code of ['unavailable', 'too_large', 'rejected_extension', 'bad_request', 'weird_new_code', undefined]) {
    fakeClaude(reject(code));
    r = await freshHost().saveFile({ name: 'a.xml', text: 'x' });
    assert.equal(r.status, 'shown', String(code));
    assert.equal(r.name, 'a.xml', 'shown keeps the original file name');
  }
  fakeClaude(() => Promise.reject('just a string'));
  assert.equal((await freshHost().saveFile({ name: 'a.json', text: 'x' })).status, 'shown');
  fakeClaude(() => { throw new Error('sync'); });
  assert.equal((await freshHost().saveFile({ name: 'a.json', text: 'x' })).status, 'shown');
});

test('saveFile shows the text when the capability is missing, and refuses empty files plainly', async () => {
  setGlobals({ claude: { use() { return Promise.resolve(null); } } });
  let r = await freshHost().saveFile({ name: 'a.json', text: 'x' });
  assert.equal(r.status, 'shown');
  fakeClaude(null, 'nosave');
  r = await freshHost().saveFile({ name: 'a.json', text: 'x' });
  assert.equal(r.status, 'shown');
  r = await freshHost().saveFile({ name: 'a.json', text: '' });
  assert.equal(r.status, 'failed');
});

test('saveFile standalone clicks a download link with a Blob URL and reports saved', async () => {
  const log = [];
  const anchor = { click() { log.push('click'); }, remove() {}, set href(v) { log.push('href'); }, set download(v) { log.push('download=' + v); }, set hidden(v) {} };
  setGlobals({
    document: { createElement: (t) => { log.push('create:' + t); return anchor; }, body: { appendChild() { log.push('append'); } } },
  });
  setGlobals({ URL: Object.assign(function URLStub() {}, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }) });
  const r = await freshHost().saveFile({ name: 'backup.json', text: '{}', mime: 'application/json' });
  assert.equal(r.status, 'saved');
  assert.equal(r.name, 'backup.json');
  assert.ok(log.includes('click') && log.includes('download=backup.json'));
});

test('copyText uses the clipboard, falls back to execCommand, then false', async () => {
  setGlobals({ navigator: { clipboard: { writeText: (t) => { globalThis.__copied = t; return Promise.resolve(); } } } });
  assert.equal(await freshHost().copyText('hello'), true);
  assert.equal(globalThis.__copied, 'hello');
  delete globalThis.__copied;

  const ta = { style: {}, setAttribute() {}, select() {}, setSelectionRange() {}, remove() {} };
  let exec = true;
  setGlobals({
    navigator: { clipboard: { writeText: () => Promise.reject(new Error('denied')) } },
    document: { body: { appendChild() {} }, createElement: () => ta, execCommand: () => exec },
  });
  assert.equal(await freshHost().copyText('x'), true, 'execCommand fallback');
  exec = false;
  assert.equal(await freshHost().copyText('x'), false, 'both failed');
  setGlobals({ navigator: {}, document: undefined });
  assert.equal(await freshHost().copyText('x'), false, 'nothing available');
});

test('allowedExtension follows the downloads capability list', () => {
  const h = freshHost();
  for (const n of ['a.json', 'a.TXT', 'a.csv', 'a.zip', 'a.pdf', 'a.md']) assert.equal(h.allowedExtension(n), true, n);
  for (const n of ['a.xml', 'a.ics', 'a.vcf', 'noext', '']) assert.equal(h.allowedExtension(n), false, n);
});

test('showText focuses and selects the text box so it is ready to copy', () => {
  const made = [];
  const el = (tag) => {
    const e = { tag, style: {}, children: [], calls: [], setAttribute() {}, addEventListener() {}, remove() {}, appendChild(c) { e.children.push(c); },
      focus() { e.calls.push('focus'); }, select() { e.calls.push('select'); } };
    made.push(e);
    return e;
  };
  const parent = { querySelectorAll: () => [], insertBefore() {} };
  setGlobals({ document: { createElement: el } });
  const panel = freshHost().showText({ after: { parentNode: parent, nextSibling: null }, label: 'Text', text: 'hello' });
  assert.ok(panel);
  const ta = made.find((e) => e.tag === 'textarea');
  assert.deepEqual(ta.calls, ['focus', 'select']);
  assert.equal(ta.value, 'hello');
});
