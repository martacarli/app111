import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeRegionForCoordinates } from '../mapRegion.js';

test('computeRegionForCoordinates: empty input returns null', () => {
  assert.equal(computeRegionForCoordinates([]), null);
  assert.equal(computeRegionForCoordinates(null), null);
});

test('computeRegionForCoordinates: single point falls back to minDelta', () => {
  const region = computeRegionForCoordinates([{ latitude: 51.5, longitude: -0.1 }]);
  assert.equal(region.latitude, 51.5);
  assert.equal(region.longitude, -0.1);
  assert.equal(region.latitudeDelta, 0.006);
  assert.equal(region.longitudeDelta, 0.006);
});

test('computeRegionForCoordinates: fits a spread of points with padding', () => {
  const points = [
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 51.51, longitude: -0.09 },
  ];
  const region = computeRegionForCoordinates(points);
  assert.ok(Math.abs(region.latitude - 51.505) < 1e-9);
  assert.ok(Math.abs(region.longitude - (-0.095)) < 1e-9);
  // spread is 0.01, padded by 25% -> 0.0125
  assert.ok(Math.abs(region.latitudeDelta - 0.0125) < 1e-9);
  assert.ok(Math.abs(region.longitudeDelta - 0.0125) < 1e-9);
});

test('computeRegionForCoordinates: custom padding and minDelta are respected', () => {
  const points = [
    { latitude: 51.5, longitude: -0.1 },
    { latitude: 51.5001, longitude: -0.1 }, // tiny spread, should hit minDelta floor
  ];
  const region = computeRegionForCoordinates(points, { paddingRatio: 0.5, minDelta: 0.02 });
  assert.equal(region.latitudeDelta, 0.02);
  assert.equal(region.longitudeDelta, 0.02);
});
