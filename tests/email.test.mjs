import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const mod = { exports: {} };
new Function('module', readFileSync(new URL('../src/js/email.js', import.meta.url), 'utf8'))(mod);
const E = mod.exports;
const programs = JSON.parse(readFileSync(new URL('../data/programs.json', import.meta.url), 'utf8'));
const SNAPSHOT = {
  "1-natural-way-breast-pump-insurance": "natural",
  "211-org-community-help": "united",
  "aeroflow-breast-pump-resupply-insurance": "aeroflow",
  "aeroflow-breastpumps-insurance": "aeroflow-breastpumps",
  "aeroflow-maternity-compression": "aeroflow-maternity",
  "aeroflow-prenatal-breastfeeding-classes": "aeroflow-prenatal",
  "aetna-better-health-pregnancy-rewards": "aetna",
  "aetna-enhanced-maternity-program": "aetna-enhanced",
  "al-dhr-baby-box-initiative": "alabama",
  "amazon-baby-registry-completion-discount": "amazon",
  "amazon-baby-registry-welcome-box": "amazon-baby",
  "amazon-family-diaper-savings": "amazon-family",
  "ambetter-start-smart-for-your-baby": "ambetter",
  "amerihealth-caritas-bright-start": "amerihealth",
  "anthem-future-moms": "anthem",
  "baby2baby-golden-state-start": "baby2baby",
  "babylist-hello-baby-box": "babylist",
  "babylist-registry-completion-discount": "babylist-registry",
  "babys-only-free-sample-shipping": "baby",
  "bloomingdales-baby-registry-completion-discount": "bloomingdale",
  "blue-cross-special-beginnings": "blue",
  "buybuy-baby-registry-welcome-bag": "buybuy",
  "byram-healthcare-breast-pumps-insurance": "byram",
  "bzzagent-campaigns": "bzzagent",
  "ca-paid-family-leave-sdi": "california",
  "ca-young-child-tax-credit": "california-ca",
  "calkids-newborn-account": "calkids",
  "caresource-babies-first-rewards": "caresource",
  "cdc-vaccines-for-children": "cdc",
  "cigna-healthy-pregnancies-healthy-babies": "cigna",
  "co-famli-paid-leave": "colorado",
  "co-first-step": "collegeinvest",
  "count-the-kicks-app": "healthy",
  "crate-and-kids-registry-completion-discount": "crate",
  "cribs-for-kids-find-a-crib": "cribs",
  "ct-baby-bonds": "connecticut",
  "ct-chet-baby-scholars": "connecticut-ct",
  "ct-paid-leave": "connecticut-ct-2",
  "dc-paid-family-leave": "dcdepartment",
  "de-paid-leave": "delaware",
  "delaware-medicaid-postpartum-diapers-meals": "delaware-medicaid",
  "early-head-start-pregnant-women": "head",
  "edgepark-breast-pump-insurance": "edgepark",
  "enfamil-family-beginnings": "enfamil",
  "enfamil-nutramigen-support-program": "enfamil-nutramigen",
  "family-connects-nurse-home-visit": "family",
  "first5california-kit-for-new-parents": "first",
  "gerber-mygerber-baby": "gerber",
  "healthcare-gov-add-newborn-special-enrollment": "healthcare",
  "healthcare-gov-insurance-covered-breast-pump": "healthcare-gov",
  "healthcare-gov-pregnancy-coverage": "healthcare-gov-2",
  "healthcare-gov-preventive-care-women": "healthcare-gov-3",
  "highmark-mom-options-mom-matters": "highmark",
  "home-tester-club-us-product-tests": "home",
  "hrsa-healthy-start": "hrsa",
  "hrsa-national-maternal-mental-health-hotline": "hrsa-national",
  "huggies-free-newborn-diapers-wipes-signup": "huggies",
  "huggies-rewards": "huggies-rewards",
  "humana-humanabeginnings": "humana",
  "il-child-tax-credit": "illinois",
  "il-first-steps": "illinois-il",
  "imagination-library-free-books": "dolly",
  "influenster-voxbox": "influenster",
  "irs-child-dependent-care-credit-fsa": "irs",
  "irs-child-tax-credit": "irs-child",
  "irs-earned-income-tax-credit": "irs-earned",
  "irs-hsa-fsa-breast-pump-lactation": "irs-hsa",
  "kaiser-permanente-prenatal-classes": "kaiser",
  "kohls-babies-r-us-welcome-box": "kohl",
  "lactation-network-insurance-covered-lactation-support": "lactation",
  "ma-babysteps-savings-plan": "massachusetts",
  "ma-child-family-tax-credit": "massachusetts-ma",
  "ma-paid-family-medical-leave": "massachusetts-ma-2",
  "macrobaby-gift-box": "macrobaby",
  "macys-baby-registry-completion-discount": "macy",
  "mam-club": "mam",
  "march-of-dimes-mom-baby-mobile-health-centers": "march",
  "masshealth-free-prenatal-vitamins": "masshealth",
  "me-alfond-grant": "alfond",
  "me-dependent-exemption-tax-credit": "maine",
  "me-paid-family-medical-leave": "maine-me",
  "medicaid-chip-pregnancy-coverage": "medicaid",
  "medicaid-doula-coverage": "state",
  "meijer-free-prenatal-vitamins": "meijer",
  "mi-rx-kids": "rxkids",
  "mississippi-safe-riders-magnolia": "mississippi",
  "mn-child-tax-credit": "minnesota",
  "mn-paid-leave": "minnesota-mn",
  "molina-pregnancy-rewards": "molina",
  "moms-meet-sampling-programs": "moms",
  "my-health-pays-prenatal-rewards": "sunshine",
  "national-diaper-bank-network-get-help": "national",
  "nd-college-save-new-baby-match": "bank",
  "ne-meadowlark": "nebraska",
  "nest-collaborative-lactation": "nest",
  "nj-child-tax-credit": "newjersey",
  "nj-family-leave-insurance": "newjersey-nj",
  "nm-child-tax-credit": "newmexico",
  "nurse-family-partnership-home-visits": "nurse",
  "ny-empire-state-child-credit": "newyork",
  "ny-free-portable-crib-safe-sleep": "newyork-ny",
  "ny-paid-family-leave": "newyork-ny-2",
  "or-bridge-project-multnomah": "bridge",
  "or-kids-credit": "oregon",
  "or-paid-leave-oregon": "oregon-or",
  "pa-keystone-scholars": "pennsylvania",
  "pampers-free-online-childbirth-classes": "pampers",
  "pampers-rewards": "pampers-rewards",
  "pg-brandsaver-rewards": "procter",
  "pinchme-samples": "pinchme",
  "postpartum-support-international-helpline": "postpartum",
  "postpartum-support-international-online-groups": "postpartum-support",
  "pottery-barn-kids-registry-completion-discount": "pottery",
  "price-chopper-free-prenatal-vitamins": "price",
  "ptpa-parent-tested-parent-approved": "ptpa",
  "reach-out-and-read-free-books": "reach",
  "ri-collegebound-starter": "collegebound",
  "ri-temporary-caregiver-insurance": "rhode",
  "safe-kids-car-seat-check": "safe",
  "safe-kids-good-neighbor-car-seat-events": "safe-kids",
  "similac-alimentum-rewards": "similac",
  "similac-mysimilac-rewards": "similac-mysimilac",
  "simplifed-lactation-support": "simplifed",
  "ssa-newborn-social-security-number": "social",
  "target-registry-completion-discount": "target",
  "target-registry-welcome-kit": "target-registry",
  "tenncare-diaper-benefit": "tenncare",
  "texas-safe-riders-car-seats": "texas",
  "treasury-trump-account-pilot-deposit": "us",
  "tricare-breast-pump-and-supplies": "tricare",
  "tryazon-tryabox-parties": "tryazon",
  "uhc-healthy-first-steps": "unitedhealthcare",
  "upmc-for-you-baby-steps-gift": "upmc",
  "usda-wic": "usda",
  "virginia-low-income-car-seat-program": "virginia",
  "vt-child-tax-credit": "vermont",
  "wa-paid-family-medical-leave": "washington",
  "walmart-baby-registry-free-home-cleaning": "walmart",
  "walmart-baby-registry-welcome-box": "walmart-baby",
  "wellpoint-medicaid-baby-essentials": "wellpoint",
  "wic-breastfeeding-support-food-package": "usda-wic",
  "wic-farmers-market-nutrition-program": "usda-wic-2"
};

test('tagFor is unique, deterministic and well formed across the real data', () => {
  const tags = programs.map((p) => E.tagFor(p, programs));
  assert.equal(new Set(tags).size, tags.length, 'duplicate tags: ' + tags.join(','));
  for (const t of tags) {
    assert.match(t, /^[a-z0-9-]+$/);
    assert.ok(t.length >= 1 && t.length <= 24, t);
    assert.doesNotMatch(t, /^-|-$/);
  }
  const reversed = [...programs].reverse();
  assert.deepEqual(E.tagMap(reversed), E.tagMap(programs), 'input order must not matter');
  assert.deepEqual(Object.keys(E.tagMap(programs)).sort(), programs.map((p) => p.id).sort());
});

test('tagFor naming rules', () => {
  const P = (id, brand) => ({ id, brand });
  const all = [P('walmart-y', 'Walmart'), P('walmart-x', 'Walmart'), P('similac-x', 'Similac (Abbott)'), P('zz', ''), P('walmart-2', 'Walmart'),
    P('1-natural-way', '1 Natural Way'), P('the-network', 'The Lactation Network'), P('us-thing', 'US Big Co'), P('hello', 'HEB Stores')];
  const m = E.tagMap(all);
  assert.equal(m['similac-x'], 'similac');
  assert.equal(m['walmart-2'], 'walmart');
  assert.equal(m['walmart-x'], 'walmart-x');
  assert.equal(m['walmart-y'], 'walmart-y');
  assert.equal(m.zz, 'zz');
  assert.equal(m['1-natural-way'], 'natural', 'numbers are dropped');
  assert.equal(m['the-network'], 'lactation', 'stopwords are dropped');
  assert.equal(m['us-thing'], 'bigco', 'short first word joins the second');
  assert.equal(m.hello, 'hebstores');
  assert.equal(E.tagFor(P('new-thing', 'Brand X Co'), all), 'brand');
  const dup = E.tagMap([P('aa', 'Aa'), P('aa-aa', 'Aa'), P('aa-aa-aa', 'Aa')]);
  assert.deepEqual(Object.values(dup).sort(), ['aa', 'aa-2', 'aa-3']);
  assert.ok(E.tagFor(P('x', 'A very long-winded brand name that goes on and on'), []).length <= 24);
});

test('tags stay stable when stored tags are passed back in', () => {
  const stored = E.tagMap(programs);
  const extra = [{ id: 'a-first', brand: 'Similac Test', name: 'x', signupUrl: 'https://a.example/' }, ...programs];
  const next = E.tagMap(extra, stored);
  for (const p of programs) assert.equal(next[p.id], stored[p.id], p.id);
  assert.notEqual(next['a-first'], stored['similac-mysimilac-rewards']);
  assert.equal(new Set(Object.values(next)).size, extra.length);
  // a stored tag is never reused, even by a program that is no longer in the data
  const m = E.tagMap([{ id: 'n1', brand: 'Gerber' }], { gone: 'gerber' });
  assert.notEqual(m.n1, 'gerber');
});

test('snapshot: the tag for every current program', () => {
  assert.deepEqual(E.tagMap(programs), SNAPSHOT, 'tags changed; check the new ones read well, then update SNAPSHOT');
});

test('plusAddress', () => {
  assert.equal(E.plusAddress('jane@gmail.com', 'similac'), 'jane+similac@gmail.com');
  assert.equal(E.plusAddress('jane+old@gmail.com', 'new'), 'jane+new@gmail.com');
  assert.equal(E.plusAddress('Jane.Doe@GMAIL.com', 'Similac'), 'Jane.Doe+similac@gmail.com');
  assert.equal(E.plusAddress('  jane@gmail.com ', 'x'), 'jane+x@gmail.com');
  for (const bad of ['', 'nope', 'a@b', '@gmail.com', 'jane@', '+x@gmail.com', 'a b@gmail.com', null, undefined])
    assert.equal(E.plusAddress(bad, 'x'), '', String(bad));
  assert.equal(E.plusAddress('jane@gmail.com', ''), '');
});

test('supportsPlus', () => {
  for (const d of ['gmail.com', 'googlemail.com', 'fastmail.com', 'proton.me', 'protonmail.com'])
    assert.equal(E.supportsPlus('a@' + d), true, d);
  for (const d of ['outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com'])
    assert.equal(E.supportsPlus('a@' + d), null, d);
  assert.equal(E.supportsPlus('A@GMAIL.COM'), true);
  assert.equal(E.supportsPlus('a@yahoo.com'), false);
  assert.equal(E.supportsPlus('a@example.org'), null);
  assert.equal(E.supportsPlus('garbage'), null);
  assert.equal(E.supportsPlus(''), null);
});

test('gmailSearchUrl encoding', () => {
  const base = 'https://mail.google.com/mail/u/0/#search/';
  const u = E.gmailSearchUrl({ email: 'jane@gmail.com', tag: 'similac', domain: 'similac.com' });
  assert.ok(u.startsWith(base));
  assert.equal(decodeURIComponent(u.slice(base.length)), 'to:(jane+similac@gmail.com) OR from:(similac.com)');
  assert.ok(u.includes('%2B'), 'plus must be percent-encoded');
  assert.doesNotMatch(u.slice(base.length), /[\s"<>]/);
  const f = E.gmailSearchUrl({ email: 'jane@gmail.com', domain: 'similac.com' });
  assert.equal(decodeURIComponent(f.slice(base.length)), 'from:(similac.com)');
  assert.equal(E.gmailSearchUrl({ email: 'jane@gmail.com' }), '');
});

const prog = [
  { id: 'a-1', name: 'Tom & Jerry <"Box"> \'s', brand: 'Acme', requirements: ['email'], signupUrl: 'https://www.acme.com/signup?x=1&y=2' },
  { id: 'b-1', name: 'Path/Name', brand: 'Bravo', requirements: ['email'], signupUrl: 'https://bravo.example/x' }
];
function props(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/<apps:property name="([^"]*)" value="([^"]*)"\/>/g)].map((x) => [x[1], x[2]])));
}
test('registrableDomain and broad domains', () => {
  assert.equal(E.registrableDomain('register.gerber.com'), 'gerber.com');
  assert.equal(E.registrableDomain('www.similac.com'), 'similac.com');
  assert.equal(E.registrableDomain('cert.safekids.org'), 'safekids.org');
  assert.equal(E.registrableDomain('shop.example.co.uk'), 'example.co.uk');
  assert.equal(E.registrableDomain('revenue.state.mn.us'), 'state.mn.us');
  assert.equal(E.registrableDomain('www.medela.us'), 'medela.us');
  for (const d of ['amazon.com', 'target.com', 'walmart.com', 'healthcare.gov', 'usda.gov', 'x.mil', '']) assert.equal(E.isBroadDomain(d), true, d);
  assert.equal(E.isBroadDomain('gerber.com'), false);
});

test('gmailFiltersXml without plus: from filters on registrable domains, deduped, never archived', () => {
  const list = [
    { id: 'a-1', name: 'Tom & Jerry <"Box"> \'s', brand: 'Acme', requirements: ['email'], signupUrl: 'https://register.acme.com/signup?x=1&y=2' },
    { id: 'a-2', name: 'Acme two', brand: 'Acme', requirements: ['email'], signupUrl: 'https://www.acme.com/two' },
    { id: 'b-1', name: 'Path/Name', brand: 'Bravo', requirements: ['email'], signupUrl: 'https://bravo.example/x' },
    { id: 'z-1', name: 'Shop', brand: 'Amazon', requirements: ['email'], signupUrl: 'https://www.amazon.com/x' },
    { id: 'g-1', name: 'Gov', brand: 'HC', requirements: ['email'], signupUrl: 'https://www.healthcare.gov/x' }
  ];
  const xml = E.gmailFiltersXml(list, { email: 'jane@gmail.com', usePlus: false, archive: true });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom" xmlns:apps="http:\/\/schemas\.google\.com\/apps\/2006">/);
  assert.match(xml, /<\/feed>\n$/);
  assert.equal((xml.match(/<entry>/g) || []).length, 2);
  assert.equal((xml.match(/<\/entry>/g) || []).length, 2);
  for (const m of xml.matchAll(/value="([^"]*)"/g)) assert.doesNotMatch(m[1], /[<>"']|&(?!(amp|lt|gt|quot|apos);)/);
  const p = props(xml);
  assert.equal(p[0].from, 'acme.com');
  assert.equal(p[0].label, 'Baby Freebies/Tom &amp; Jerry &lt;&quot;Box&quot;&gt; &apos;s');
  assert.equal(p[1].from, 'bravo.example');
  assert.equal(p[1].label, 'Baby Freebies/Path-Name');
  assert.doesNotMatch(xml, /shouldArchive/, 'from filters never archive, even when asked');
  assert.doesNotMatch(xml, /amazon|healthcare/);
});

test('gmailFiltersXml with plus: to filters, archive only here', () => {
  const list = [
    { id: 'a-1', name: 'A', brand: 'Acme', requirements: ['email'], signupUrl: 'https://acme.com/' },
    { id: 'z-1', name: 'Z', brand: 'Amazon', requirements: ['email'], signupUrl: 'https://www.amazon.com/x' }
  ];
  const o = { email: 'jane@gmail.com', usePlus: true };
  const off = props(E.gmailFiltersXml(list, o));
  assert.deepEqual(off.map((x) => x.to), ['jane+acme@gmail.com', 'jane+amazon@gmail.com']);
  assert.ok(off.every((x) => !('from' in x) && !('shouldArchive' in x)));
  const on = props(E.gmailFiltersXml(list, { ...o, archive: true }));
  assert.ok(on.every((x) => x.shouldArchive === 'true'));
  // stored tags win, and a bad or Yahoo address falls back to (non-archiving) from filters
  assert.equal(props(E.gmailFiltersXml(list, { ...o, tagMap: { 'a-1': 'custom', 'z-1': 'zed' } }))[0].to, 'jane+custom@gmail.com');
  for (const email of ['x', 'jane@yahoo.com']) {
    const f = E.gmailFiltersXml(list, { email, usePlus: true, archive: true });
    assert.equal(props(f)[0].from, 'acme.com');
    assert.doesNotMatch(f, /shouldArchive/);
  }
});

test('gmailSearchUrl uses the registrable domain, skips broad ones and honours the account number', () => {
  const base = 'https://mail.google.com/mail/u/';
  const u = E.gmailSearchUrl({ email: 'j@gmail.com', domain: 'register.gerber.com', account: 2 });
  assert.ok(u.startsWith(base + '2/#search/'));
  assert.equal(decodeURIComponent(u.split('#search/')[1]), 'from:(gerber.com)');
  assert.equal(E.gmailSearchUrl({ email: 'j@gmail.com', domain: 'amazon.com' }), '');
  assert.equal(decodeURIComponent(E.gmailSearchUrl({ email: 'j@gmail.com', tag: 'amazon', domain: 'amazon.com' }).split('#search/')[1]), 'to:(j+amazon@gmail.com)');
  assert.ok(E.gmailSearchUrl({ email: 'j@gmail.com', domain: 'gerber.com', account: 99 }).startsWith(base + '9/'));
});

test('mailtoChecklist', () => {
  const small = E.mailtoChecklist({ to: 'jane+x@gmail.com', programs: prog, statusOf: () => 'To do' });
  assert.ok(small.url.startsWith('mailto:jane%2Bx@gmail.com?subject=Baby%20freebies%20checklist&body='));
  assert.equal(small.truncated, false);
  const body = decodeURIComponent(small.url.split('&body=')[1]);
  assert.equal(body, small.fullText);
  assert.match(body, /Path\/Name \[To do\]\r\n  https:\/\/bravo\.example\/x/);
  const many = Array.from({ length: 80 }, (_, i) => ({ id: 'p' + i, name: 'Program number ' + i, signupUrl: 'https://example.com/signup/' + i }));
  const big = E.mailtoChecklist({ to: 'jane@gmail.com', programs: many, statusOf: () => 'Signed up' });
  assert.ok(big.url.length < 1900, String(big.url.length));
  assert.equal(big.truncated, true);
  const bb = decodeURIComponent(big.url.split('&body=')[1]);
  assert.match(bb, /…and \d+ more \(see the app\)$/);
  const shown = (bb.match(/^- /gm) || []).length;
  assert.match(bb, new RegExp('…and ' + (80 - shown) + ' more'));
  assert.equal((big.fullText.match(/^- /gm) || []).length, 80);
  assert.doesNotMatch(big.fullText, /see the app/);
  assert.equal(E.mailtoChecklist({ to: 'a@b.co', programs: [] }).truncated, false);
});

test('icsReminders', () => {
  const ics = E.icsReminders([{ id: 'a-1', name: 'Alpha, Inc; x', date: '2026-01-05' }, { id: 'b', name: 'B', date: '2026-12-10' }, { id: 'c', name: 'C', date: '2024-01-31' }, { id: 'bad', name: 'x', date: 'nope' }]);
  assert.ok(ics.endsWith('\r\n'));
  assert.doesNotMatch(ics.replace(/\r\n/g, ''), /[\r\n]/);
  assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(ics, /UID:a-1@baby-freebies-finder\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260202\r\n/); // 2026-01-05 + 28
  assert.match(ics, /DTSTART;VALUE=DATE:20270107\r\n/); // year end: 2026-12-10 + 28
  assert.match(ics, /DTSTART;VALUE=DATE:20240228\r\n/); // leap-year month end: 2024-01-31 + 28
  assert.match(ics, /DTEND;VALUE=DATE:20260203\r\n/);
  assert.ok(ics.includes(String.raw`SUMMARY:Check for Alpha\, Inc\; x mail or box` + "\r\n"));
  assert.equal(ics, E.icsReminders([{ id: 'a-1', name: 'Alpha, Inc; x', date: '2026-01-05' }, { id: 'b', name: 'B', date: '2026-12-10' }, { id: 'c', name: 'C', date: '2024-01-31' }, { id: 'bad', name: 'x', date: 'nope' }]), 'deterministic');
  assert.match(E.icsReminders([{ id: 'z', name: 'Z', date: '2026-02-01' }], { days: 30 }), /DTSTART;VALUE=DATE:20260303/);
  assert.match(E.icsReminders([{ id: 'z', name: 'Z', date: '2026-12-31T23:30:00.000Z' }], { days: 1 }), /DTSTART;VALUE=DATE:20270101/);
  assert.doesNotMatch(ics, /TZID|URL:|ATTACH/);
});

test('icsReminders folds long lines at 75 octets', () => {
  const name = 'Très long name é'.repeat(12);
  const ics = E.icsReminders([{ id: 'x', name, date: '2026-03-01' }]);
  const lines = ics.split('\r\n');
  for (const l of lines) assert.ok(Buffer.byteLength(l) <= 75, l);
  assert.ok(lines.some((l) => l.startsWith(' ')));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Check for ' + name + ' mail or box'));
  assert.ok(!unfolded.includes(String.fromCharCode(0xFFFD)));
});

// ---- which programs belong in the email features ----
test('inEmailFeatures: email requirement and no government domain, in one place', () => {
  const mk = (requirements, url) => ({ id: 'x', requirements, signupUrl: url });
  assert.equal(E.inEmailFeatures(mk(['email'], 'https://www.similac.com/')), true);
  assert.equal(E.inEmailFeatures(mk(['email', 'address'], 'https://www.target.com/gift-registry')), true);
  assert.equal(E.inEmailFeatures(mk(['address'], 'https://www.similac.com/')), false, 'no email requirement');
  assert.equal(E.inEmailFeatures(mk(['insurance', 'phone'], 'https://www.aeroflow.com/')), false);
  for (const u of ['https://www.irs.gov/x', 'https://www.ssa.gov/', 'https://www.healthcare.gov/a', 'https://dhs.state.tx.us/x', 'https://x.army.mil/']) {
    assert.equal(E.inEmailFeatures(mk(['email'], u)), false, u);
  }
  assert.equal(E.inEmailFeatures(mk('email', 'https://a.com/')), false);
  assert.equal(E.inEmailFeatures(mk(['email'], 'not a url')), false);
  assert.equal(E.inEmailFeatures(null), false);
  assert.equal(E.emailPrograms(null).length, 0);
});

test('current data: no government program is in the email features, and brand sign-ups with email are', () => {
  const inc = E.emailPrograms(programs), out = programs.filter((p) => !E.inEmailFeatures(p));
  assert.ok(inc.length > 0 && out.length > 0);
  for (const p of inc) { assert.ok(p.requirements.includes('email')); assert.doesNotMatch(E.domainOfUrl(p.signupUrl), /\.(gov|mil)$/); }
  for (const p of programs.filter((q) => /\.gov\//.test(q.signupUrl))) assert.ok(out.includes(p), p.id);
});

test('gmailFiltersXml with 150 programs: only included programs, one entry per filter, bounded size', () => {
  const many = Array.from({ length: 150 }, (_, i) => ({
    id: 'p-' + String(i).padStart(3, '0'), brand: 'Brand' + i, name: 'Program ' + i,
    requirements: i % 5 === 3 ? ['email'] : i % 5 === 4 ? ['phone'] : ['email'],
    signupUrl: i % 5 === 3 ? 'https://www.agency' + i + '.gov/x' : 'https://www.brand' + i + '.com/x'
  }));
  const inc = many.filter(E.inEmailFeatures);
  assert.equal(inc.length, 90);
  for (const usePlus of [false, true]) {
    const xml = E.gmailFiltersXml(many, { email: 'jane@gmail.com', usePlus, archive: false, allPrograms: many });
    assert.equal((xml.match(/<entry>/g) || []).length, 90);
    assert.doesNotMatch(xml, /\.gov/);
    assert.ok(xml.length < 60000, String(xml.length));
  }
});

test('gmailSearchUrl gives no link for a program outside the email features', () => {
  const gov = { id: 'g', requirements: ['email'], signupUrl: 'https://www.benefit.gov/x' };
  assert.equal(E.gmailSearchUrl({ email: 'jane@gmail.com', tag: 'benefit', domain: 'benefit.gov', program: gov }), '');
  const ok = { id: 'o', requirements: ['email'], signupUrl: 'https://www.acme.com/x' };
  assert.match(E.gmailSearchUrl({ email: 'jane@gmail.com', tag: 'acme', domain: 'acme.com', program: ok }), /^https:\/\/mail\.google\.com\//);
});
