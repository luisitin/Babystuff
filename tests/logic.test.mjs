import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Load as CommonJS regardless of any "type": "module" in package.json.
const mod = { exports: {} };
new Function('module', readFileSync(new URL('../src/js/logic.js', import.meta.url), 'utf8'))(mod);
const L = mod.exports;

const P = (o) => Object.assign({ name: 'X', brand: 'B', category: 'formula', costToClaim: 'free',
  requirements: ['email'], whatYouGet: '', notes: '', eligibility: '', verifiedOn: '2026-01-01', confidence: 'high' }, o);

test('constants', () => {
  assert.equal(L.CATEGORIES.length, 9);
  assert.equal(L.CATEGORIES[0].id, 'formula');
  assert.equal(L.COST_LABELS['shipping-fee'], 'Shipping fee');
  assert.equal(L.COST_LABELS['purchase-required'], 'Purchase needed');
  for (const k of ['email','address','phone','due-date','registry','app','purchase','membership','insurance','eligibility'])
    assert.ok(L.REQUIREMENT_LABELS[k], k);
});

test('isTrulyFree', () => {
  assert.equal(L.isTrulyFree(P({})), true);
  assert.equal(L.isTrulyFree(P({ costToClaim: 'shipping-fee' })), false);
  assert.equal(L.isTrulyFree(P({ requirements: ['email', 'purchase'] })), false);
  assert.equal(L.isTrulyFree(P({ requirements: ['membership'] })), false);
  assert.equal(L.isTrulyFree(P({ requirements: undefined })), true);
});

test('isEmailOnly', () => {
  assert.equal(L.isEmailOnly(P({ requirements: ['email'] })), true);
  assert.equal(L.isEmailOnly(P({ requirements: ['due-date', 'email'] })), true);
  assert.equal(L.isEmailOnly(P({ requirements: ['email', 'address'] })), false);
  assert.equal(L.isEmailOnly(P({ requirements: ['due-date'] })), false);
  assert.equal(L.isEmailOnly(P({ requirements: [] })), false);
  assert.equal(L.isEmailOnly(P({ requirements: undefined })), false);
});

test('needsRegistry', () => {
  assert.equal(L.needsRegistry(P({ requirements: ['registry'] })), true);
  assert.equal(L.needsRegistry(P({})), false);
});

test('isEligibilityBased and guidedDefault', () => {
  assert.equal(L.isEligibilityBased(P({ category: 'health-benefits' })), true);
  assert.equal(L.isEligibilityBased(P({ category: 'assistance' })), true);
  assert.equal(L.isEligibilityBased(P({ requirements: ['eligibility'] })), true);
  assert.equal(L.isEligibilityBased(P({ requirements: ['insurance'] })), true);
  assert.equal(L.isEligibilityBased(P({})), false);
  assert.equal(L.guidedDefault(P({})), true);
  assert.equal(L.guidedDefault(P({ category: 'assistance' })), false);
  assert.equal(L.guidedDefault(P({ costToClaim: 'shipping-fee' })), false);
});

test('filterPrograms', () => {
  const list = [
    P({ name: 'Alpha', brand: 'Acme', whatYouGet: 'Free diapers' }),
    P({ name: 'Beta', category: 'rewards', notes: 'Has a Registry perk', requirements: ['registry', 'email'] }),
    P({ name: 'Gamma', costToClaim: 'shipping-fee', eligibility: 'Military families' })
  ];
  assert.equal(L.filterPrograms(list, {}).length, 3);
  assert.equal(L.filterPrograms(list).length, 3);
  assert.equal(L.filterPrograms(list, { query: '' }).length, 3);
  assert.equal(L.filterPrograms(list, { query: '   ' }).length, 3);
  assert.deepEqual(L.filterPrograms(list, { query: 'ACME' }).map((p) => p.name), ['Alpha']);
  assert.deepEqual(L.filterPrograms(list, { query: 'diapers' }).map((p) => p.name), ['Alpha']);
  assert.deepEqual(L.filterPrograms(list, { query: 'registry' }).map((p) => p.name), ['Beta']);
  assert.deepEqual(L.filterPrograms(list, { query: 'military' }).map((p) => p.name), ['Gamma']);
  assert.deepEqual(L.filterPrograms(list, { category: 'rewards' }).map((p) => p.name), ['Beta']);
  assert.equal(L.filterPrograms(list, { category: 'nope' }).length, 0);
  assert.equal(L.filterPrograms(list, { category: '' }).length, 3);
  assert.deepEqual(L.filterPrograms(list, { trulyFree: true }).map((p) => p.name), ['Alpha', 'Beta']);
  assert.deepEqual(L.filterPrograms(list, { emailOnly: true }).map((p) => p.name), ['Alpha', 'Gamma']);
  assert.deepEqual(L.filterPrograms(list, { needsRegistry: true }).map((p) => p.name), ['Beta']);
  assert.equal(L.filterPrograms(list, { query: 'zzz' }).length, 0);
  assert.deepEqual(L.filterPrograms(null, {}), []);
});

test('sortPrograms', () => {
  const list = [
    P({ name: 'b', category: 'rewards', confidence: 'low', verifiedOn: '2026-01-02' }),
    P({ name: 'A', category: 'formula', confidence: 'high', verifiedOn: '2026-03-01' }),
    P({ name: 'c', category: 'mystery', confidence: 'medium' , verifiedOn: undefined }),
    P({ name: 'a2', category: 'formula', confidence: 'high', verifiedOn: '2026-03-01' })
  ];
  const copy = list.slice();
  assert.deepEqual(L.sortPrograms(list, 'name').map((p) => p.name), ['A', 'a2', 'b', 'c']);
  assert.deepEqual(list, copy, 'input not mutated');
  assert.notEqual(L.sortPrograms(list, 'name'), list);
  assert.deepEqual(L.sortPrograms(list, 'verified').map((p) => p.name), ['A', 'a2', 'b', 'c']);
  assert.deepEqual(L.sortPrograms(list, 'category').map((p) => p.name), ['A', 'a2', 'b', 'c']);
  assert.deepEqual(L.sortPrograms(list, 'confidence').map((p) => p.name), ['A', 'a2', 'c', 'b']);
  assert.deepEqual(L.sortPrograms(list, 'bogus').map((p) => p.name), ['A', 'a2', 'b', 'c']);
  assert.deepEqual(L.sortPrograms(undefined, 'name'), []);
});

test('domainOf', () => {
  assert.equal(L.domainOf('https://www.enfamil.com/a/b?x=1'), 'enfamil.com');
  assert.equal(L.domainOf('https://register.gerber.com/'), 'register.gerber.com');
  assert.equal(L.domainOf('https://Example.com:8080/x'), 'example.com');
  assert.equal(L.domainOf('not a url'), '');
  assert.equal(L.domainOf(''), '');
  assert.equal(L.domainOf(undefined), '');
});

test('escapeHtml', () => {
  assert.equal(L.escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(L.escapeHtml(null), '');
  assert.equal(L.escapeHtml(5), '5');
});

test('sortPrograms recommended', () => {
  const list = [
    P({ name: 'z-guided-high-email', category: 'formula', confidence: 'high' }),
    P({ name: 'a-assistance', category: 'assistance', confidence: 'high' }),
    P({ name: 'b-guided-addr-high', requirements: ['email', 'address'], confidence: 'high' }),
    P({ name: 'c-guided-email-low', confidence: 'low' }),
    P({ name: 'd-guided-email-med-rewards', category: 'rewards', confidence: 'medium' }),
    P({ name: 'e-guided-email-med-formula', category: 'formula', confidence: 'medium' }),
    P({ name: 'f-ship', costToClaim: 'shipping-fee', confidence: 'high' }),
    P({ name: 'A-guided-email-med-formula', category: 'formula', confidence: 'medium' })
  ];
  assert.deepEqual(L.sortPrograms(list, 'recommended').map((p) => p.name), [
    'z-guided-high-email', 'A-guided-email-med-formula', 'e-guided-email-med-formula',
    'd-guided-email-med-rewards', 'c-guided-email-low', 'b-guided-addr-high',
    'f-ship', 'a-assistance'
  ]);
  assert.deepEqual(L.sortPrograms([], 'recommended'), []);
  assert.deepEqual(L.sortPrograms([P({ category: 'zzz', confidence: undefined })], 'recommended').length, 1);
});
