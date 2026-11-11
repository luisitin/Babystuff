import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Load as CommonJS regardless of any "type": "module" in package.json.
const mod = { exports: {} };
new Function('module', readFileSync(new URL('../src/js/logic.js', import.meta.url), 'utf8'))(mod);
const L = mod.exports;

const P = (o) => Object.assign({ name: 'X', brand: 'B', category: 'formula', costToClaim: 'free',
  requirements: ['email'], offers: ['product'], certainty: 'guaranteed', whatYouGet: '', notes: '', eligibility: '', verifiedOn: '2026-01-01', confidence: 'high' }, o);

test('constants', () => {
  assert.equal(L.CATEGORIES.length, 10);
  assert.equal(L.CATEGORIES[L.CATEGORIES.findIndex((c) => c.id === 'assistance') + 1].id, 'money');
  assert.equal(L.CATEGORIES.find((c) => c.id === 'money').label, 'Money and savings');
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

test('isTrulyFree: the complaint (sweepstakes, coupons, points, testing are not truly free)', () => {
  for (const first of ['sweepstakes', 'coupons', 'points', 'testing'])
    assert.equal(L.isTrulyFree(P({ offers: [first, 'product'] })), false, first);
  assert.equal(L.isTrulyFree(P({ certainty: 'chance' })), false);
  for (const c of ['guaranteed', 'likely', 'if-eligible'])
    assert.equal(L.isTrulyFree(P({ certainty: c })), true, c);
  assert.equal(L.isTrulyFree(P({ requirements: ['email', 'purchase'] })), false);
  assert.equal(L.isTrulyFree(P({ requirements: ['membership'] })), false);
  assert.equal(L.isTrulyFree(P({ offers: undefined })), false);
  assert.equal(L.isTrulyFree(P({ offers: [] })), false);
  assert.equal(L.isTrulyFree(P({ offers: 'product' })), false);
  assert.equal(L.isTrulyFree(null), false);
});

test('isOpenToAll', () => {
  assert.equal(L.isOpenToAll(P({})), true);
  assert.equal(L.isOpenToAll(P({ certainty: 'if-eligible' })), false);
  assert.equal(L.isOpenToAll(P({ category: 'assistance' })), false);
  assert.equal(L.isOpenToAll(P({ requirements: ['insurance'] })), false);
  assert.equal(L.isOpenToAll(P({ certainty: 'chance' })), true);
  assert.equal(L.isOpenToAll(null), false);
});

test('label maps and orders', () => {
  assert.equal(Object.keys(L.OFFER_LABELS).length, 8);
  assert.equal(L.OFFER_LABELS.sweepstakes, 'Prize draw');
  assert.equal(L.CERTAINTY_LABELS.chance, 'Only if you are picked or win');
  assert.equal(L.EFFORT_LABELS.quick, 'About 5 minutes');
  assert.deepEqual(L.WHEN_ORDER, ['pregnancy', 'late-pregnancy', 'after-birth', 'anytime']);
  for (const k of L.WHEN_ORDER) assert.ok(L.WHEN_LABELS[k], k);
  assert.deepEqual(L.VERDICTS.map((v) => v.id), ['top', 'good', 'small', 'conditional', 'longshot']);
  assert.equal(L.VERDICTS[0].label, 'Top pick');
  assert.equal(L.VERDICTS[3].label, 'Only if you would buy anyway');
});

test('valueMid and expectedValue', () => {
  assert.equal(L.valueMid(P({ valueLow: 40, valueHigh: 60 })), 50);
  assert.equal(L.valueMid(P({ valueLow: null, valueHigh: null })), null);
  assert.equal(L.valueMid(P({ valueLow: '40', valueHigh: 60 })), null);
  assert.equal(L.valueMid(P({})), null);
  assert.equal(L.valueMid(null), null);
  const v = { valueLow: 100, valueHigh: 100 };
  assert.equal(L.expectedValue(P({ ...v, certainty: 'guaranteed' })), 100);
  assert.equal(L.expectedValue(P({ ...v, certainty: 'if-eligible' })), 100);
  assert.equal(L.expectedValue(P({ ...v, certainty: 'likely' })), 70);
  assert.equal(L.expectedValue(P({ ...v, certainty: 'chance' })), 10);
  assert.equal(L.expectedValue(P({})), null);
});

const V = (o) => P(Object.assign({ valueLow: 100, valueHigh: 100 }, o));
test('verdict branches in order', () => {
  assert.equal(L.verdict(V({ certainty: 'chance' })), 'longshot');
  assert.equal(L.verdict(V({ offers: ['sweepstakes'] })), 'longshot');
  assert.equal(L.verdict(V({ offers: ['testing'] })), 'longshot');
  // longshot beats conditional
  assert.equal(L.verdict(V({ certainty: 'chance', costToClaim: 'shipping-fee' })), 'longshot');
  assert.equal(L.verdict(V({ costToClaim: 'shipping-fee' })), 'conditional');
  assert.equal(L.verdict(V({ costToClaim: 'purchase-required' })), 'conditional');
  assert.equal(L.verdict(V({ requirements: ['purchase'] })), 'conditional');
  assert.equal(L.verdict(V({ requirements: ['membership'] })), 'conditional');
  assert.equal(L.verdict(V({ offers: ['coupons'] })), 'conditional');
  assert.equal(L.verdict(V({ offers: ['points'] })), 'conditional');
  assert.equal(L.verdict(V({})), 'top');
  assert.equal(L.verdict(V({ valueLow: 99, valueHigh: 99 })), 'good');
  assert.equal(L.verdict(V({ valueLow: 20, valueHigh: 20 })), 'good');
  assert.equal(L.verdict(V({ valueLow: 19, valueHigh: 19 })), 'small');
  assert.equal(L.verdict(V({ certainty: 'likely', valueLow: 143, valueHigh: 143 })), 'top');
  assert.equal(L.verdict(V({ certainty: 'likely', valueLow: 142, valueHigh: 142 })), 'good');
  assert.equal(L.verdict(P({ valueLow: null, valueHigh: null })), 'small');
  assert.equal(L.verdict(P({ offers: undefined })), 'small');
  assert.equal(L.verdict({}), 'conditional', 'no costToClaim is not free');
});

test('rankPrograms and rankMap tie-breaks', () => {
  const list = [
    V({ id: 'long', name: 'A long', certainty: 'chance' }),
    V({ id: 'cond', name: 'A cond', offers: ['coupons'] }),
    V({ id: 'small', name: 'A small', valueLow: 5, valueHigh: 5 }),
    V({ id: 'small-null', name: 'A null', valueLow: null, valueHigh: null }),
    V({ id: 'good', name: 'A good', valueLow: 50, valueHigh: 50 }),
    V({ id: 'top-high', name: 'Top high', valueLow: 300, valueHigh: 500 }),
    V({ id: 'top', name: 'Top' })
  ];
  assert.deepEqual(L.rankPrograms(list).map((p) => p.id),
    ['top-high', 'top', 'good', 'small', 'small-null', 'cond', 'long']);
  const map = L.rankMap(list);
  assert.equal(map['top-high'], 1);
  assert.equal(map.long, 7);
  assert.equal(map.good, 3);
  const copy = list.slice();
  L.rankPrograms(list);
  assert.deepEqual(list, copy, 'input not mutated');
  assert.deepEqual(L.rankPrograms(undefined), []);
  assert.deepEqual(L.rankMap(undefined), {});
});

test('rankPrograms: effort, confidence, then name break ties', () => {
  const list = [
    V({ id: 'n-b', name: 'Bravo' }),
    V({ id: 'n-a', name: 'Alpha' }),
    V({ id: 'conf', name: 'Aaa', confidence: 'low' }),
    V({ id: 'inv', name: 'Aaa', effort: 'involved' }),
    V({ id: 'some', name: 'Zzz', effort: 'some' }),
    V({ id: 'quick', name: 'Zzz', effort: 'quick' })
  ];
  assert.deepEqual(L.rankPrograms(list).map((p) => p.id),
    ['quick', 'some', 'inv', 'n-a', 'n-b', 'conf']);
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

test('sortPrograms recommended is an alias of best (saved preferences keep working)', () => {
  const list = [
    P({ name: 'z-small', valueLow: 5, valueHigh: 5 }),
    P({ name: 'a-ship', costToClaim: 'shipping-fee' }),
    P({ name: 'b-top', valueLow: 200, valueHigh: 200 }),
    P({ name: 'c-chance', certainty: 'chance' }),
    P({ name: 'd-good', valueLow: 40, valueHigh: 40, effort: 'quick' })
  ];
  const want = ['b-top', 'd-good', 'z-small', 'a-ship', 'c-chance'];
  assert.deepEqual(L.sortPrograms(list, 'recommended').map((p) => p.name), want);
  assert.deepEqual(L.sortPrograms(list, 'best').map((p) => p.name), want);
  assert.deepEqual(L.sortPrograms([], 'recommended'), []);
  assert.deepEqual(L.sortPrograms([P({ category: 'zzz', confidence: undefined })], 'recommended').length, 1);
});

test('sortPrograms best, when and the recommended alias', () => {
  const list = [
    V({ id: 'l', name: 'L', certainty: 'chance', when: 'pregnancy' }),
    V({ id: 'a', name: 'A', when: 'after-birth' }),
    V({ id: 'b', name: 'B', valueLow: 30, valueHigh: 30, when: 'pregnancy' }),
    V({ id: 'c', name: 'C', when: 'late-pregnancy' }),
    V({ id: 'd', name: 'D', when: 'anytime' }),
    V({ id: 'e', name: 'E', when: undefined })
  ];
  const best = ['a', 'c', 'd', 'e', 'b', 'l'];
  assert.deepEqual(L.sortPrograms(list, 'best').map((p) => p.id), best);
  assert.deepEqual(L.sortPrograms(list, 'recommended').map((p) => p.id), best);
  assert.deepEqual(L.sortPrograms(list, 'when').map((p) => p.id), ['b', 'l', 'c', 'a', 'd', 'e']);
  assert.deepEqual(L.sortPrograms([], 'best'), []);
  assert.deepEqual(L.sortPrograms([{}], 'when').length, 1);
});

test('filterPrograms offer, openToAll, state, freeStuff', () => {
  const list = [
    P({ name: 'Alpha', offers: ['product', 'coupons'], freeStuff: 'Two sample cans' }),
    P({ name: 'Beta', offers: ['coupons'], certainty: 'if-eligible' }),
    P({ name: 'Gamma', offers: ['service'], states: ['TX'] }),
    P({ name: 'Delta', offers: undefined, states: [] }),
    P({ name: 'Eps', states: ['ca', 'DC'] })
  ];
  const names = (o) => L.filterPrograms(list, o).map((p) => p.name);
  assert.deepEqual(names({ offer: 'coupons' }), ['Alpha', 'Beta']);
  assert.deepEqual(names({ offer: 'service' }), ['Gamma']);
  assert.deepEqual(names({ offer: 'cash' }), []);
  assert.deepEqual(names({ openToAll: true }), ['Alpha', 'Gamma', 'Delta', 'Eps']);
  assert.deepEqual(names({ query: 'sample cans' }), ['Alpha']);
  // state is ignored unless hideOtherStates is on
  assert.equal(names({ state: 'NY' }).length, 5);
  // with no state, every state-limited program is dropped
  assert.deepEqual(names({ hideOtherStates: true }), ['Alpha', 'Beta', 'Delta']);
  assert.deepEqual(names({ state: 'NY', hideOtherStates: true }), ['Alpha', 'Beta', 'Delta']);
  assert.deepEqual(names({ state: 'TX', hideOtherStates: true }), ['Alpha', 'Beta', 'Gamma', 'Delta']);
  assert.deepEqual(names({ state: 'CA', hideOtherStates: true }), ['Alpha', 'Beta', 'Delta', 'Eps']);
  assert.equal(L.otherStateCount(list, 'NY'), 2);
  assert.equal(L.otherStateCount(list, 'TX'), 1);
  assert.equal(L.otherStateCount(list, ''), 2);
  assert.equal(L.otherStateCount(null, 'NY'), 0);
  assert.deepEqual(names({ trulyFree: true }), ['Alpha', 'Eps']);
});

test('valueText', () => {
  assert.equal(L.valueText(P({ valueLow: 40, valueHigh: 60, valueSource: 'estimate' })), 'Worth about $40 to $60 (our estimate)');
  assert.equal(L.valueText(P({ valueLow: 400, valueHigh: 400, valueSource: 'official' })), "Worth about $400 (the program's figure)");
  assert.equal(L.valueText(P({ valueLow: 25, valueHigh: 25, valueSource: 'estimate' })), 'Worth about $25 (our estimate)');
  assert.equal(L.valueText(P({ valueLow: 10, valueHigh: 30, valueSource: 'official' })), "Worth about $10 to $30 (the program's figure)");
  assert.equal(L.valueText(P({ valueLow: null, valueHigh: null, valueSource: 'none' })), 'Value not known');
  assert.equal(L.valueText(P({})), 'Value not known');
  assert.equal(L.valueText(null), 'Value not known');
});

test('totalValue', () => {
  const list = [
    P({ valueLow: 10, valueHigh: 20 }),
    P({ valueLow: 5, valueHigh: 5 }),
    P({ valueLow: null, valueHigh: null }),
    P({})
  ];
  assert.deepEqual(L.totalValue(list), { low: 15, high: 25, count: 2, missing: 2 });
  assert.deepEqual(L.totalValue([]), { low: 0, high: 0, count: 0, missing: 0 });
  assert.deepEqual(L.totalValue(undefined), { low: 0, high: 0, count: 0, missing: 0 });
});

test('weeksUntil', () => {
  assert.equal(L.weeksUntil('2026-12-01', '2026-11-10'), 3);
  assert.equal(L.weeksUntil('2026-11-16', '2026-11-10'), 0);
  assert.equal(L.weeksUntil('2026-11-17', '2026-11-10'), 1);
  assert.equal(L.weeksUntil('2026-11-10', '2026-11-10'), 0);
  assert.equal(L.weeksUntil('2026-11-07', '2026-11-10'), -1);
  assert.equal(L.weeksUntil('2026-10-20', '2026-11-10'), -3);
  assert.equal(L.weeksUntil('2027-03-01', new Date(2026, 10, 10, 23, 59)), 15);
  assert.equal(L.weeksUntil('soon', '2026-11-10'), null);
  assert.equal(L.weeksUntil('2026-02-30', '2026-11-10'), null);
  assert.equal(L.weeksUntil('', '2026-11-10'), null);
  assert.equal(L.weeksUntil(undefined, '2026-11-10'), null);
  assert.equal(L.weeksUntil('2026-11-10', 'bad'), null);
  assert.equal(typeof L.weeksUntil('2099-01-01'), 'number');
});

test('hiddenByState', () => {
  const tx = P({ states: ['TX'] });
  assert.equal(L.hiddenByState(tx, ''), true);
  assert.equal(L.hiddenByState(tx, undefined), true);
  assert.equal(L.hiddenByState(tx, 'CA'), true);
  assert.equal(L.hiddenByState(tx, 'TX'), false);
  assert.equal(L.hiddenByState(tx, ' tx '), false);
  assert.equal(L.hiddenByState(P({ states: [] }), ''), false);
  assert.equal(L.hiddenByState(P({}), 'CA'), false);
  assert.equal(L.hiddenByState(null, 'CA'), false);
});

test('filterPrograms hides state-limited programs with no state or another state', () => {
  const list = [P({ name: 'Open' }), P({ name: 'Ct', states: ['CT'] })];
  const names = (o) => L.filterPrograms(list, o).map((p) => p.name);
  assert.deepEqual(names({ hideOtherStates: true }), ['Open']);
  assert.deepEqual(names({ hideOtherStates: true, state: 'CA' }), ['Open']);
  assert.deepEqual(names({ hideOtherStates: true, state: 'CT' }), ['Open', 'Ct']);
  assert.deepEqual(names({}), ['Open', 'Ct']);
});

test('needsQualifying', () => {
  assert.equal(L.needsQualifying(P({})), false);
  assert.equal(L.needsQualifying(P({ certainty: 'if-eligible' })), true);
  assert.equal(L.needsQualifying(P({ category: 'assistance' })), true);
  assert.equal(L.needsQualifying(P({ requirements: ['insurance'] })), true);
});

test('verdict: free coverage with unknown value is good', () => {
  const cov = P({ offers: ['coverage'], certainty: 'if-eligible', valueLow: null, valueHigh: null });
  assert.equal(L.verdict(cov), 'good');
  assert.equal(L.verdict(P({ offers: ['service'], valueLow: null, valueHigh: null })), 'small');
  assert.equal(L.verdict(P({ offers: ['coverage'], valueLow: 5, valueHigh: 5 })), 'small');
  assert.equal(L.verdict(P({ offers: ['coverage'], costToClaim: 'purchase-required', valueLow: null, valueHigh: null })), 'conditional');
});

test('money', () => {
  assert.equal(L.money(3200), '$3,200');
  assert.equal(L.money(999), '$999');
  assert.equal(L.money(1234567), '$1,234,567');
  assert.equal(L.money(0), '$0');
  assert.equal(L.money(1000.4), '$1,000');
  assert.equal(L.valueText(P({ valueLow: 3200, valueHigh: 3200, valueSource: 'official' })), "Worth about $3,200 (the program's figure)");
});

test('roundTotal', () => {
  assert.equal(L.roundTotal(986), 990);
  assert.equal(L.roundTotal(12340), 12300);
  assert.equal(L.roundTotal(994), 990);
  assert.equal(L.roundTotal(1049), 1000);
  assert.equal(L.roundTotal(1050), 1100);
  assert.equal(L.roundTotal(0), 0);
  assert.equal(L.roundTotal(4), 0);
  assert.equal(L.roundTotal(5), 10);
});

test('totalValue counts a sameAs group once with its largest value', () => {
  const list = [
    P({ id: 'main', sameAs: '', valueLow: 100, valueHigh: 200 }),
    P({ id: 'door2', sameAs: 'main', valueLow: 150, valueHigh: 300 }),
    P({ id: 'door3', sameAs: 'main', valueLow: 50, valueHigh: 60 }),
    P({ id: 'other', valueLow: 10, valueHigh: 20 }),
    P({ id: 'none', valueLow: null, valueHigh: null })
  ];
  assert.deepEqual(L.totalValue(list), { low: 160, high: 320, count: 2, missing: 1 });
  // a missing sameAs is the same as an empty one
  assert.deepEqual(L.totalValue([P({ id: 'a', valueLow: 1, valueHigh: 2 }), P({ id: 'b', sameAs: '', valueLow: 1, valueHigh: 2 })]), { low: 2, high: 4, count: 2, missing: 0 });
  // a group whose main program is not in the list still collapses
  assert.deepEqual(L.totalValue([P({ id: 'x', sameAs: 'gone', valueLow: 5, valueHigh: 9 }), P({ id: 'y', sameAs: 'gone', valueLow: 6, valueHigh: 7 })]), { low: 5, high: 9, count: 1, missing: 0 });
});

test('totalValue missing counts groups with no value, not programs', () => {
  const all = [
    P({ id: 'main', sameAs: '', valueLow: 100, valueHigh: 200 }),
    P({ id: 'd1', sameAs: 'main', valueLow: 100, valueHigh: 200 }),
    P({ id: 'd2', sameAs: 'main', valueLow: 100, valueHigh: 200 })
  ];
  assert.equal(L.totalValue(all).missing, 0);
  // one door has no value but another member does: the group has a value
  assert.equal(L.totalValue([all[0], P({ id: 'd3', sameAs: 'main', valueLow: null, valueHigh: null })]).missing, 0);
  // two doors with no value form one group with no value; one unknown loner is another
  const mixed = all.concat([
    P({ id: 'g1', sameAs: 'gmain', valueLow: null, valueHigh: null }),
    P({ id: 'g2', sameAs: 'gmain', valueLow: null, valueHigh: null }),
    P({ id: 'loner', valueLow: null, valueHigh: null })
  ]);
  assert.deepEqual(L.totalValue(mixed), { low: 100, high: 200, count: 1, missing: 2 });
});

test('rankPrograms ends on id, so data order does not matter', () => {
  const a = P({ id: 'a-one', name: 'Same Name' }), b = P({ id: 'b-two', name: 'Same Name' });
  assert.deepEqual(L.rankPrograms([a, b]).map((p) => p.id), ['a-one', 'b-two']);
  assert.deepEqual(L.rankPrograms([b, a]).map((p) => p.id), ['a-one', 'b-two']);
  assert.equal(L.rankMap([b, a])['a-one'], 1);
});

{
  const note = (o) => L.freeNote(o);
  test('r3 freeNote follows the order in the brief', () => {
    assert.equal(note({ certainty: 'chance', offers: ['cash'] }), 'Nothing arrives unless you are picked.');
    assert.equal(note({ offers: ['testing'] }), 'Nothing arrives unless you are picked.');
    assert.equal(note({ offers: ['cash'], requirements: ['purchase'] }), 'Nothing arrives free without a purchase.');
    assert.equal(note({ costToClaim: 'purchase-required', offers: ['coverage'] }), 'Nothing arrives free without a purchase.');
    assert.equal(note({ requirements: ['membership'] }), 'Nothing arrives free without a paid membership.');
    assert.equal(note({ costToClaim: 'shipping-fee', offers: ['cash'] }), 'Not fully free. You pay a shipping fee.');
    assert.equal(note({ offers: ['cash'] }), 'This pays money. No product is sent.');
    assert.equal(note({ offers: ['coverage'] }), 'This covers a cost. No product is sent.');
    assert.equal(note({ offers: ['service'] }), 'This is a free service. No product is sent.');
    assert.equal(note({ offers: ['coupons'] }), 'This gives coupons or discounts. Nothing arrives free without a purchase.');
    assert.equal(note({ offers: ['points'] }), 'This gives points for purchases. Nothing arrives free without a purchase.');
    assert.equal(note({ offers: [] }), 'What arrives is not stated.');
    assert.equal(note({}), 'What arrives is not stated.');
  });
  test('r3 groupKey', () => {
    assert.equal(L.groupKey({ id: 'a' }), 'a');
    assert.equal(L.groupKey({ id: 'b', sameAs: 'a' }), 'a');
    assert.equal(L.groupKey({ id: 'b', sameAs: '' }), 'b');
  });
  const mk = (id, extra) => Object.assign({ id, name: id, category: 'formula', costToClaim: 'free', certainty: 'sure', offers: ['samples'], requirements: [], valueLow: 10, valueHigh: 10 }, extra || {});
  test('r3 rankMap shares one number per group, with no gaps', () => {
    const list = [mk('main', { valueLow: 100, valueHigh: 100 }), mk('x', { sameAs: 'main' }), mk('y', { sameAs: 'main', valueLow: 100, valueHigh: 100 }), mk('solo', { valueLow: 50, valueHigh: 50 })];
    const r = L.rankMap(list);
    assert.equal(r.main, r.x);
    assert.equal(r.main, r.y);
    assert.equal(new Set(Object.values(r)).size, 2);
    assert.deepEqual(Object.values(r).sort(), [1, 1, 1, 2]);
    assert.equal(r.main, 1);
  });
  test('r3 rankMap with the main entry absent still groups members', () => {
    const r = L.rankMap([mk('x', { sameAs: 'gone' }), mk('y', { sameAs: 'gone' }), mk('z', { valueLow: 1, valueHigh: 1 })]);
    assert.equal(r.x, r.y);
    assert.notEqual(r.x, r.z);
  });
  test('r3 collapseGroups keeps first-appearance order and the first member leads', () => {
    const a = mk('a'), b = mk('b', { sameAs: 'a' }), c = mk('c'), d = mk('d', { sameAs: 'a' }), e = mk('e');
    const out = L.collapseGroups([b, c, d, a, e]);
    assert.deepEqual(out.map((g) => g.lead.id), ['b', 'c', 'e']);
    assert.deepEqual(out[0].others.map((p) => p.id), ['d', 'a']);
    assert.deepEqual(out[1].others, []);
  });
  test('r3 collapseGroups with the main entry absent and ties', () => {
    const out = L.collapseGroups([mk('x', { sameAs: 'm' }), mk('y', { sameAs: 'm' }), mk('t1'), mk('t2')]);
    assert.equal(out.length, 3);
    assert.equal(out[0].lead.id, 'x');
    assert.deepEqual(out[0].others.map((p) => p.id), ['y']);
    assert.deepEqual(out.map((g) => g.lead.id), ['x', 't1', 't2']);
    assert.deepEqual(L.collapseGroups([]), []);
  });
}

// ---- Phase H: kinds, fit, answers ----
{
  const A = (id, o) => Object.assign({ id, name: id, category: 'formula', costToClaim: 'free', certainty: 'guaranteed', offers: ['product'], requirements: [], audience: [] }, o || {});
  test('h kindOf by first offer', () => {
    for (const o of ['product', 'coupons', 'points', 'sweepstakes', 'testing']) assert.equal(L.kindOf(A('a', { offers: [o] })), 'stuff', o);
    assert.equal(L.kindOf(A('a', { offers: ['cash', 'product'] })), 'money');
    assert.equal(L.kindOf(A('a', { offers: ['service'] })), 'care');
    assert.equal(L.kindOf(A('a', { offers: ['coverage'] })), 'care');
    assert.equal(L.kindOf(A('a', { offers: ['product', 'cash'] })), 'stuff');
    assert.equal(L.kindOf(A('a', { offers: [] })), 'stuff');
    assert.equal(L.kindOf({}), 'stuff');
  });
  test('h filterPrograms kind option', () => {
    const list = [A('s'), A('m', { offers: ['cash'] }), A('c', { offers: ['coverage'] })];
    const ids = (k) => L.filterPrograms(list, { kind: k }).map((p) => p.id);
    assert.deepEqual(ids('stuff'), ['s']);
    assert.deepEqual(ids('money'), ['m']);
    assert.deepEqual(ids('care'), ['c']);
    assert.deepEqual(ids('all'), ['s', 'm', 'c']);
    assert.deepEqual(ids(''), ['s', 'm', 'c']);
    assert.deepEqual(ids(undefined), ['s', 'm', 'c']);
  });
  const prof = (o) => Object.assign({}, o);
  const fitOf = (tags, pr, extra) => L.fit(A('a', Object.assign({ audience: tags }, extra || {})), pr);
  test('h fit: no tags, missing audience, unknown tag', () => {
    assert.equal(L.fit(A('a'), {}), 'yes');
    assert.equal(L.fit({ id: 'x' }, {}), 'yes');
    assert.equal(L.fit(A('a'), undefined), 'yes');
    assert.equal(fitOf(['mystery'], { cover: 'private' }), 'maybe');
    assert.equal(fitOf(['local'], { cover: 'private', job: 'yes' }), 'maybe');
  });
  test('h fit: medicaid', () => {
    assert.equal(fitOf(['medicaid'], prof({ cover: 'medicaid' })), 'yes');
    for (const c of ['private', 'marketplace', 'tricare', 'none']) assert.equal(fitOf(['medicaid'], prof({ cover: c })), 'no', c);
    assert.equal(fitOf(['medicaid'], {}), 'maybe');
    assert.equal(fitOf(['medicaid'], { cover: 'bogus' }), 'maybe');
  });
  test('h fit: wic and low-income', () => {
    for (const t of ['wic', 'low-income']) {
      assert.equal(fitOf([t], { lowIncome: 'yes' }), 'yes');
      assert.equal(fitOf([t], { lowIncome: 'no' }), 'no');
      assert.equal(fitOf([t], { lowIncome: '', cover: 'medicaid' }), 'yes');
      assert.equal(fitOf([t], { cover: 'medicaid' }), 'yes');
      assert.equal(fitOf([t], { lowIncome: 'no', cover: 'medicaid' }), 'no');
      assert.equal(fitOf([t], { cover: 'private' }), 'maybe');
      assert.equal(fitOf([t], {}), 'maybe');
    }
  });
  test('h fit: insured, marketplace, military', () => {
    for (const c of ['private', 'marketplace', 'medicaid', 'tricare']) assert.equal(fitOf(['insured'], { cover: c }), 'yes', c);
    assert.equal(fitOf(['insured'], { cover: 'none' }), 'no');
    assert.equal(fitOf(['insured'], {}), 'maybe');
    assert.equal(fitOf(['marketplace'], { cover: 'marketplace' }), 'yes');
    for (const c of ['private', 'medicaid', 'tricare', 'none']) assert.equal(fitOf(['marketplace'], { cover: c }), 'no', c);
    assert.equal(fitOf(['marketplace'], {}), 'maybe');
    assert.equal(fitOf(['military'], { cover: 'tricare' }), 'yes');
    for (const c of ['private', 'medicaid', 'marketplace', 'none']) assert.equal(fitOf(['military'], { cover: c }), 'no', c);
    assert.equal(fitOf(['military'], {}), 'maybe');
  });
  test('h fit: employer and worker', () => {
    assert.equal(fitOf(['employer'], { job: 'no' }), 'no');
    assert.equal(fitOf(['employer'], { job: 'yes' }), 'maybe');
    assert.equal(fitOf(['employer'], {}), 'maybe');
    assert.equal(fitOf(['worker'], { job: 'yes' }), 'yes');
    assert.equal(fitOf(['worker'], { job: 'no' }), 'no');
    assert.equal(fitOf(['worker'], {}), 'maybe');
  });
  test('h fit: member', () => {
    const m = { insurer: 'Aetna' };
    assert.equal(fitOf(['member'], { insurer: 'Aetna' }, m), 'yes');
    assert.equal(fitOf(['member'], { insurer: 'Cigna' }, m), 'no');
    assert.equal(fitOf(['member'], { insurer: 'other' }, m), 'no');
    assert.equal(fitOf(['member'], { cover: 'none' }, m), 'no');
    assert.equal(fitOf(['member'], { cover: 'private' }, m), 'maybe');
    assert.equal(fitOf(['member'], {}, m), 'maybe');
    assert.equal(fitOf(['member'], { insurer: 'Aetna' }, {}), 'no');
  });
  test('h fit: AND semantics', () => {
    assert.equal(fitOf(['medicaid', 'wic'], { cover: 'medicaid', lowIncome: 'yes' }), 'yes');
    assert.equal(fitOf(['medicaid', 'wic'], { cover: 'medicaid', lowIncome: 'no' }), 'no');
    assert.equal(fitOf(['medicaid', 'wic'], { cover: 'private' }), 'no');
    assert.equal(fitOf(['insured', 'worker'], { cover: 'private' }), 'maybe');
    assert.equal(fitOf(['insured', 'local'], { cover: 'private' }), 'maybe');
    assert.equal(fitOf(['insured', 'worker'], { cover: 'private', job: 'yes' }), 'yes');
    assert.equal(fitOf(['local', 'worker'], { cover: 'none', job: 'no' }), 'no');
  });
  test('h hasSituation', () => {
    assert.equal(L.hasSituation({}), false);
    assert.equal(L.hasSituation(undefined), false);
    assert.equal(L.hasSituation({ firstName: 'A', cover: '', job: '' }), false);
    assert.equal(L.hasSituation({ cover: 'none' }), true);
    assert.equal(L.hasSituation({ job: 'no' }), true);
    assert.equal(L.hasSituation({ lowIncome: 'yes' }), true);
    assert.equal(L.hasSituation({ insurer: 'other' }), true);
    assert.equal(L.hasSituation({ cover: 'weird' }), false);
  });
  test('h hidden by answers, counting, and tracker exemption', () => {
    const list = [A('open'), A('mcd', { audience: ['medicaid'] }), A('wic', { audience: ['wic'] }), A('loc', { audience: ['local'] })];
    const pr = { cover: 'private', lowIncome: 'no' };
    assert.equal(L.hiddenByAnswersCount(list, pr), 2);
    assert.equal(L.hiddenByAnswersCount(list, {}), 0);
    assert.deepEqual(L.filterPrograms(list, { hideNoFit: true, profile: pr }).map((p) => p.id), ['open', 'loc']);
    assert.equal(L.filterPrograms(list, { profile: pr }).length, 4);
    // Fits my answers: only fit yes (maybe is dropped too).
    assert.deepEqual(L.filterPrograms(list, { fitsMine: true, profile: pr }).map((p) => p.id), ['open']);
    // In-progress programs are never hidden.
    const st = { mcd: 'signed-up', wic: 'todo' };
    const statusOf = (id) => st[id] || 'todo';
    assert.equal(L.hiddenByAnswersCount(list, pr, statusOf), 1);
    assert.deepEqual(L.filterPrograms(list, { hideNoFit: true, profile: pr, statusOf }).map((p) => p.id), ['open', 'mcd', 'loc']);
    assert.equal(L.hiddenByAnswers(list[1], pr, 'received'), false);
    assert.equal(L.hiddenByAnswers(list[1], pr, 'skipped'), false);
    assert.equal(L.hiddenByAnswers(list[1], pr, 'todo'), true);
    assert.equal(L.hiddenByAnswers(list[1], pr), true);
  });
}

// ---- Phase I: the Tracker's own list ----
const TP = (id, o) => P(Object.assign({ id, name: id, valueLow: 10, valueHigh: 20, when: 'pregnancy', effort: 'quick' }, o));

test('trackerScope: rank order, left-out counts and total', () => {
  const list = [
    TP('tx-only', { states: ['TX'], valueLow: 100, valueHigh: 100 }),
    TP('ca-only', { states: ['CA'] }),
    TP('mcd', { audience: ['medicaid'] }),
    TP('open', { valueLow: 50, valueHigh: 50 })
  ];
  const prof = { state: 'TX', cover: 'private' };
  const s = L.trackerScope(list, { state: 'TX', profile: prof, statusOf: () => 'todo' });
  assert.deepEqual(s.rows.map((r) => r.p.id), ['tx-only', 'open']);
  assert.deepEqual(s.left, { otherState: 1, noFit: 1, covered: 0 });
  assert.equal(s.total, 4);
  assert.ok(s.rows.every((r) => r.status === 'todo' && r.others.length === 0));
});

test('trackerScope: no state set leaves state-only programs out; all: true brings them back', () => {
  const list = [TP('tx-only', { states: ['TX'] }), TP('open')];
  const s = L.trackerScope(list, { profile: {}, statusOf: () => 'todo' });
  assert.deepEqual(s.rows.map((r) => r.p.id), ['open']);
  assert.equal(s.left.otherState, 1);
  const s2 = L.trackerScope(list, { profile: {}, all: true, statusOf: () => 'todo' });
  assert.equal(s2.rows.length, 2);
  assert.equal(s2.left.otherState, 0);
  const s3 = L.trackerScope(list, { statusOf: () => 'todo' });   // no opts at all besides statusOf
  assert.equal(s3.rows.length, 1);
  assert.equal(L.trackerScope(list).rows.length, 1);              // not even statusOf
});

test('trackerScope: the answers rule programs out only when answered, and all: true brings them back', () => {
  const list = [TP('mcd', { audience: ['medicaid'] }), TP('open')];
  assert.equal(L.trackerScope(list, { profile: {}, statusOf: () => 'todo' }).rows.length, 2);
  const prof = { cover: 'private' };
  const s = L.trackerScope(list, { profile: prof, statusOf: () => 'todo' });
  assert.equal(s.rows.length, 1);
  assert.equal(s.left.noFit, 1);
  assert.equal(L.trackerScope(list, { profile: prof, all: true, statusOf: () => 'todo' }).rows.length, 2);
});

test('trackerScope: acted-on programs stay in, even when state or answers would hide them', () => {
  const list = [TP('ca-only', { states: ['CA'] }), TP('mcd', { audience: ['medicaid'] }), TP('skip', {}), TP('open')];
  const st = { 'ca-only': 'signed-up', mcd: 'received', skip: 'skipped' };
  const s = L.trackerScope(list, { state: 'TX', profile: { cover: 'private' }, statusOf: (id) => st[id] || 'todo' });
  assert.deepEqual(s.rows.map((r) => r.p.id).sort(), ['ca-only', 'mcd', 'open', 'skip']);
  assert.deepEqual(s.rows.filter((r) => r.status !== 'todo').map((r) => r.status).sort(), ['received', 'signed-up', 'skipped']);
  assert.deepEqual(s.left, { otherState: 0, noFit: 0, covered: 0 });
});

test('trackerScope: alternates fold under the first lead in rank order', () => {
  const list = [
    TP('lead', { valueLow: 300, valueHigh: 300 }),
    TP('alt-b', { sameAs: 'lead', valueLow: 100, valueHigh: 100 }),
    TP('alt-a', { sameAs: 'lead', valueLow: 200, valueHigh: 200 }),
    TP('solo')
  ];
  const s = L.trackerScope(list, { statusOf: () => 'todo' });
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].p.id, 'lead');
  assert.deepEqual(s.rows[0].others.map((p) => p.id), ['alt-a', 'alt-b']);
});

test('trackerScope: a sign-up covers its group; Skipped does not', () => {
  const list = [
    TP('lead', { valueLow: 300, valueHigh: 300 }),
    TP('alt1', { sameAs: 'lead', valueLow: 200, valueHigh: 200 }),
    TP('alt2', { sameAs: 'lead', valueLow: 100, valueHigh: 100 })
  ];
  const sign = (id) => (id === 'alt1' ? 'signed-up' : 'todo');
  const s = L.trackerScope(list, { statusOf: sign });
  assert.deepEqual(s.rows.map((r) => r.p.id + ':' + r.status), ['alt1:signed-up']);
  assert.equal(s.left.covered, 2);
  // received covers too
  assert.equal(L.trackerScope(list, { statusOf: (id) => (id === 'lead' ? 'received' : 'todo') }).left.covered, 2);
  // Skipped does not: the next alternate becomes the lead
  const skip = L.trackerScope(list, { statusOf: (id) => (id === 'lead' ? 'skipped' : 'todo') });
  assert.deepEqual(skip.rows.map((r) => r.p.id + ':' + r.status), ['lead:skipped', 'alt1:todo']);
  assert.deepEqual(skip.rows[1].others.map((p) => p.id), ['alt2']);
  assert.equal(skip.left.covered, 0);
});

test('trackerScope: all switches off the three leave-out rules but still folds alternates', () => {
  const list = [
    TP('ca-only', { states: ['CA'] }),
    TP('mcd', { audience: ['medicaid'] }),
    TP('lead', { valueLow: 300, valueHigh: 300 }),
    TP('alt', { sameAs: 'lead', valueLow: 100, valueHigh: 100 }),
    TP('signed', { sameAs: 'lead' })
  ];
  const statusOf = (id) => (id === 'signed' ? 'signed-up' : 'todo');
  const s = L.trackerScope(list, { all: true, state: 'TX', profile: { cover: 'private' }, statusOf });
  assert.deepEqual(s.left, { otherState: 0, noFit: 0, covered: 0 });
  assert.equal(s.rows.length, 4);
  const lead = s.rows.find((r) => r.p.id === 'lead');
  assert.deepEqual(lead.others.map((p) => p.id), ['alt']);
  assert.equal(s.total, 5);
});

test('readyNow: due-date windows', () => {
  const w = (when) => ({ when });
  for (const weeks of [null, undefined, 9, 40]) {
    assert.equal(L.readyNow(w('pregnancy'), weeks), true, 'pregnancy ' + weeks);
    assert.equal(L.readyNow(w('anytime'), weeks), true, 'anytime ' + weeks);
    assert.equal(L.readyNow(w('late-pregnancy'), weeks), false, 'late ' + weeks);
    assert.equal(L.readyNow(w('after-birth'), weeks), false, 'after ' + weeks);
  }
  for (const weeks of [8, 0]) {
    assert.equal(L.readyNow(w('late-pregnancy'), weeks), true, 'late ' + weeks);
    assert.equal(L.readyNow(w('pregnancy'), weeks), true);
    assert.equal(L.readyNow(w('after-birth'), weeks), false, 'after ' + weeks);
  }
  for (const when of ['pregnancy', 'late-pregnancy', 'after-birth', 'anytime']) assert.equal(L.readyNow(w(when), -1), true, when);
});

test('trackerSections: to-do rows only; optional by verdict; later puts last-weeks first', () => {
  const rows = [
    { p: TP('a', { when: 'after-birth' }), status: 'todo', others: [] },
    { p: TP('b', { when: 'pregnancy' }), status: 'todo', others: [] },
    { p: TP('c', { when: 'late-pregnancy' }), status: 'todo', others: [] },
    { p: TP('d', { offers: ['coupons'] }), status: 'todo', others: [] },
    { p: TP('e', { certainty: 'chance', when: 'after-birth' }), status: 'todo', others: [] },
    { p: TP('f', { when: 'after-birth' }), status: 'signed-up', others: [] },
    { p: TP('g', { when: 'late-pregnancy' }), status: 'todo', others: [] },
    { p: TP('h', { when: 'anytime' }), status: 'skipped', others: [] }
  ];
  const s = L.trackerSections(rows, null);
  assert.deepEqual(s.now.map((r) => r.p.id), ['b']);
  assert.deepEqual(s.later.map((r) => r.p.id), ['c', 'g', 'a']);   // late-pregnancy before after-birth, rank order kept
  assert.deepEqual(s.optional.map((r) => r.p.id), ['d', 'e']);
  const near = L.trackerSections(rows, 5);
  assert.deepEqual(near.now.map((r) => r.p.id), ['b', 'c', 'g']);
  assert.deepEqual(near.later.map((r) => r.p.id), ['a']);
  const past = L.trackerSections(rows, -2);
  assert.equal(past.later.length, 0);
  assert.equal(past.now.length, 4);
  assert.deepEqual(L.trackerSections([], 3), { now: [], later: [], optional: [] });
});

test('toClaim: leaves out optional and acted-on rows; money is apart; a group counts once', () => {
  const rows = [
    { p: TP('stuff', { valueLow: 100, valueHigh: 200 }), status: 'todo', others: [] },
    { p: TP('care', { offers: ['service'], valueLow: 50, valueHigh: 50 }), status: 'todo', others: [] },
    { p: TP('cash', { offers: ['cash'], valueLow: 1000, valueHigh: 2000 }), status: 'todo', others: [] },
    { p: TP('buy', { offers: ['coupons'], valueLow: 999, valueHigh: 999 }), status: 'todo', others: [] },
    { p: TP('draw', { certainty: 'chance', valueLow: 500, valueHigh: 500 }), status: 'todo', others: [] },
    { p: TP('done', { valueLow: 70, valueHigh: 70 }), status: 'signed-up', others: [] },
    { p: TP('unknown', { valueLow: null, valueHigh: null }), status: 'todo', others: [] }
  ];
  const t = L.toClaim(rows);
  assert.equal(t.free.low, 150); assert.equal(t.free.high, 250); assert.equal(t.free.count, 2); assert.equal(t.free.missing, 1);
  assert.equal(t.money.low, 1000); assert.equal(t.money.high, 2000); assert.equal(t.money.count, 1);
  // two rows of the same group (as a caller might pass them) still count once
  const twin = L.toClaim([
    { p: TP('x', { valueLow: 40, valueHigh: 60 }), status: 'todo', others: [] },
    { p: TP('y', { sameAs: 'x', valueLow: 30, valueHigh: 30 }), status: 'todo', others: [] }
  ]);
  assert.equal(twin.free.count, 1);
  assert.deepEqual(L.toClaim([]).free, { low: 0, high: 0, count: 0, missing: 0 });
});

// ---- Phase I part 3: what My info is missing ----
import { readFileSync as readData } from 'node:fs';
const DATA = JSON.parse(readData(new URL('../data/programs.json', import.meta.url), 'utf8'));

test('missingInfo: exact rules on fixtures', () => {
  const st = P({ id: 's', states: ['IL', 'TX'] });
  assert.deepEqual(L.missingInfo(st, {}), ['state']);
  assert.deepEqual(L.missingInfo(st, null), ['state']);
  assert.deepEqual(L.missingInfo(st, 'junk'), ['state']);
  assert.deepEqual(L.missingInfo(st, { state: 'tx' }), []);
  assert.deepEqual(L.missingInfo(st, { state: 'DE' }), []);          // ruled out
  assert.deepEqual(L.missingInfo(P({}), {}), []);                     // no audience, no states
  assert.deepEqual(L.missingInfo(P({ audience: ['medicaid'] }), {}), ['cover']);
  assert.deepEqual(L.missingInfo(P({ audience: ['medicaid'] }), { cover: 'private' }), []);   // ruled out
  for (const t of ['insured', 'marketplace', 'military']) assert.deepEqual(L.missingInfo(P({ audience: [t] }), {}), ['cover'], t);
  assert.deepEqual(L.missingInfo(P({ audience: ['wic'] }), {}), ['lowIncome']);
  assert.deepEqual(L.missingInfo(P({ audience: ['low-income'] }), { cover: 'private' }), ['lowIncome']);
  assert.deepEqual(L.missingInfo(P({ audience: ['wic'] }), { cover: 'medicaid' }), []);
  assert.deepEqual(L.missingInfo(P({ audience: ['worker'] }), {}), ['job']);
  assert.deepEqual(L.missingInfo(P({ audience: ['employer'] }), {}), ['job']);
  assert.deepEqual(L.missingInfo(P({ audience: ['member'], insurer: 'Aetna' }), { cover: 'private' }), ['insurer']);
  assert.deepEqual(L.missingInfo(P({ audience: ['member'], insurer: 'Aetna' }), { cover: 'none' }), []);
  assert.deepEqual(L.missingInfo(P({ audience: ['local'] }), {}), []);
  assert.deepEqual(L.missingInfo(P({ states: ['TX'], audience: ['worker', 'member', 'wic', 'insured'], insurer: 'Aetna' }), {}),
    ['state', 'cover', 'insurer', 'lowIncome', 'job']);
  assert.deepEqual(L.missingInfo(null, {}), []);
});

test('missingInfoCounts, missingInfoText, onlyInText', () => {
  const list = [P({ id: 'a', states: ['TX'] }), P({ id: 'b', audience: ['medicaid'] }), P({ id: 'c', states: ['TX'], audience: ['insured'] }), P({ id: 'd' })];
  const c = L.missingInfoCounts(list, {});
  assert.deepEqual(c, { total: 3, keys: { state: 2, cover: 2, insurer: 0, lowIncome: 0, job: 0 } });
  const done = L.missingInfoCounts(list, {}, (id) => (id === 'a' ? 'signed-up' : 'todo'));
  assert.equal(done.total, 2);
  assert.equal(L.missingInfoCounts(list, {}, () => 'todo').total, 3);
  assert.equal(L.missingInfoCounts(null, {}).total, 0);
  assert.equal(L.missingInfoText([]), '');
  assert.equal(L.missingInfoText(['state']), 'your state');
  assert.equal(L.missingInfoText(['state', 'insurer']), 'your state and your health plan');
  assert.equal(L.missingInfoText(['state', 'cover', 'lowIncome']), 'your state, your health cover and your income answer');
  assert.equal(L.onlyInText({}), '');
  assert.equal(L.onlyInText({ states: ['DE'] }), 'Only in DE');
  assert.equal(L.onlyInText({ states: ['IL', 'TX'] }), 'Only in IL and TX');
  assert.equal(L.onlyInText({ states: ['DE', 'FL', 'OH'] }), 'Only in DE, FL and OH');
  assert.deepEqual(L.MISSING_KEYS, ['state', 'cover', 'insurer', 'lowIncome', 'job']);
  for (const k of L.MISSING_KEYS) assert.ok(L.MISSING_LABELS[k] && L.MISSING_SHORT[k], k);
});

test('missingInfo invariants over the real data and a grid of profiles', () => {
  const insurers = ['', ...new Set(DATA.map((p) => p.insurer).filter(Boolean)).values()].slice(0, 2).concat(['other']);
  let n = 0;
  for (const cover of ['', 'private', 'marketplace', 'medicaid', 'tricare', 'none'])
    for (const lowIncome of ['', 'yes', 'no'])
      for (const job of ['', 'yes', 'no'])
        for (const insurer of insurers)
          for (const state of ['', 'TX', 'DE']) {
            const pr = { cover, lowIncome, job, insurer, state };
            for (const p of DATA) {
              n++;
              const m = L.missingInfo(p, pr);
              const idx = m.map((k) => L.MISSING_KEYS.indexOf(k));
              assert.ok(idx.every((i) => i >= 0) && idx.every((i, j) => j === 0 || i > idx[j - 1]), 'order ' + p.id);
              const limited = Array.isArray(p.states) && p.states.length > 0;
              const outState = limited && state && !p.states.includes(state);
              const f = L.fit(p, pr);
              if (f === 'no' || outState) assert.deepEqual(m, [], 'ruled out ' + p.id);
              if (m.length) assert.ok(f === 'maybe' || (limited && !state), 'maybe ' + p.id);
              const tags = p.audience || [];
              if (!m.length && f !== 'no' && !outState && !tags.includes('local') && !tags.includes('employer')) assert.equal(f, 'yes', 'yes ' + p.id);
            }
          }
  assert.ok(n > 1000);
  const insurerNames = [...new Set(DATA.map((p) => p.insurer).filter(Boolean))];
  for (const insurer of insurerNames.concat(['other']))
    for (const cover of ['private', 'marketplace', 'medicaid', 'tricare', 'none'])
      for (const p of DATA) assert.deepEqual(L.missingInfo(p, { state: 'TX', cover, insurer, lowIncome: 'no', job: 'yes' }), [], p.id);
});

// ---- BFF.missing: markup of line() and notice() on a tiny fake DOM ----
async function loadMissing() {
  const vm = await import('node:vm');
  class Node_ {
    constructor(tag) { this.tag = tag; this.kids = []; this.attrs = {}; this.className = ''; this.nodeType = 1; }
    appendChild(c) { this.kids.push(c); return c; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    set textContent(t) { this.kids = [{ nodeType: 3, text: String(t) }]; }
    get text() { return this.kids.map((k) => (k.nodeType === 3 ? k.text : k.text)).join(''); }
  }
  Object.defineProperty(Node_.prototype, 'text', { get() { return this.kids.map((k) => (k.nodeType === 3 ? k.text : k.text)).join(''); } });
  const document = { createElement: (t) => new Node_(t), createTextNode: (t) => ({ nodeType: 3, text: t }), addEventListener() {} };
  const sandbox = { document, location: { hash: '' }, BFF: { logic: L } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readData(new URL('../src/js/missing.js', import.meta.url), 'utf8'), sandbox);
  return sandbox.BFF.missing;
}
const find = (n, cls) => (n.className.split(' ').includes(cls) ? [n] : []).concat(...(n.kids || []).filter((k) => k.kids).map((k) => find(k, cls)));

test('BFF.missing.line: one sentence, link last, first key on the link', async () => {
  const M = await loadMissing();
  assert.equal(M.line(P({ id: 'x' }), {}), null);
  const one = M.line(P({ id: 'x', states: ['TX'] }), {});
  assert.equal(one.getAttribute('data-missing'), 'state');
  assert.equal(find(one, 'miss-text')[0].text, 'Only in TX. My info is missing your state.');
  const a = find(one, 'miss-add')[0];
  assert.equal(a.getAttribute('data-info-key'), 'state');
  assert.ok(a.text.startsWith('Add it'));
  const three = M.line(P({ id: 'y', states: ['IL', 'TX'], audience: ['insured', 'worker'] }), {});
  assert.equal(three.getAttribute('data-missing'), 'state cover job');
  assert.equal(find(three, 'miss-text')[0].text, 'Only in IL and TX. My info is missing your state, your health cover and your paid job answer.');
  assert.ok(find(three, 'miss-add')[0].text.startsWith('Add them'));
  assert.equal(M.line(P({ id: 'y', states: ['IL'], audience: ['insured'] }), {}, { states: false }).kids.map((k) => k.text || '').join('').includes('Only in'), false);
});

test('BFF.missing.notice: full, one-key and compact forms', async () => {
  const M = await loadMissing();
  const counts = (keys, total) => ({ total, keys: Object.assign({ state: 0, cover: 0, insurer: 0, lowIncome: 0, job: 0 }, keys) });
  assert.equal(M.notice(counts({}, 0)), null);
  assert.equal(M.notice(null), null);
  const full = M.notice(counts({ state: 60, cover: 29, job: 1 }, 92));
  assert.equal(full.className, 'miss-box');
  assert.equal(full.getAttribute('data-missing-total'), '92');
  assert.equal(full.getAttribute('data-missing-keys'), 'state cover job');
  assert.deepEqual(find(full, 'miss-chip').map((c) => c.getAttribute('data-info-key')), ['state', 'cover', 'job']);
  const one = M.notice(counts({ insurer: 5 }, 5));
  assert.equal(one.className, 'miss-box miss-box--one');
  assert.equal(find(one, 'miss-chip').length, 0);
  assert.equal(find(one, 'miss-lead')[0].text, '! My info is missing your health plan. 5 programs depend on it. Add it in My info');
  assert.equal(find(M.notice(counts({ insurer: 1 }, 1)), 'miss-lead')[0].text, '! My info is missing your health plan. 1 program depends on it. Add it in My info');
  const compact = M.notice(counts({ cover: 29, state: 60 }, 92), { compact: true });
  assert.equal(compact.className, 'miss-box miss-box--one');
  assert.equal(find(compact, 'miss-chip').length, 0);
  assert.equal(find(compact, 'miss-add')[0].getAttribute('data-info-key'), 'state');
  assert.equal(find(compact, 'miss-lead')[0].text, '! My info is missing details that 92 programs depend on. Add them in My info');
  assert.equal(compact.getAttribute('data-missing-keys'), 'state cover');
});

// ---- Phase J: ticks and the one hidden-from-this-list rule ----
test('tickState maps each status to the three boxes, unknown counts as todo', () => {
  assert.deepEqual(L.tickState('todo'), { done: false, received: false, notForMe: false });
  assert.deepEqual(L.tickState('signed-up'), { done: true, received: false, notForMe: false });
  assert.deepEqual(L.tickState('received'), { done: true, received: true, notForMe: false });
  assert.deepEqual(L.tickState('skipped'), { done: false, received: false, notForMe: true });
  assert.deepEqual(L.tickState(undefined), { done: false, received: false, notForMe: false });
  assert.deepEqual(L.tickState('weird'), { done: false, received: false, notForMe: false });
});

test('statusAfterTick: every box, both ways, from every status', () => {
  const S = ['todo', 'signed-up', 'received', 'skipped'];
  const want = {
    'done:true':       { todo: 'signed-up', 'signed-up': 'signed-up', received: 'received', skipped: 'signed-up' },
    'done:false':      { todo: 'todo', 'signed-up': 'todo', received: 'todo', skipped: 'skipped' },
    'received:true':   { todo: 'received', 'signed-up': 'received', received: 'received', skipped: 'received' },
    'received:false':  { todo: 'todo', 'signed-up': 'signed-up', received: 'signed-up', skipped: 'skipped' },
    'notForMe:true':   { todo: 'skipped', 'signed-up': 'skipped', received: 'skipped', skipped: 'skipped' },
    'notForMe:false':  { todo: 'todo', 'signed-up': 'signed-up', received: 'signed-up', skipped: 'todo' }
  };
  want['received:false'].received = 'signed-up';
  want['notForMe:false']['signed-up'] = 'signed-up';
  want['notForMe:false'].received = 'received';
  for (const k of Object.keys(want)) {
    const [box, c] = k.split(':');
    for (const s of S) assert.equal(L.statusAfterTick(s, box, c === 'true'), want[k][s], k + ' from ' + s);
  }
  assert.equal(L.statusAfterTick('signed-up', 'nope', true), 'signed-up');
  assert.equal(L.statusAfterTick(undefined, 'done', true), 'signed-up');
  assert.equal(L.statusAfterTick(undefined, 'nope', false), 'todo');
});

test('coveredGroups: only signed-up or received members cover their group', () => {
  const list = [TP('a1', { sameAs: '' }), TP('a2', { sameAs: 'a1' }), TP('b'), TP('c')];
  const st = { a1: 'signed-up', b: 'skipped', c: 'received' };
  const cov = L.coveredGroups(list, (id) => st[id] || 'todo');
  assert.equal(cov[L.groupKey(list[0])], true);
  assert.equal(cov[L.groupKey(list[1])], true);   // same group as a1
  assert.equal(cov[L.groupKey(list[2])], undefined);
  assert.equal(cov[L.groupKey(list[3])], true);
  assert.deepEqual(L.coveredGroups(list), {});
});

test('hideReason: first match wins, maybe is never hidden', () => {
  assert.deepEqual(L.HIDE_REASONS, ['otherState', 'noFit', 'done', 'notForMe', 'covered']);
  const tx = TP('tx-only', { states: ['TX'] });
  const mcd = TP('mcd', { audience: ['medicaid'] });
  const maybe = TP('maybe', { audience: ['wic'] });
  const open = TP('open');
  const ctx = (st, profile, extra) => Object.assign({ state: 'CA', profile: profile || {}, statusOf: (id) => st[id] || 'todo', covered: {} }, extra);
  assert.equal(L.hideReason(tx, ctx({})), 'otherState');
  assert.equal(L.hideReason(tx, ctx({}, {}, { state: '' })), 'otherState');   // state unknown counts
  assert.equal(L.hideReason(tx, ctx({ 'tx-only': 'signed-up' })), 'done');
  assert.equal(L.hideReason(tx, ctx({ 'tx-only': 'received' })), 'done');
  assert.equal(L.hideReason(tx, ctx({ 'tx-only': 'skipped' })), 'notForMe');
  assert.equal(L.hideReason(mcd, ctx({}, { cover: 'private' }, { state: 'TX' })), 'noFit');
  assert.equal(L.hideReason(mcd, ctx({}, {})), '');                              // no answers, no rule-out
  assert.equal(L.hideReason(maybe, ctx({}, { cover: 'private' })), '');
  assert.equal(L.hideReason(mcd, ctx({ mcd: 'skipped' }, { cover: 'private' })), 'notForMe');
  const cov = {}; cov[L.groupKey(open)] = true;
  assert.equal(L.hideReason(open, ctx({}, {}, { covered: cov })), 'covered');
  assert.equal(L.hideReason(open, ctx({}, {}, { covered: {} })), '');
  assert.equal(L.hideReason(open, { statusOf: () => 'todo' }), '');
});

test('splitHidden: pool keeps order, counts ignore what is shown, covered is worked out itself', () => {
  const list = [TP('open'), TP('tx-only', { states: ['TX'] }), TP('mcd', { audience: ['medicaid'] }),
    TP('lead'), TP('alt', { sameAs: 'lead' }), TP('done1'), TP('skip1')];
  const st = { lead: 'signed-up', done1: 'received', skip1: 'skipped' };
  const ctx = { state: 'CA', profile: { cover: 'private' }, statusOf: (id) => st[id] || 'todo' };
  const a = L.splitHidden(list, ctx, {});
  assert.deepEqual(a.pool.map((p) => p.id), ['open']);
  assert.deepEqual(a.counts, { otherState: 1, noFit: 1, done: 2, notForMe: 1, covered: 1 });
  assert.equal(a.total, 6);
  assert.equal(a.hiddenNow, 6);
  assert.equal(a.reasons.alt, 'covered');
  assert.equal(a.reasons.open, undefined);
  const b = L.splitHidden(list, ctx, { done: true, covered: true });
  assert.deepEqual(b.pool.map((p) => p.id), ['open', 'lead', 'alt', 'done1']);
  assert.deepEqual(b.counts, a.counts);
  assert.equal(b.total, 6);
  assert.equal(b.hiddenNow, 3);
  const all = L.splitHidden(list, ctx, { otherState: true, noFit: true, done: true, notForMe: true, covered: true });
  assert.equal(all.pool.length, list.length);
  assert.equal(all.hiddenNow, 0);
  const none = L.splitHidden([TP('x')], { state: '', statusOf: () => 'todo' });
  assert.equal(none.total, 0);
});

test('the show choices are never saved or read: only the two delete statements remain', () => {
  const src = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
  for (const f of ['tracker.js', 'guided.js', 'logic.js', 'ticks.js']) {
    assert.ok(!/showOtherStates|showNoFit/.test(src(f)), f + ' must not mention the old show choices');
  }
  const lines = src('directory.js').split('\n').filter((l) => /showOtherStates|showNoFit/.test(l));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /delete prefs\.showOtherStates; delete prefs\.showNoFit;/);
});

test('hideReasonText: the one wording for the Programs hidden box and Do it for me', () => {
  assert.equal(L.hideReasonText('otherState', 3, true), '3 for other states');
  assert.equal(L.hideReasonText('otherState', 1, true), '1 for another state');
  assert.equal(L.hideReasonText('otherState', 4, false), '4 only for some states.');
  assert.equal(L.hideReasonText('noFit', 2, true), '2 that your answers in My info rule out');
  assert.equal(L.hideReasonText('done', 1, true), '1 you marked done');
  assert.equal(L.hideReasonText('notForMe', 5, true), '5 you marked not for me');
  assert.equal(L.hideReasonText('covered', 1, true), '1 other way to get something you already signed up for');
  assert.equal(L.hideReasonText('covered', 2, true), '2 other ways to get something you already signed up for');
  assert.equal(L.hideReasonText('nope', 2, true), '');
});

test('ticks.js keeps a change whose save failed: no undo of the entry', () => {
  const src = readFileSync(new URL('../src/js/ticks.js', import.meta.url), 'utf8');
  assert.ok(!/restoreEntry|getEntry/.test(src));
  assert.match(src, /opts\.around/);
});

test('hideCountsText: reasons in HIDE_REASONS order, zero counts and end stops left out', () => {
  assert.equal(L.hideCountsText({}, true), '');
  assert.equal(L.hideCountsText({ otherState: 3, done: 2 }, true), '3 for other states, 2 you marked done');
  assert.equal(L.hideCountsText({ covered: 1, notForMe: 1, noFit: 2, otherState: 1 }, true),
    '1 for another state, 2 that your answers in My info rule out, 1 you marked not for me, 1 other way to get something you already signed up for');
  assert.equal(L.hideCountsText({ otherState: 4, done: 1 }, false), '4 only for some states, 1 you marked done');
});

test('pruneSelection: drops ids that were listed and are hidden now, keeps ones handed over while hidden', () => {
  const selected = { a: true, b: true, c: true, d: true };
  const seen = { a: true, b: true, d: true };      // c was hidden at the last look (handed over)
  const now = { a: true };                          // b and d are hidden now, c still is
  const out = L.pruneSelection(selected, seen, now);
  assert.deepEqual(out, { a: true, c: true });
  assert.deepEqual(selected, { a: true, b: true, c: true, d: true });   // the input is not changed
  assert.deepEqual(L.pruneSelection({ a: true }, null, {}), { a: true });
  assert.deepEqual(L.pruneSelection({ a: true, b: false }, { a: true }, { a: true }), { a: true });
  assert.deepEqual(L.pruneSelection(null, {}, {}), {});
});

test('Do it for me and the Tracker use the shared hide rule and the new wording', () => {
  const src = (f) => readFileSync(new URL('../src/js/' + f, import.meta.url), 'utf8');
  const g = src('guided.js'), t = src('tracker.js');
  assert.match(g, /hideReason\(p, ctx\)/);
  assert.ok(!/text: 'Skip'/.test(g));
  assert.match(g, /text: 'Not for me'/);
  assert.match(t, /skipped: 'Not for me'/);
  assert.ok(!/trk-s-/.test(t));
  assert.match(t, /prefix: 'trk'/);
});
