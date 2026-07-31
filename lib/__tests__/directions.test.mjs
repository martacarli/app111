import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeBearingDegrees,
  bearingToCompassBucket,
  computeRouteDominantBearing,
  nextDirectionInCycle,
} from '../directions.js';

test('computeBearingDegrees: due north/east/south/west', () => {
  assert.ok(computeBearingDegrees(51.5, -0.1, 51.6, -0.1) < 1); // north
  assert.ok(Math.abs(computeBearingDegrees(51.5, -0.1, 51.5, 0.0) - 90) < 1); // east
  assert.ok(Math.abs(computeBearingDegrees(51.5, -0.1, 51.4, -0.1) - 180) < 1); // south
  assert.ok(Math.abs(computeBearingDegrees(51.5, -0.1, 51.5, -0.2) - 270) < 1); // west
});

test('bearingToCompassBucket: boundary cases', () => {
  assert.equal(bearingToCompassBucket(44), 'N');
  assert.equal(bearingToCompassBucket(46), 'E');
  assert.equal(bearingToCompassBucket(134), 'E');
  assert.equal(bearingToCompassBucket(136), 'S');
  assert.equal(bearingToCompassBucket(224), 'S');
  assert.equal(bearingToCompassBucket(226), 'W');
  assert.equal(bearingToCompassBucket(314), 'W');
  assert.equal(bearingToCompassBucket(316), 'N');
  assert.equal(bearingToCompassBucket(359), 'N');
  assert.equal(bearingToCompassBucket(1), 'N');
});

test('computeRouteDominantBearing: loop bulging east tags as E', () => {
  const startLat = 51.5;
  const startLng = -0.1;
  const coordinates = [
    [startLng, startLat],
    [startLng + 0.01, startLat],
    [startLng + 0.02, startLat], // farthest point, due east
    [startLng + 0.01, startLat],
    [startLng, startLat],
  ];
  const bearing = computeRouteDominantBearing(startLat, startLng, coordinates);
  assert.equal(bearingToCompassBucket(bearing), 'E');
});

test('computeRouteDominantBearing: empty coordinates returns null', () => {
  assert.equal(computeRouteDominantBearing(51.5, -0.1, []), null);
});

test('nextDirectionInCycle: full cycle including wraparound', () => {
  assert.equal(nextDirectionInCycle('N'), 'E');
  assert.equal(nextDirectionInCycle('E'), 'S');
  assert.equal(nextDirectionInCycle('S'), 'W');
  assert.equal(nextDirectionInCycle('W'), 'N');
});
