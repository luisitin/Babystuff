// Deterministic inlining build: src/ + data/programs.json -> index.html (standalone page) and artifact.html (Claude artifact fragment)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = ['base.css', 'features.css', 'inbox.css', 'phone.css'].map((f) => 'src/css/' + f);
const ARTIFACT_CSS = 'src/css/artifact.css';
const JS = [
  'logic.js', 'store.js', 'missing.js', 'email.js', 'zip.js', 'host.js', 'fieldmatch.js', 'fillscript.js', 'inbox.js',
  'tracker.js', 'profile.js', 'directory.js', 'guided.js', 'inboxview.js', 'phone.js', 'app.js'
].map((f) => 'src/js/' + f);
const inlined = [];

function readPart(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) throw new Error('Missing required file: ' + rel);
  inlined.push(rel);
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

function collect(list) {
  return list.map((rel) => readPart(rel).replace(/\n+$/, ''));
}

function once(text, marker, what) {
  if (text.split(marker).length !== 2) throw new Error(what + ' must appear exactly once: ' + marker);
}

const shell = readPart('src/index.html');
const dataText = readPart('data/programs.json');
const data = JSON.stringify(JSON.parse(dataText))
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const cssParts = collect(CSS);
const css = cssParts.join('\n');
const artifactCss = css + '\n' + readPart(ARTIFACT_CSS).replace(/\n+$/, '');
const js = collect(JS).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS contains "</script"; cannot inline safely');
if (/<\/style/i.test(artifactCss)) throw new Error('CSS contains "</style"; cannot inline safely');

const marks = ['<!-- @inline-css -->', '<!-- @inline-data -->', '<!-- @inline-js -->'];
for (const m of marks) once(shell, m, 'Placeholder');

const styleTag = (text) => '<style>\n' + text + '\n</style>';
const dataTag = '<script id="programs-data" type="application/json">' + data + '</script>';
const jsTag = '<script>\n' + js + '\n</script>';

// ---- index.html: the shell with the placeholders filled in ----
const page = shell
  .replace(marks[0], () => styleTag(css))
  .replace(marks[1], () => dataTag)
  .replace(marks[2], () => jsTag);

// ---- artifact.html: a fragment (no doctype, html, head, body or CSP meta) built from the same shell ----
const titleMatch = /<title>([^<]*)<\/title>/.exec(shell);
if (!titleMatch) throw new Error('src/index.html needs a <title>');
const bodyMatch = /<body([^>]*)>([\s\S]*)<\/body>/.exec(shell);
if (!bodyMatch) throw new Error('src/index.html needs a <body> element');
const htmlTag = /<html([^>]*)>/.exec(shell);

// Attributes the shell puts on <html> or <body> cannot exist in a fragment, so they move to the wrapper div.
function attrsOf(text) {
  const out = [];
  const re = /([a-zA-Z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = re.exec(text || ''))) out.push([m[1].toLowerCase(), m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : '']);
  return out;
}
const wrapAttrs = { class: ['bff-shell'] };
for (const [k, v] of attrsOf(htmlTag && htmlTag[1])) {
  if (k === 'lang') wrapAttrs.lang = v;
  else throw new Error('<html ' + k + '> cannot be carried into the artifact fragment; handle it in build.mjs');
}
for (const [k, v] of attrsOf(bodyMatch[1])) {
  if (k === 'class') wrapAttrs.class.push(v);
  else if (k === 'id' || k.startsWith('data-') || k === 'lang') wrapAttrs[k] = v;
  else throw new Error('<body ' + k + '> cannot be carried into the artifact fragment; handle it in build.mjs');
}
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const wrapOpen = '<div' + Object.keys(wrapAttrs).map((k) => ' ' + k + '="' + esc(Array.isArray(wrapAttrs[k]) ? wrapAttrs[k].join(' ') : wrapAttrs[k]) + '"').join('') + '>';

// The data block and the script come last in the body; the markup before them goes inside the wrapper.
const inner = bodyMatch[2];
const cut = inner.indexOf(marks[1]);
const tail = inner.slice(cut);
if (cut < 0 || tail.replace(marks[1], '').replace(marks[2], '').trim() !== '' || tail.indexOf(marks[1]) > tail.indexOf(marks[2])) {
  throw new Error('In src/index.html the data and JS placeholders must be the last things in <body>, data first');
}
const markup = inner.slice(0, cut).replace(/\s+$/, '');
const artifact = [
  '<title>' + titleMatch[1] + '</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  styleTag(artifactCss),
  wrapOpen,
  markup.replace(/^\s*\n/, ''),
  '</div>',
  dataTag,
  jsTag
].join('\n') + '\n';

writeFileSync(join(root, 'index.html'), page);
writeFileSync(join(root, 'artifact.html'), artifact);
console.log('Inlined: ' + inlined.join(', '));
console.log('Wrote index.html (' + Buffer.byteLength(page) + ' bytes)');
console.log('Wrote artifact.html (' + Buffer.byteLength(artifact) + ' bytes)');
