import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePaceTier } from '../paceTierCore.js';

test('normalizePaceTier accepts known tiers', () => {
  assert.equal(normalizePaceTier('slow'), 'slow');
  assert.equal(normalizePaceTier('average'), 'average');
  assert.equal(normalizePaceTier('fast'), 'fast');
});

test('normalizePaceTier falls back to average for unknown/missing values', () => {
  assert.equal(normalizePaceTier('sprint'), 'average');
  assert.equal(normalizePaceTier(null), 'average');
  assert.equal(normalizePaceTier(undefined), 'average');
  assert.equal(normalizePaceTier(''), 'average');
});
