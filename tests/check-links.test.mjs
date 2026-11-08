import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registrableDomain, isExpectedRedirect, classify } from '../scripts/check-links.mjs';

test('registrableDomain', () => {
  assert.equal(registrableDomain('www.similac.com'), 'similac.com');
  assert.equal(registrableDomain('help.babylist.com'), 'babylist.com');
  assert.equal(registrableDomain('cert.safekids.org'), 'safekids.org');
  assert.equal(registrableDomain('www.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('shop.example.com.au'), 'example.com.au');
  assert.equal(registrableDomain('211.org'), '211.org');
  assert.equal(registrableDomain('WWW.Pampers.COM'), 'pampers.com');
});

test('isExpectedRedirect', () => {
  assert.ok(isExpectedRedirect('www.babylist.com', 'help.babylist.com'));
  assert.ok(isExpectedRedirect('fns.usda.gov', 'fna.usda.gov'));
  assert.ok(isExpectedRedirect('www.byramhealthcare.com', 'byrambaby.com'));
  assert.ok(isExpectedRedirect('pgeveryday.com', 'www.pgbrandsaver.com'));
  assert.ok(!isExpectedRedirect('similac.com', 'evil-coupons.com'));
});

const start = 'https://www.similac.com/rewards.html';

test('classify OK', () => {
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>MySimilac Rewards</title>' }), 'OK');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: 'https://similac.com/x', bodySnippet: '' }), 'OK');
});

test('classify NOT-FOUND', () => {
  assert.equal(classify({ status: 404, startUrl: start, finalUrl: start }), 'NOT-FOUND');
  assert.equal(classify({ status: 410, startUrl: start, finalUrl: start }), 'NOT-FOUND');
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>Page Not Found | Brand</title>' }), 'NOT-FOUND');
});

test('classify OFF-DOMAIN', () => {
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: 'https://coupons.example.net/', bodySnippet: '<title>Hi</title>' }), 'OFF-DOMAIN');
});

test('classify BLOCKED', () => {
  for (const status of [403, 429, 503]) {
    assert.equal(classify({ status, startUrl: start, finalUrl: start }), 'BLOCKED');
  }
  assert.equal(classify({ status: 200, startUrl: start, finalUrl: start, bodySnippet: '<title>Just a moment...</title>' }), 'BLOCKED');
  assert.equal(classify({ startUrl: start, error: 'fetch failed' }), 'BLOCKED');
  assert.equal(classify({ startUrl: start, error: 'Timeout' }), 'BLOCKED');
});
