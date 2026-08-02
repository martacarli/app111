import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateRetraceRatio,
  estimateSelfProximityRatio,
  scoreCandidate,
  buildDistanceAnchors,
  buildRankLabels,
  changeRouteDirection,
  generateSeedVariants,
  generateRouteOptions,
  selectClosestOptions,
  relabelByProximity,
  isRateLimitError,
  CLEAN_RETRACE_THRESHOLD,
} from '../routing.js';

function rateLimitError() {
  const err = new Error('Request failed with status code 429');
  err.response = { status: 429 };
  return err;
}

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

function buildSquareLoop(sideLengthDeg, pointsPerSide) {
  const coords = [];
  for (let i = 0; i <= pointsPerSide; i++) coords.push([(sideLengthDeg * i) / pointsPerSide, 0]);
  for (let i = 1; i <= pointsPerSide; i++) coords.push([sideLengthDeg, (sideLengthDeg * i) / pointsPerSide]);
  for (let i = 1; i <= pointsPerSide; i++) coords.push([sideLengthDeg - (sideLengthDeg * i) / pointsPerSide, sideLengthDeg]);
  for (let i = 1; i <= pointsPerSide; i++) coords.push([0, sideLengthDeg - (sideLengthDeg * i) / pointsPerSide]);
  return coords;
}

test('estimateSelfProximityRatio: a clean, well-separated loop has a low ratio', () => {
  // ~440m per side — comfortably more than the 25m default proximity
  // threshold, and the loop closure (start === finish) shouldn't inflate it.
  const coordinates = buildSquareLoop(0.004, 10);
  assert.ok(estimateSelfProximityRatio(coordinates) < 0.1);
});

test('estimateSelfProximityRatio: a true out-and-back path scores high', () => {
  const out = [];
  for (let i = 0; i <= 20; i++) out.push([0.0002 * i, 0]);
  const back = [...out].reverse();
  const coordinates = [...out, ...back.slice(1)];
  assert.ok(estimateSelfProximityRatio(coordinates) > 0.6);
});

test('estimateSelfProximityRatio: catches walking back on a parallel street that estimateRetraceRatio misses', () => {
  // Out along one street, a short connector, back along a street ~50m away
  // (a plausible "next street over") — same ground covered, but a
  // different snapped edge, so the exact-edge detector sees it as clean.
  const n = 10;
  const lengthDeg = 0.002; // ~220m
  const parallelOffsetDeg = 0.00045; // ~50m — 2 grid cells in estimateRetraceRatio's 25m snap
  const coordinates = [
    ...Array.from({ length: n + 1 }, (_, i) => [(lengthDeg * i) / n, 0]),
    ...Array.from({ length: n }, (_, i) => [lengthDeg, (parallelOffsetDeg * (i + 1)) / n]),
    ...Array.from({ length: n }, (_, i) => [lengthDeg - (lengthDeg * (i + 1)) / n, parallelOffsetDeg]),
    ...Array.from({ length: n }, (_, i) => [0, parallelOffsetDeg - (parallelOffsetDeg * (i + 1)) / n]),
  ];

  assert.ok(estimateRetraceRatio(coordinates) < 0.15); // old detector: looks clean
  assert.ok(estimateSelfProximityRatio(coordinates, { proximityMeters: 60 }) > 0.5); // new detector: catches it
});

test('scoreCandidate: retraceRatio is the max of the edge-based and proximity-based signals', () => {
  const coordinates = buildSquareLoop(0.004, 10);
  const candidate = { geojson: { coordinates }, distanceMeters: 1600 };
  const { retraceRatio, edgeRetraceRatio, proximityRetraceRatio } = scoreCandidate(candidate, 1600);
  assert.equal(retraceRatio, Math.max(edgeRetraceRatio, proximityRetraceRatio));
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

test('buildDistanceAnchors: evenly spaced around the target, never negative', () => {
  assert.deepEqual(buildDistanceAnchors(5000, 500, 5), [4000, 4500, 5000, 5500, 6000]);
  assert.deepEqual(buildDistanceAnchors(5000, 1000, 3), [4000, 5000, 6000]);
  assert.equal(buildDistanceAnchors(300, 1000, 3)[0], 0); // clamped, never negative
});

test('buildRankLabels: closest first, furthest last, for various counts', () => {
  assert.deepEqual(buildRankLabels(1), ['Closest match']);
  assert.deepEqual(buildRankLabels(2), ['Closest match', 'Furthest option']);
  assert.deepEqual(buildRankLabels(3), ['Closest match', 'Alternative', 'Furthest option']);
  assert.deepEqual(buildRankLabels(5), [
    'Closest match',
    'Alternative 1',
    'Alternative 2',
    'Alternative 3',
    'Furthest option',
  ]);
});

test('generateSeedVariants: stops requesting more seeds once a candidate is a clean, accurate loop', async () => {
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

test('generateSeedVariants: keeps trying seeds when the first candidate retraces (not clean), even with a decent score', async () => {
  let callCount = 0;
  // Distance is a perfect match (accuracy 0) but retrace ratio is ~0.2 —
  // scores 0.2*0.6=0.12, at the old combined cutoff, but not a clean loop.
  const partialRetrace = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.098, 51.500],
    [-0.099, 51.500], // back over the same edge once
    [-0.098, 51.501],
    [-0.097, 51.501],
    [-0.100, 51.500],
  ];

  const httpClient = {
    post: async () => {
      callCount += 1;
      return mockOrsResponse(partialRetrace, 5000);
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

  assert.ok(all[0].retraceRatio > CLEAN_RETRACE_THRESHOLD);
  assert.equal(callCount, 3); // did not stop early despite a decent combined score
  assert.equal(all.length, 3);
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

function candidate(distanceMeters, retraceRatio, variantLabel, seed) {
  return { distanceMeters, retraceRatio, variantLabel, seed, geojson: { coordinates: [] } };
}

test('selectClosestOptions: prefers a clean loop over a closer but retracing candidate', () => {
  // The retracing candidate is much closer to the 5000m target, but a clean
  // loop should still win — avoiding retrace is the primary criterion.
  const pool = [
    candidate(5010, 0.4, 'anchor-2', 1), // very close, but heavily retraces
    candidate(4200, 0.0, 'anchor-0', 1), // clean loop, further from target
    candidate(6300, 0.0, 'anchor-4', 1), // clean loop, further still
  ];
  const options = selectClosestOptions(pool, 5000, Infinity, 2);
  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map((o) => o.distanceMeters),
    [4200, 6300]
  );
});

test('selectClosestOptions: only falls back to a retracing route when no clean candidate exists at all', () => {
  const pool = [candidate(5010, 0.4, 'anchor-2', 1), candidate(4800, 0.5, 'anchor-0', 1)];
  const options = selectClosestOptions(pool, 5000, Infinity, 1);
  assert.equal(options.length, 1);
  assert.equal(options[0].distanceMeters, 5010); // closest of the (only) retracing candidates available
});

test('selectClosestOptions: final display order is always closest-to-target-first, even across tiers', () => {
  // Tier priority decides WHICH candidates are selected (clean beats
  // retracing), but once chosen, display order must be pure proximity —
  // otherwise a farther "clean" pick could show up before a closer
  // "retracing" pick just because tier sorting selected it first.
  const pool = [
    candidate(4000, 0.0, 'clean-but-farther', 1), // clean, deviation 1000
    candidate(5500, 0.4, 'closer-but-retraces', 1), // retraces, deviation 500 — still closer
  ];
  const options = selectClosestOptions(pool, 5000, Infinity, 2);
  assert.deepEqual(
    options.map((o) => o.distanceMeters),
    [5500, 4000] // closest (5500, dev 500) first, farthest (4000, dev 1000) last
  );
  assert.equal(options[0].rankLabel, 'Closest match');
  assert.equal(options[1].rankLabel, 'Furthest option');
});

test('selectClosestOptions: among clean candidates, prefers staying within the overage bound', () => {
  const pool = [
    candidate(5900, 0.0, 'a', 1), // clean, within a 1000m bound
    candidate(4600, 0.0, 'b', 1), // clean, within bound
    candidate(4700, 0.0, 'c', 2), // clean, within bound
    candidate(6800, 0.0, 'd', 1), // clean, but exceeds bound
  ];
  const options = selectClosestOptions(pool, 5000, 1000, 3);
  assert.equal(options.length, 3);
  assert.ok(!options.some((o) => o.distanceMeters === 6800));
  assert.equal(options.every((o) => o.exceedsPreferredBound === false), true);
});

test('selectClosestOptions: within the same tier, ranks by proximity to the true target', () => {
  const pool = [
    candidate(4900, 0.0, 'a', 1),
    candidate(4500, 0.0, 'b', 1),
    candidate(6100, 0.0, 'c', 1),
    candidate(6800, 0.0, 'd', 1),
    candidate(7600, 0.0, 'e', 1),
  ];
  const options = selectClosestOptions(pool, 5000, Infinity, 3);
  assert.equal(options.length, 3);
  assert.deepEqual(
    options.map((o) => o.distanceMeters),
    [4900, 4500, 6100]
  );
  assert.deepEqual(
    options.map((o) => o.rankLabel),
    buildRankLabels(3)
  );
});

test('relabelByProximity: keeps array order, updates labels by current proximity', () => {
  const options = [
    candidate(6800, 0.0, 'longer', 1),
    candidate(4900, 0.0, 'shorter', 1),
    candidate(5100, 0.0, 'planned', 1),
  ];
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

test('changeRouteDirection: uses a pooled candidate without any network call when it is clean and in bound', async () => {
  const throwingHttpClient = {
    post: () => {
      throw new Error('should not be called — pool match should short-circuit');
    },
  };

  const currentOption = {
    variantLabel: 'planned',
    seed: 1,
    requestedLengthMeters: 5000,
    distanceMeters: 5000,
    retraceRatio: 0,
  };
  const pooledMatch = {
    variantLabel: 'planned',
    directionBucket: 'E',
    used: false,
    seed: 2,
    distanceMeters: 5050,
    retraceRatio: 0,
    geojson: { coordinates: [] },
  };
  const candidatePool = [
    { variantLabel: 'planned', directionBucket: 'N', used: false, seed: 3, distanceMeters: 4980, retraceRatio: 0 },
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

test('changeRouteDirection: does not reuse a pooled match that retraces, tries a fresh seed instead', async () => {
  const currentOption = {
    variantLabel: 'planned',
    seed: 1,
    requestedLengthMeters: 5000,
    distanceMeters: 5000,
    retraceRatio: 0,
  };
  // Direction matches, but retraces — should NOT be reused straight from the pool.
  const candidatePool = [
    {
      variantLabel: 'planned',
      directionBucket: 'E',
      used: false,
      seed: 2,
      distanceMeters: 5050,
      retraceRatio: 0.3,
    },
  ];

  let callCount = 0;
  const httpClient = {
    post: async () => {
      callCount += 1;
      return mockOrsResponse(
        [
          [-0.1, 51.5],
          [-0.099, 51.5],
          [-0.098, 51.5],
        ],
        5100
      );
    },
  };

  await changeRouteDirection({
    candidatePool,
    currentOption,
    requestedDirection: 'E',
    startLat: 51.5,
    startLng: -0.1,
    avoidPolygons: null,
    apiKey: 'unused',
    httpClient,
  });

  assert.ok(callCount > 0); // proves the retracing pool candidate was rejected, not reused
});

test('changeRouteDirection: rejects a pooled direction match that exceeds the overage bound', async () => {
  const currentOption = {
    variantLabel: 'planned',
    seed: 1,
    requestedLengthMeters: 5000,
    distanceMeters: 5000,
    retraceRatio: 0,
  };
  const candidatePool = [
    {
      variantLabel: 'planned',
      directionBucket: 'E',
      used: false,
      seed: 2,
      distanceMeters: 6500,
      retraceRatio: 0,
    }, // wrong: exceeds bound
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

test('isRateLimitError: recognizes a 429 response, not other errors', () => {
  assert.equal(isRateLimitError(rateLimitError()), true);
  assert.equal(isRateLimitError(new Error('network blip')), false);
  assert.equal(isRateLimitError({ response: { status: 500 } }), false);
});

test('generateSeedVariants: stops immediately on a 429 instead of throwing, returns whatever it already has', async () => {
  let callCount = 0;
  // Retraces heavily (ratio ~0.5), so it does NOT qualify as "good enough"
  // and the loop keeps going — straight into the simulated 429 below.
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
      if (callCount === 1) return mockOrsResponse(outAndBack, 6000);
      throw rateLimitError();
    },
  };

  const { all, rateLimited, best } = await generateSeedVariants({
    startLat: 51.5,
    startLng: -0.1,
    lengthMeters: 5000,
    avoidPolygons: null,
    apiKey: 'unused',
    seeds: [1, 2, 3, 4, 5],
    httpClient,
  });

  assert.equal(rateLimited, true);
  assert.equal(all.length, 1); // kept the one candidate it got before the 429
  assert.ok(best);
});

test('generateSeedVariants: a 429 on the very first attempt returns empty, not a throw', async () => {
  const httpClient = {
    post: async () => {
      throw rateLimitError();
    },
  };

  const result = await generateSeedVariants({
    startLat: 51.5,
    startLng: -0.1,
    lengthMeters: 5000,
    avoidPolygons: null,
    apiKey: 'unused',
    seeds: [1, 2, 3],
    httpClient,
  });

  assert.equal(result.rateLimited, true);
  assert.deepEqual(result.all, []);
  assert.equal(result.best, null);
});

test('generateRouteOptions: never throws on a 429, returns empty options with rateLimited flagged', async () => {
  const httpClient = {
    post: async () => {
      throw rateLimitError();
    },
  };

  const result = await generateRouteOptions({
    startLat: 51.5,
    startLng: -0.1,
    targetLengthMeters: 5000,
    avoidPolygons: null,
    apiKey: 'unused',
    httpClient,
  });

  assert.equal(result.rateLimited, true);
  assert.deepEqual(result.options, []);
});

test('changeRouteDirection: never throws on a 429 mid-search, falls back gracefully instead', async () => {
  const currentOption = {
    variantLabel: 'planned',
    seed: 1,
    requestedLengthMeters: 5000,
    distanceMeters: 5000,
    retraceRatio: 0,
  };

  const httpClient = {
    post: async () => {
      throw rateLimitError();
    },
  };

  const result = await changeRouteDirection({
    candidatePool: [],
    currentOption,
    requestedDirection: 'E',
    startLat: 51.5,
    startLng: -0.1,
    avoidPolygons: null,
    apiKey: 'unused',
    httpClient,
  });

  // Falls all the way through to "keep the current route" — no exception thrown.
  assert.equal(result.fallback, true);
  assert.equal(result.distanceMeters, currentOption.distanceMeters);
});

test('changeRouteDirection: still returns a different route when no candidate is clean/in-bound/direction-matched', async () => {
  // Regression for a real bug: on an "Alternative" (further-from-target)
  // card, fresh seeds often miss every stricter tier (wrong direction,
  // over the length bound, retracing) — the button should still surface
  // whatever it found instead of silently keeping the same route.
  const currentOption = {
    variantLabel: 'anchor-4',
    seed: 1,
    requestedLengthMeters: 5000,
    distanceMeters: 6800,
    retraceRatio: 0,
  };

  // Heavily retraces (out-and-back) AND lands far outside a tight bound AND
  // bears south (180°) when 'E' was requested — fails every stricter tier.
  const outAndBack = [
    [-0.100, 51.500],
    [-0.099, 51.500],
    [-0.098, 51.500],
    [-0.099, 51.500],
    [-0.100, 51.499], // slightly south of start, so bearing != E
  ];

  const httpClient = {
    post: async () => mockOrsResponse(outAndBack, 8000),
  };

  const result = await changeRouteDirection({
    candidatePool: [],
    currentOption,
    requestedDirection: 'E',
    startLat: 51.5,
    startLng: -0.1,
    avoidPolygons: null,
    apiKey: 'unused',
    targetLengthMeters: 5000,
    maxOverageMeters: 500,
    httpClient,
  });

  assert.equal(result.fallback, true);
  assert.notEqual(result.distanceMeters, currentOption.distanceMeters);
  assert.equal(result.distanceMeters, 8000);
});
