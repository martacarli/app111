import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeActualPace, applyAddEntry, applyDeleteEntry, applyClear, computeRunLogSummary } from '../runLogCore.js';

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

test('computeRunLogSummary aggregates totals across entries', () => {
  const log = [
    { distanceMeters: 5000, durationSeconds: 1800 },
    { distanceMeters: 3000, durationSeconds: 1200 },
  ];
  const summary = computeRunLogSummary(log);
  assert.deepEqual(summary, { totalRuns: 2, totalDistanceMeters: 8000, totalDurationSeconds: 3000 });
});

test('computeRunLogSummary on an empty log returns zeroed totals', () => {
  assert.deepEqual(computeRunLogSummary([]), { totalRuns: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 });
});

test('computeRunLogSummary tolerates entries missing fields', () => {
  const summary = computeRunLogSummary([{ id: 'a' }]);
  assert.deepEqual(summary, { totalRuns: 1, totalDistanceMeters: 0, totalDurationSeconds: 0 });
});
