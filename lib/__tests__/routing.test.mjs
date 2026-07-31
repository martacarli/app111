import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateRetraceRatio,
  scoreCandidate,
  buildDistanceVariantTargets,
  buildDurationVariantTargets,
  changeRouteDirection,
} from '../routing.js';

test('estimateRetraceRatio: clean loop has a low ratio', () => {
  // A simple square loop, no edge revisited.
  const coordinates = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.099, 51.501],
    [-0.100, 51.501],
    [-0.100, 51.500],
  ];
  const ratio = estimateRetraceRatio(coordinates);
  assert.ok(ratio < 0.2);
});

test('estimateRetraceRatio: out-and-back path scores near 0.5, well above a clean loop', () => {
  // Walk out along a line, then back along the exact same line. Every edge
  // gets visited exactly twice, so the ratio converges to 0.5 — it can't
  // exceed that for a pure retrace, since a "unique edge" is still counted once.
  const out = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.098, 51.500],
    [-0.097, 51.500],
  ];
  const back = [...out].reverse();
  const coordinates = [...out, ...back.slice(1)];
  const ratio = estimateRetraceRatio(coordinates);
  assert.ok(ratio >= 0.45 && ratio <= 0.5);

  const cleanLoop = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.099, 51.501],
    [-0.100, 51.501],
    [-0.100, 51.500],
  ];
  assert.ok(ratio > estimateRetraceRatio(cleanLoop));
});

test('scoreCandidate combines retrace ratio and distance accuracy', () => {
  const candidate = {
    geojson: {
      coordinates: [
        [-0.1, 51.5],
        [-0.099, 51.5],
        [-0.098, 51.5],
      ],
    },
    distanceMeters: 5500,
  };
  const target = 5000;
  const { retraceRatio, distanceAccuracy, score } = scoreCandidate(candidate, target);
  assert.equal(distanceAccuracy, 0.1);
  assert.equal(score, retraceRatio * 0.6 + 0.1 * 0.4);
});

test('buildDistanceVariantTargets: default and custom spacing', () => {
  assert.deepEqual(buildDistanceVariantTargets(5000), { shorter: 4000, planned: 5000, longer: 6000 });
  assert.deepEqual(buildDistanceVariantTargets(5000, 500), { shorter: 4500, planned: 5000, longer: 5500 });
  // never goes negative
  assert.equal(buildDistanceVariantTargets(300, 1000).shorter, 0);
});

test('buildDurationVariantTargets: default and custom spacing', () => {
  const target = 30 * 60;
  assert.deepEqual(buildDurationVariantTargets(target), {
    shorter: target - 240,
    planned: target,
    longer: target + 240,
  });
  assert.deepEqual(buildDurationVariantTargets(target, 60), {
    shorter: target - 60,
    planned: target,
    longer: target + 60,
  });
});

test('changeRouteDirection: uses a pooled candidate without any network call', async () => {
  const throwingHttpClient = {
    post: () => {
      throw new Error('should not be called — pool match should short-circuit');
    },
  };

  const currentOption = { variantLabel: 'planned', seed: 1, requestedLengthMeters: 5000 };
  const pooledMatch = {
    variantLabel: 'planned',
    directionBucket: 'E',
    used: false,
    seed: 2,
    geojson: { coordinates: [] },
  };
  const candidatePool = [
    { variantLabel: 'planned', directionBucket: 'N', used: false, seed: 3 },
    pooledMatch,
  ];

  const result = await changeRouteDirection({
    candidatePool,
    currentOption,
    requestedDirection: 'E',
    startLat: 51.5,
    startLng: -0.1,
    avoidPolygons: null,
    apiKey: 'unused',
    httpClient: throwingHttpClient,
  });

  assert.equal(result.used, true);
  assert.equal(result.fallback, false);
  assert.equal(result.directionBucket, 'E');
});
