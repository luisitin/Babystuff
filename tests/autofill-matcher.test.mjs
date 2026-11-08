import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyField, valueFor, cleanText, registrableDomain, sameSite, isGuidedDefault } from '../tools/autofill/field-matcher.mjs';

const c = (o) => classifyField({ type: 'text', ...o });

test('autocomplete tokens win', () => {
  assert.equal(c({ autocomplete: 'given-name' }), 'firstName');
  assert.equal(c({ autocomplete: 'family-name' }), 'lastName');
  assert.equal(c({ autocomplete: 'name' }), 'fullName');
  assert.equal(c({ autocomplete: 'email' }), 'email');
  assert.equal(c({ autocomplete: 'tel' }), 'phone');
  assert.equal(c({ autocomplete: 'address-line1' }), 'address1');
  assert.equal(c({ autocomplete: 'address-line2' }), 'address2');
  assert.equal(c({ autocomplete: 'address-level2' }), 'city');
  assert.equal(c({ autocomplete: 'address-level1' }), 'state');
  assert.equal(c({ autocomplete: 'postal-code' }), 'zip');
  assert.equal(c({ autocomplete: 'shipping postal-code' }), 'zip');
});

test('label, name, id and placeholder heuristics', () => {
  assert.equal(c({ label: 'First Name' }), 'firstName');
  assert.equal(c({ name: 'fname' }), 'firstName');
  assert.equal(c({ label: 'Last name *' }), 'lastName');
  assert.equal(c({ id: 'surname' }), 'lastName');
  assert.equal(c({ label: 'Your name' }), 'fullName');
  assert.equal(c({ placeholder: 'Email address' }), 'email');
  assert.equal(c({ type: 'email' }), 'email');
  assert.equal(c({ name: 'mobile_phone' }), 'phone');
  assert.equal(c({ type: 'tel' }), 'phone');
  assert.equal(c({ label: 'Street Address' }), 'address1');
  assert.equal(c({ label: 'Apt, suite, unit' }), 'address2');
  assert.equal(c({ name: 'address2' }), 'address2');
  assert.equal(c({ label: 'City' }), 'city');
  assert.equal(c({ label: 'State' }), 'state');
  assert.equal(c({ name: 'zipCode' }), 'zip');
  assert.equal(c({ label: 'Baby due date' }), 'dueDate');
  assert.equal(c({ type: 'date', label: 'Expected delivery date' }), 'dueDate');
  assert.equal(c({ label: 'Due month' }), 'dueMonth');
  assert.equal(c({ name: 'due_day' }), 'dueDay');
  assert.equal(c({ label: 'Due year' }), 'dueYear');
});

test('unknown and other-person fields are skipped', () => {
  assert.equal(c({ label: 'How did you hear about us?' }), null);
  assert.equal(c({ label: "Baby's first name" }), null);
  assert.equal(c({ type: 'date', label: 'Your birthday' }), null);
});

test('skip rules: password, card, cvv, ssn, insurance, search, hidden', () => {
  assert.equal(c({ type: 'password', label: 'Password' }), null);
  assert.equal(c({ label: 'Create password' }), null);
  assert.equal(c({ autocomplete: 'new-password' }), null);
  assert.equal(c({ autocomplete: 'cc-number' }), null);
  assert.equal(c({ label: 'Credit card number' }), null);
  assert.equal(c({ name: 'cvv' }), null);
  assert.equal(c({ label: 'Card expiration' }), null);
  assert.equal(c({ label: 'Social Security Number' }), null);
  assert.equal(c({ name: 'ssn' }), null);
  assert.equal(c({ label: 'Insurance member ID' }), null);
  assert.equal(c({ name: 'insurance_provider' }), null);
  assert.equal(c({ type: 'search', label: 'Search' }), null);
  assert.equal(c({ type: 'hidden', name: 'email' }), null);
  assert.equal(c({ type: 'checkbox', label: 'Email me offers' }), null);
  // A skip word beats a friendly autocomplete token.
  assert.equal(c({ autocomplete: 'email', label: 'Insurance email' }), null);
});

const profile = {
  firstName: 'Jane', lastName: 'Doe', email: 'jane+baby@example.com', phone: '555-555-0123',
  address1: '1 Main St', address2: '', city: 'Springfield', state: 'IL', zip: '62701', dueDate: '2027-03-05',
};

test('valueFor plain values', () => {
  assert.equal(valueFor('firstName', profile), 'Jane');
  assert.equal(valueFor('fullName', profile), 'Jane Doe');
  assert.equal(valueFor('address2', profile), null);
  assert.equal(valueFor('bogus', profile), null);
});

test('valueFor date formats', () => {
  assert.equal(valueFor('dueDate', profile, { inputType: 'date' }), '2027-03-05');
  assert.equal(valueFor('dueDate', profile, { inputType: 'text' }), '03/05/2027');
  assert.equal(valueFor('dueMonth', profile), '03');
  assert.equal(valueFor('dueDay', profile), '05');
  assert.equal(valueFor('dueYear', profile), '2027');
});

test('valueFor selects match option lists', () => {
  const months = ['Month', 'January', 'February', 'March', 'April'].map((l, i) => ({ value: i ? String(i) : '', label: l }));
  assert.equal(valueFor('dueMonth', profile, { options: months }), '3');
  const mnames = [{ value: 'Jan', label: 'Jan' }, { value: 'Mar', label: 'Mar' }];
  assert.equal(valueFor('dueMonth', profile, { options: mnames }), 'Mar');
  const days = [{ value: '', label: 'Day' }, { value: '5', label: '5' }, { value: '15', label: '15' }];
  assert.equal(valueFor('dueDay', profile, { options: days }), '5');
  assert.equal(valueFor('dueYear', profile, { options: ['2026', '2027', '2028'] }), '2027');
  assert.equal(valueFor('dueYear', profile, { options: ['2020'] }), null);
});

test('valueFor state: code or full name', () => {
  assert.equal(valueFor('state', profile), 'IL');
  assert.equal(valueFor('state', { state: 'illinois' }), 'IL');
  assert.equal(valueFor('state', profile, { options: [{ value: 'IL', label: 'Illinois' }] }), 'IL');
  assert.equal(valueFor('state', profile, { options: [{ value: '14', label: 'Illinois' }, { value: '15', label: 'Indiana' }] }), '14');
  assert.equal(valueFor('state', { state: 'Illinois' }, { options: [{ value: 'IL', label: 'IL' }] }), 'IL');
  assert.equal(valueFor('state', { state: 'Texas' }, { options: [{ value: 'IL', label: 'Illinois' }] }), null);
});

test('other people, other roles and other things are skipped', () => {
  assert.equal(c({ label: 'Last menstrual period (LMP)' }), null);
  assert.equal(c({ type: 'date', label: 'Last menstrual period' }), null);
  assert.equal(c({ name: 'lmp_date' }), null);
  assert.equal(c({ label: 'First time parent?' }), null);
  assert.equal(c({ label: 'Phone type' }), null);
  assert.equal(c({ label: 'Spouse email' }), null);
  assert.equal(c({ label: "Partner's first name" }), null);
  assert.equal(c({ label: "Doctor's phone" }), null);
  assert.equal(c({ label: 'Hospital city' }), null);
  assert.equal(c({ label: 'Gift recipient email' }), null);
  assert.equal(c({ label: 'Friend email (referral)' }), null);
  assert.equal(c({ label: 'Emergency contact phone' }), null);
  assert.equal(c({ label: 'Grandmother name' }), null);
  assert.equal(c({ label: 'Business address' }), null);
  assert.equal(c({ autocomplete: 'email', label: 'Spouse email' }), null);
  // Own details still work.
  assert.equal(c({ label: 'First' }), 'firstName');
  assert.equal(c({ label: 'Last name' }), 'lastName');
});

test('honeypot names are skipped', () => {
  assert.equal(c({ name: 'honeypot' }), null);
  assert.equal(c({ name: 'hp', label: 'Email' }), null);
  assert.equal(c({ label: 'Leave blank', name: 'email2' }), null);
});

test('cleanText strips escapes and control characters', () => {
  assert.equal(cleanText('Email\u001b[31m red\u001b[0m'), 'Email red');
  assert.equal(cleanText('A\u001b]0;evil title\u0007B'), 'AB');
  assert.equal(cleanText('x\ny\u0000z\u009b'), 'x y z');
  assert.equal(cleanText('a'.repeat(200)).length, 80);
});

test('registrable domain check for redirects', () => {
  assert.equal(registrableDomain('https://www.enfamil.com/x'), 'enfamil.com');
  assert.equal(registrableDomain('https://register.gerber.com/'), 'gerber.com');
  assert.equal(registrableDomain('https://shop.example.co.uk/'), 'example.co.uk');
  assert.ok(sameSite('https://www.similac.com/a', 'https://similac.com/b'));
  assert.ok(!sameSite('https://similac.com/', 'https://evil-similac.com/'));
  assert.ok(!sameSite('https://similac.com.evil.net/', 'https://similac.com/'));
});

test('--all-free uses the guidedDefault rule', () => {
  const base = { costToClaim: 'free', category: 'formula', requirements: ['email'] };
  assert.ok(isGuidedDefault(base));
  assert.ok(!isGuidedDefault({ ...base, costToClaim: 'shipping-fee' }));
  assert.ok(!isGuidedDefault({ ...base, requirements: ['email', 'purchase'] }));
  assert.ok(!isGuidedDefault({ ...base, requirements: ['membership'] }));
  assert.ok(!isGuidedDefault({ ...base, requirements: ['insurance'] }));
  assert.ok(!isGuidedDefault({ ...base, requirements: ['eligibility'] }));
  assert.ok(!isGuidedDefault({ ...base, category: 'health-benefits' }));
  assert.ok(!isGuidedDefault({ ...base, category: 'assistance' }));
  assert.ok(!isGuidedDefault(null));
});
