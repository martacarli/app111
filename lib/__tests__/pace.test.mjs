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
  DEFAULT_SPEED_KMH,
  PACE_TIERS,
  getSpeedKmh,
  getPaceMinPerKm,
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

test('DEFAULT_PACE_MIN_PER_KM matches the stated 4.7 km/h walk / 9.5 km/h run defaults', () => {
  assert.equal(DEFAULT_SPEED_KMH.walk, 4.7);
  assert.equal(DEFAULT_SPEED_KMH.run, 9.5);
  assert.ok(Math.abs(DEFAULT_PACE_MIN_PER_KM.walk - 60 / 4.7) < 1e-9);
  assert.ok(Math.abs(DEFAULT_PACE_MIN_PER_KM.run - 60 / 9.5) < 1e-9);
});

test('getSpeedKmh returns the right speed per tier and activity, slow < average < fast', () => {
  assert.equal(getSpeedKmh('slow', 'walk'), PACE_TIERS.slow.walk);
  assert.equal(getSpeedKmh('average', 'walk'), PACE_TIERS.average.walk);
  assert.equal(getSpeedKmh('fast', 'walk'), PACE_TIERS.fast.walk);
  assert.ok(PACE_TIERS.slow.walk < PACE_TIERS.average.walk);
  assert.ok(PACE_TIERS.average.walk < PACE_TIERS.fast.walk);

  assert.equal(getSpeedKmh('slow', 'run'), PACE_TIERS.slow.run);
  assert.equal(getSpeedKmh('average', 'run'), PACE_TIERS.average.run);
  assert.equal(getSpeedKmh('fast', 'run'), PACE_TIERS.fast.run);
  assert.ok(PACE_TIERS.slow.run < PACE_TIERS.average.run);
  assert.ok(PACE_TIERS.average.run < PACE_TIERS.fast.run);
});

test('getSpeedKmh falls back to average for an unknown tier', () => {
  assert.equal(getSpeedKmh('sprint', 'run'), PACE_TIERS.average.run);
});

test('getPaceMinPerKm is the inverse of getSpeedKmh, and a faster tier means a lower (quicker) pace', () => {
  const slowPace = getPaceMinPerKm('slow', 'run');
  const averagePace = getPaceMinPerKm('average', 'run');
  const fastPace = getPaceMinPerKm('fast', 'run');
  assert.ok(Math.abs(averagePace - 60 / PACE_TIERS.average.run) < 1e-9);
  assert.ok(fastPace < averagePace);
  assert.ok(averagePace < slowPace);
});
