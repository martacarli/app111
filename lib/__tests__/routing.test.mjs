import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateRetraceRatio,
  scoreCandidate,
  buildDistanceVariantTargets,
  buildDurationVariantTargets,
  changeRouteDirection,
  generateSeedVariants,
  selectClosestOptions,
  relabelByProximity,
  RANK_LABELS,
} from '../routing.js';

function mockOrsResponse(coordinates, distanceMeters) {
  return {
    data: {
      features: [
        {
          geometry: { coordinates },
          properties: { summary: { distance: distanceMeters, duration: distanceMeters / 1.4 } },
        },
      ],
    },
  };
}

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

  const currentOption = { variantLabel: 'planned', seed: 1, requestedLengthMeters: 5000, distanceMeters: 5000 };
  const pooledMatch = {
    variantLabel: 'planned',
    directionBucket: 'E',
    used: false,
    seed: 2,
    distanceMeters: 5050,
    geojson: { coordinates: [] },
  };
  const candidatePool = [
    { variantLabel: 'planned', directionBucket: 'N', used: false, seed: 3, distanceMeters: 4980 },
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

test('generateSeedVariants: stops requesting more seeds once a candidate is good enough', async () => {
  let callCount = 0;
  const cleanLoopAtTarget = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.099, 51.501],
    [-0.100, 51.501],
    [-0.100, 51.500],
  ];

  const httpClient = {
    post: async () => {
      callCount += 1;
      if (callCount > 1) {
        throw new Error('should not be called again — first candidate was already good enough');
      }
      return mockOrsResponse(cleanLoopAtTarget, 5000); // matches target exactly, clean loop -> low score
    },
  };

  const { all } = await generateSeedVariants({
    startLat: 51.5,
    startLng: -0.1,
    lengthMeters: 5000,
    avoidPolygons: null,
    apiKey: 'unused',
    seeds: [1, 2, 3],
    httpClient,
  });

  assert.equal(callCount, 1);
  assert.equal(all.length, 1);
});

test('generateSeedVariants: keeps trying seeds when the first candidate is not good enough', async () => {
  let callCount = 0;
  // An out-and-back path scores ~0.5, comfortably above the good-enough cutoff.
  const outAndBack = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.098, 51.500],
    [-0.099, 51.500],
    [-0.100, 51.500],
  ];

  const httpClient = {
    post: async () => {
      callCount += 1;
      return mockOrsResponse(outAndBack, 5000);
    },
  };

  const { all } = await generateSeedVariants({
    startLat: 51.5,
    startLng: -0.1,
    lengthMeters: 5000,
    avoidPolygons: null,
    apiKey: 'unused',
    seeds: [1, 2, 3],
    httpClient,
  });

  assert.equal(callCount, 3);
  assert.equal(all.length, 3);
});

function candidate(distanceMeters, variantLabel, seed) {
  return { distanceMeters, variantLabel, seed, geojson: { coordinates: [] } };
}

test('selectClosestOptions: picks the 3 closest to the true target, not by requested anchor', () => {
  // Regression case matching the reported bug: a 5000m target where the
  // "planned" anchor's own best candidate actually landed far off, while a
  // "shorter"-anchor candidate happened to land closer to the true target.
  const pool = [
    candidate(4900, 'shorter', 1),
    candidate(4500, 'shorter', 2),
    candidate(6100, 'planned', 1), // requested exactly 5000, but landed at 6100
    candidate(6800, 'longer', 1),
    candidate(7600, 'longer', 2),
  ];
  const options = selectClosestOptions(pool, 5000, Infinity);
  assert.equal(options.length, 3);
  assert.deepEqual(
    options.map((o) => o.distanceMeters),
    [4900, 4500, 6100]
  );
  assert.deepEqual(
    options.map((o) => o.rankLabel),
    RANK_LABELS
  );
});

test('selectClosestOptions: prefers candidates within the overage bound', () => {
  const pool = [
    candidate(5900, 'planned', 1), // within a 1000m bound
    candidate(4200, 'shorter', 1), // within bound, further from target than 5900 but still eligible
    candidate(4600, 'shorter', 2),
    candidate(7000, 'longer', 1), // exceeds bound, should be excluded while enough in-bound options exist
  ];
  const options = selectClosestOptions(pool, 5000, 1000);
  assert.equal(options.length, 3);
  assert.ok(!options.some((o) => o.distanceMeters === 7000));
  assert.equal(options.every((o) => o.exceedsPreferredBound === false), true);
});

test('selectClosestOptions: falls back to the closest overall when too few are within bound', () => {
  const pool = [candidate(6800, 'planned', 1), candidate(7200, 'longer', 1)];
  const options = selectClosestOptions(pool, 5000, 500, 2);
  assert.equal(options.length, 2);
  assert.equal(options[0].distanceMeters, 6800);
  assert.equal(options[0].exceedsPreferredBound, true);
});

test('relabelByProximity: keeps array order, updates labels by current proximity', () => {
  const options = [candidate(6800, 'longer', 1), candidate(4900, 'shorter', 1), candidate(5100, 'planned', 1)];
  const relabeled = relabelByProximity(options, 5000);
  // order unchanged...
  assert.deepEqual(
    relabeled.map((o) => o.distanceMeters),
    [6800, 4900, 5100]
  );
  // ...but labels reflect actual proximity: index 1 (4900) is closest, index 2 (5100) next, index 0 (6800) furthest.
  assert.equal(relabeled[1].rankLabel, 'Closest match');
  assert.equal(relabeled[2].rankLabel, 'Alternative');
  assert.equal(relabeled[0].rankLabel, 'Furthest option');
});

test('changeRouteDirection: rejects a pooled direction match that exceeds the overage bound', async () => {
  const throwingHttpClient = {
    post: () => {
      throw new Error('should not be called in this test');
    },
  };

  const currentOption = { variantLabel: 'planned', seed: 1, requestedLengthMeters: 5000, distanceMeters: 5000 };
  const candidatePool = [
    { variantLabel: 'planned', directionBucket: 'E', used: false, seed: 2, distanceMeters: 6500 }, // wrong: exceeds bound
  ];

  // Fresh-seed path will be exercised since the pool candidate is rejected;
  // stub returns a within-bound, direction-matching candidate on first try.
  let callCount = 0;
  const httpClient = {
    post: async () => {
      callCount += 1;
      return mockOrsResponse(
        [
          [-0.1, 51.5],
          [-0.1, 51.51], // due north-ish bearing from start, but we only check bucket via tagCandidateWithDirection
        ],
        5100
      );
    },
  };

  const result = await changeRouteDirection({
    candidatePool,
    currentOption,
    requestedDirection: 'E',
    startLat: 51.5,
    startLng: -0.1,
    avoidPolygons: null,
    apiKey: 'unused',
    targetLengthMeters: 5000,
    maxOverageMeters: 1000,
    httpClient,
  });

  assert.equal(callCount > 0, true); // proves the over-bound pool candidate was rejected, not reused
  assert.ok(result.distanceMeters <= 6000);
});
