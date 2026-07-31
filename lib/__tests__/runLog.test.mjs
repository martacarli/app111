import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeActualPace, applyAddEntry, applyDeleteEntry, applyClear } from '../runLogCore.js';

test('computeActualPace known values', () => {
  // 5km in 30 minutes = 6 min/km
  assert.equal(computeActualPace(5000, 30 * 60), 6);
});

test('computeActualPace guards zero distance, returns null not Infinity', () => {
  assert.equal(computeActualPace(0, 600), null);
  assert.equal(computeActualPace(null, 600), null);
});

test('applyAddEntry prepends without mutating original array', () => {
  const log = [{ id: 'a' }];
  const next = applyAddEntry(log, { id: 'b' });
  assert.deepEqual(next, [{ id: 'b' }, { id: 'a' }]);
  assert.equal(log.length, 1); // original untouched
});

test('applyDeleteEntry removes by id without mutating original array', () => {
  const log = [{ id: 'a' }, { id: 'b' }];
  const next = applyDeleteEntry(log, 'a');
  assert.deepEqual(next, [{ id: 'b' }]);
  assert.equal(log.length, 2); // original untouched
});

test('applyClear returns an empty array', () => {
  assert.deepEqual(applyClear(), []);
});
