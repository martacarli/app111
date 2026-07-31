import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  distanceFromDuration,
  durationFromDistance,
  estimateDurationSeconds,
  formatPace,
  formatDuration,
  formatStopwatch,
  DEFAULT_PACE_MIN_PER_KM,
} from '../pace.js';

test('distanceFromDuration/durationFromDistance round-trip consistently', () => {
  const distance = distanceFromDuration(30, 6); // 30 min at 6 min/km -> 5000m
  assert.equal(distance, 5000);
  const duration = durationFromDistance(distance, 6);
  assert.equal(duration, 30 * 60);
});

test('estimateDurationSeconds uses per-activity default when no custom pace given', () => {
  const runSeconds = estimateDurationSeconds(5000, 'run');
  assert.equal(runSeconds, durationFromDistance(5000, DEFAULT_PACE_MIN_PER_KM.run));
  const walkSeconds = estimateDurationSeconds(5000, 'walk');
  assert.equal(walkSeconds, durationFromDistance(5000, DEFAULT_PACE_MIN_PER_KM.walk));
});

test('estimateDurationSeconds honors a custom pace override', () => {
  const seconds = estimateDurationSeconds(5000, 'run', 5);
  assert.equal(seconds, durationFromDistance(5000, 5));
});

test('formatPace known and fractional values', () => {
  assert.equal(formatPace(6), '6:00 /km');
  assert.equal(formatPace(5.5), '5:30 /km');
});

test('formatDuration under and over an hour', () => {
  assert.equal(formatDuration(30 * 60), '30 min');
  assert.equal(formatDuration(65 * 60), '1h 05m');
});

test('formatStopwatch known values and zero', () => {
  assert.equal(formatStopwatch(0), '00:00');
  assert.equal(formatStopwatch(754), '12:34');
});
