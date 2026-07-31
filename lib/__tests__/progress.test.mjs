import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  haversineDistanceMeters,
  buildCumulativeDistances,
  projectPointOntoSegment,
  projectOntoRoute,
  computeProgressFraction,
  sliceRouteUpToProgress,
} from '../progress.js';

test('haversineDistanceMeters matches ~111.32km per degree of latitude', () => {
  const distance = haversineDistanceMeters(51.0, 0.0, 52.0, 0.0);
  assert.ok(Math.abs(distance - 111320) < 500);
});

test('projectPointOntoSegment: point on segment, off to the side, beyond endpoint', () => {
  const segStart = { lat: 51.5, lng: -0.1 };
  const segEnd = { lat: 51.5, lng: -0.09 };

  const onSegment = projectPointOntoSegment({ lat: 51.5, lng: -0.095 }, segStart, segEnd);
  assert.ok(onSegment.t > 0.4 && onSegment.t < 0.6);
  assert.ok(onSegment.perpendicularDistanceMeters < 1);

  const offToSide = projectPointOntoSegment({ lat: 51.501, lng: -0.095 }, segStart, segEnd);
  assert.ok(offToSide.perpendicularDistanceMeters > 50);

  const beyondEnd = projectPointOntoSegment({ lat: 51.5, lng: -0.05 }, segStart, segEnd);
  assert.equal(beyondEnd.t, 1); // clamped
});

test('buildCumulativeDistances is monotonic and matches manual sum', () => {
  const coordinates = [
    [-0.1, 51.5],
    [-0.099, 51.5],
    [-0.098, 51.501],
  ];
  const cumulative = buildCumulativeDistances(coordinates);
  assert.equal(cumulative.length, coordinates.length);
  assert.equal(cumulative[0], 0);
  for (let i = 1; i < cumulative.length; i++) {
    assert.ok(cumulative[i] > cumulative[i - 1]);
  }
  const manualTotal =
    haversineDistanceMeters(51.5, -0.1, 51.5, -0.099) +
    haversineDistanceMeters(51.5, -0.099, 51.501, -0.098);
  assert.ok(Math.abs(cumulative[cumulative.length - 1] - manualTotal) < 0.001);
});

test('projectOntoRoute picks the correct nearest segment on a zig-zag route', () => {
  const coordinates = [
    [-0.1, 51.5],
    [-0.099, 51.502], // zig up
    [-0.098, 51.5], // zag down
    [-0.097, 51.502], // zig up again
  ];
  const cumulative = buildCumulativeDistances(coordinates);
  // Point close to the third vertex (index 2).
  const projection = projectOntoRoute({ lat: 51.5001, lng: -0.098 }, coordinates, cumulative);
  assert.ok(projection.nearestSegmentIndex === 1 || projection.nearestSegmentIndex === 2);
});

test('computeProgressFraction near start is ~0, near end is ~1, clamped past the end', () => {
  const coordinates = [
    [-0.1, 51.5],
    [-0.099, 51.5],
    [-0.098, 51.5],
  ];
  const cumulative = buildCumulativeDistances(coordinates);
  const total = cumulative[cumulative.length - 1];

  const nearStart = computeProgressFraction({ lat: 51.5, lng: -0.1 }, coordinates, total, cumulative);
  assert.ok(nearStart < 0.05);

  const nearEnd = computeProgressFraction({ lat: 51.5, lng: -0.098 }, coordinates, total, cumulative);
  assert.ok(nearEnd > 0.95);

  const pastEnd = computeProgressFraction({ lat: 51.5, lng: -0.05 }, coordinates, total, cumulative);
  assert.ok(pastEnd <= 1);
});

test('sliceRouteUpToProgress returns correct length and endpoint', () => {
  const coordinates = [
    [-0.1, 51.5],
    [-0.099, 51.5],
    [-0.098, 51.5],
  ];
  const sliced = sliceRouteUpToProgress(coordinates, 0, 51.5, -0.0995);
  assert.equal(sliced.length, 2);
  assert.deepEqual(sliced[sliced.length - 1], [-0.0995, 51.5]);
});
