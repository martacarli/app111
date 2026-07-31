import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMonthSequence, normalizeCrimeRecord, dedupeCrimes } from '../policeData.js';

test('buildMonthSequence handles a generic month (skips 2 most recent)', () => {
  const reference = new Date(Date.UTC(2026, 6, 31)); // July 2026 (month index 6)
  const months = buildMonthSequence(reference, 3);
  assert.deepEqual(months, ['2026-05', '2026-04', '2026-03']);
});

test('buildMonthSequence handles year rollover across January', () => {
  const reference = new Date(Date.UTC(2026, 0, 15)); // January 2026
  const months = buildMonthSequence(reference, 3);
  assert.deepEqual(months, ['2025-11', '2025-10', '2025-09']);
});

test('normalizeCrimeRecord maps raw record, tolerating missing id', () => {
  const raw = { category: 'burglary', location: { latitude: '51.5', longitude: '-0.12' }, month: '2026-05' };
  const normalized = normalizeCrimeRecord(raw);
  assert.equal(normalized.id, null);
  assert.equal(normalized.category, 'burglary');
  assert.equal(normalized.latitude, 51.5);
  assert.equal(normalized.longitude, -0.12);
  assert.equal(normalized.month, '2026-05');
});

test('dedupeCrimes removes id-based duplicates, preserves order', () => {
  const crimes = [
    { id: '1', category: 'burglary', latitude: 51.5, longitude: -0.1, month: '2026-05' },
    { id: '2', category: 'robbery', latitude: 51.6, longitude: -0.2, month: '2026-05' },
    { id: '1', category: 'burglary', latitude: 51.5, longitude: -0.1, month: '2026-05' },
  ];
  const result = dedupeCrimes(crimes);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, '1');
  assert.equal(result[1].id, '2');
});

test('dedupeCrimes removes composite-key duplicates for null-id entries', () => {
  const crimes = [
    { id: null, category: 'burglary', latitude: 51.5, longitude: -0.1, month: '2026-05' },
    { id: null, category: 'burglary', latitude: 51.5, longitude: -0.1, month: '2026-05' },
    { id: null, category: 'robbery', latitude: 51.5, longitude: -0.1, month: '2026-05' },
  ];
  const result = dedupeCrimes(crimes);
  assert.equal(result.length, 2);
});
