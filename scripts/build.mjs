// Deterministic inlining build: src/ + data/programs.json -> index.html
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = ['base.css', 'features.css'].map((f) => 'src/css/' + f);
const JS = ['logic.js', 'store.js', 'email.js', 'tracker.js', 'profile.js', 'directory.js', 'guided.js', 'app.js'].map(
  (f) => 'src/js/' + f
);
const inlined = [];

function readPart(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) throw new Error('Missing required file: ' + rel);
  inlined.push(rel);
  return readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

function collect(list) {
  return list
    .map((rel) => readPart(rel).replace(/\n+$/, ''));
}

const shell = readPart('src/index.html');
const dataText = readPart('data/programs.json');
const data = JSON.stringify(JSON.parse(dataText))
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

const css = collect(CSS).join('\n');
const js = collect(JS).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS contains "</script"; cannot inline safely');
if (/<\/style/i.test(css)) throw new Error('CSS contains "</style"; cannot inline safely');

const marks = ['<!-- @inline-css -->', '<!-- @inline-data -->', '<!-- @inline-js -->'];
for (const m of marks) {
  if (shell.split(m).length !== 2) throw new Error('Placeholder must appear exactly once: ' + m);
}
const out = shell
  .replace(marks[0], () => '<style>\n' + css + '\n</style>')
  .replace(marks[1], () => '<script id="programs-data" type="application/json">' + data + '</script>')
  .replace(marks[2], () => '<script>\n' + js + '\n</script>');

writeFileSync(join(root, 'index.html'), out);
console.log('Inlined: ' + inlined.join(', '));
console.log('Wrote index.html (' + Buffer.byteLength(out) + ' bytes)');
