import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isLikelyUkPoliceCoverage } from '../ukCoverage.js';

test('isLikelyUkPoliceCoverage: London is in coverage', () => {
  assert.equal(isLikelyUkPoliceCoverage(51.5074, -0.1278), true);
});

test('isLikelyUkPoliceCoverage: Belfast (Northern Ireland) is in coverage', () => {
  assert.equal(isLikelyUkPoliceCoverage(54.5973, -5.9301), true);
});

test('isLikelyUkPoliceCoverage: Cardiff (Wales) is in coverage', () => {
  assert.equal(isLikelyUkPoliceCoverage(51.4816, -3.1791), true);
});

test('isLikelyUkPoliceCoverage: Milan is outside coverage', () => {
  assert.equal(isLikelyUkPoliceCoverage(45.4642, 9.19), false);
});

test('isLikelyUkPoliceCoverage: New York is outside coverage', () => {
  assert.equal(isLikelyUkPoliceCoverage(40.7128, -74.006), false);
});
