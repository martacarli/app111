import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeProfileName } from '../profileCore.js';

test('normalizeProfileName trims whitespace', () => {
  assert.equal(normalizeProfileName('  Marta  '), 'Marta');
});

test('normalizeProfileName returns null for empty/whitespace-only input', () => {
  assert.equal(normalizeProfileName(''), null);
  assert.equal(normalizeProfileName('   '), null);
});

test('normalizeProfileName returns null for non-string input', () => {
  assert.equal(normalizeProfileName(null), null);
  assert.equal(normalizeProfileName(undefined), null);
  assert.equal(normalizeProfileName(42), null);
});
