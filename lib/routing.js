import axios from 'axios';

import { tagCandidateWithDirection } from './directions.js';
import { haversineDistanceMeters } from './progress.js';

const ORS_ROUND_TRIP_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

export function isRateLimitError(err) {
  return err?.response?.status === 429;
}

export async function requestRoundTripCandidate({
  startLat,
  startLng,
  lengthMeters,
  seed,
  apiKey,
  avoidPolygons,
  waypoints = 10,
  httpClient = axios,
}) {
  const body = {
    coordinates: [[startLng, startLat]],
    options: {
      round_trip: {
        length: lengthMeters,
        points: waypoints,
        seed,
      },
    },
  };

  if (avoidPolygons && avoidPolygons.coordinates && avoidPolygons.coordinates.length > 0) {
    body.options.avoid_polygons = {
      type: avoidPolygons.type,
      coordinates: avoidPolygons.coordinates,
    };
  }

  const response = await httpClient.post(ORS_ROUND_TRIP_URL, body, {
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
  });

  const feature = response.data.features[0];
  return {
    geojson: { coordinates: feature.geometry.coordinates },
    distanceMeters: feature.properties.summary.distance,
    orsDurationSeconds: feature.properties.summary.duration,
    seed,
    requestedLengthMeters: lengthMeters,
  };
}

// Detects out-and-back retracing by snapping coordinates to a coarse grid
// and counting how many times each edge between adjacent snapped points is
// visited. A clean loop visits each edge ~once; retracing visits edges twice.
export function estimateRetraceRatio(coordinates, snapMeters = 25) {
  if (!coordinates || coordinates.length < 2) return 0;

  // ~ meters per degree at typical latitudes, close enough for snapping.
  const snapDegrees = snapMeters / 111000;
  const snap = ([lng, lat]) =>
    `${Math.round(lat / snapDegrees)}:${Math.round(lng / snapDegrees)}`;

  const edgeCounts = new Map();
  let totalEdgeVisits = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = snap(coordinates[i]);
    const b = snap(coordinates[i + 1]);
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    totalEdgeVisits += 1;
  }

  if (totalEdgeVisits === 0) return 0;
  const uniqueEdges = edgeCounts.size;
  return (totalEdgeVisits - uniqueEdges) / totalEdgeVisits;
}

// Catches the retracing estimateRetraceRatio misses: walking out on one
// street and back on a street that just runs alongside it. That's a
// different snapped edge (so the edge-based check sees it as "clean"), but
// it still covers the same ground and reads as retracing your steps. Flags
// a point if some other point far enough away in the route sequence (not
// just an adjacent vertex) lands within proximityMeters of it.
//
// The route is a closed loop, so its first and last points are the same
// location by definition — index distance is measured circularly (wrapping
// around) so that expected start/finish overlap isn't mistaken for a
// parallel-street retrace.
export function estimateSelfProximityRatio(coordinates, { proximityMeters = 25, minIndexGap = 8 } = {}) {
  const n = coordinates?.length ?? 0;
  if (n < minIndexGap * 2) return 0;

  let closeCount = 0;
  for (let i = 0; i < n; i++) {
    const [lngA, latA] = coordinates[i];
    for (let j = 0; j < n; j++) {
      const rawGap = Math.abs(i - j);
      const circularGap = Math.min(rawGap, n - rawGap);
      if (circularGap < minIndexGap) continue;

      const [lngB, latB] = coordinates[j];
      if (haversineDistanceMeters(latA, lngA, latB, lngB) <= proximityMeters) {
        closeCount++;
        break;
      }
    }
  }
  return closeCount / n;
}

export function scoreCandidate(candidate, targetLengthMeters) {
  const edgeRetraceRatio = estimateRetraceRatio(candidate.geojson.coordinates);
  const proximityRetraceRatio = estimateSelfProximityRatio(candidate.geojson.coordinates);
  const retraceRatio = Math.max(edgeRetraceRatio, proximityRetraceRatio);
  const distanceAccuracy =
    targetLengthMeters > 0
      ? Math.abs(candidate.distanceMeters - targetLengthMeters) / targetLengthMeters
      : 0;
  const score = retraceRatio * 0.6 + distanceAccuracy * 0.4;
  return { retraceRatio, edgeRetraceRatio, proximityRetraceRatio, distanceAccuracy, score };
}

// A route scoring at or below this retrace ratio counts as a "clean loop" —
// essentially no backtracking. Avoiding retrace is the primary selection
// criterion; this threshold is what "essentially none" means in practice.
export const CLEAN_RETRACE_THRESHOLD = 0.05;

// Displayed in this order: closest match to the user's actual target first,
// furthest last — not tied to which anchor length a candidate happened to
// be requested under, since ORS's round_trip mode doesn't hit the
// requested length precisely and the anchor a candidate came from is not a
// reliable proxy for how close it actually landed.
export function buildRankLabels(count) {
  if (count <= 0) return [];
  if (count === 1) return ['Closest match'];
  if (count === 2) return ['Closest match', 'Furthest option'];
  const middleCount = count - 2;
  const middle =
    middleCount === 1 ? ['Alternative'] : Array.from({ length: middleCount }, (_, i) => `Alternative ${i + 1}`);
  return ['Closest match', ...middle, 'Furthest option'];
}

// Labels each option by its rank in proximity to the target (closest,
// furthest, etc.) without changing the input array's order — callers that
// want display order to match label order should sort by proximity first.
export function relabelByProximity(options, targetLengthMeters) {
  const labels = buildRankLabels(options.length);
  const withIndex = options.map((option, index) => ({
    index,
    deviation: Math.abs(option.distanceMeters - targetLengthMeters),
  }));
  const sorted = [...withIndex].sort((a, b) => a.deviation - b.deviation);
  const rankByIndex = new Map(sorted.map((entry, rank) => [entry.index, rank]));
  return options.map((option, index) => ({
    ...option,
    rankLabel: labels[rankByIndex.get(index)] ?? null,
  }));
}

// Ranks a candidate into a tier: avoiding retrace comes first (only an
// "extreme exception" falls back to a retracing route, when nothing clean
// is available at all), then staying within the preferred length window,
// then closeness to the true target breaks ties within a tier.
function selectionTier(candidate, targetLengthMeters, maxOverageMeters, cleanRetraceThreshold) {
  const clean = candidate.retraceRatio <= cleanRetraceThreshold;
  const withinBound = Math.abs(candidate.distanceMeters - targetLengthMeters) <= maxOverageMeters;
  if (clean && withinBound) return 0;
  if (clean && !withinBound) return 1;
  if (!clean && withinBound) return 2;
  return 3;
}

// Picks the `count` candidates that avoid retracing first, stay within
// maxOverageMeters of the true target second, and are closest to the true
// target third. Only reaches into a worse tier when there aren't enough
// candidates in a better one — e.g. a retracing route is only ever shown if
// no clean loop was found among everything attempted.
export function selectClosestOptions(
  candidatePool,
  targetLengthMeters,
  maxOverageMeters = Infinity,
  count = 3,
  cleanRetraceThreshold = CLEAN_RETRACE_THRESHOLD
) {
  const sorted = [...candidatePool].sort((a, b) => {
    const tierDiff =
      selectionTier(a, targetLengthMeters, maxOverageMeters, cleanRetraceThreshold) -
      selectionTier(b, targetLengthMeters, maxOverageMeters, cleanRetraceThreshold);
    if (tierDiff !== 0) return tierDiff;
    return Math.abs(a.distanceMeters - targetLengthMeters) - Math.abs(b.distanceMeters - targetLengthMeters);
  });

  const selected = sorted.slice(0, count).map((c) => ({
    ...c,
    exceedsPreferredBound: Math.abs(c.distanceMeters - targetLengthMeters) > maxOverageMeters,
  }));

  // The sort above prioritizes tier (avoiding retrace) over raw proximity,
  // to decide WHICH candidates make the cut — but once chosen, they should
  // always display closest-to-target first, furthest last, regardless of
  // which tier each came from.
  const byProximity = [...selected].sort(
    (a, b) => Math.abs(a.distanceMeters - targetLengthMeters) - Math.abs(b.distanceMeters - targetLengthMeters)
  );

  return relabelByProximity(byProximity, targetLengthMeters);
}

// Evenly-spaced request lengths around the target, used only to give ORS a
// spread of lengths to try — final selection is by actual outcome
// (selectClosestOptions), not by which anchor a candidate came from.
export function buildDistanceAnchors(targetLengthMeters, spacingMeters = 500, anchorCount = 5) {
  const half = Math.floor(anchorCount / 2);
  const anchors = [];
  for (let i = -half; i <= anchorCount - half - 1; i++) {
    anchors.push(Math.max(0, targetLengthMeters + i * spacingMeters));
  }
  return anchors;
}

// A candidate scoring at or below this is already a clean, accurate loop —
// not worth spending another ORS call chasing a marginally better one.
const GOOD_ENOUGH_SCORE = 0.12;

export async function generateSeedVariants({
  startLat,
  startLng,
  lengthMeters,
  avoidPolygons,
  apiKey,
  seeds = [1, 2, 3, 4, 5],
  waypoints = 10,
  httpClient = axios,
  goodEnoughScore = GOOD_ENOUGH_SCORE,
  cleanRetraceThreshold = CLEAN_RETRACE_THRESHOLD,
}) {
  const all = [];
  let rateLimited = false;

  for (const seed of seeds) {
    let candidate;
    try {
      candidate = await requestRoundTripCandidate({
        startLat,
        startLng,
        lengthMeters,
        seed,
        apiKey,
        avoidPolygons,
        waypoints,
        httpClient,
      });
    } catch (err) {
      if (isRateLimitError(err)) {
        rateLimited = true;
        break; // stop immediately — further attempts will fail too, no point burning more calls
      }
      continue; // some other transient failure (network blip, etc.) — try the next seed instead
    }

    const scoring = scoreCandidate(candidate, lengthMeters);
    all.push({ ...candidate, ...scoring });

    // Early-exit only once a candidate is both a clean loop and an accurate
    // length match — a decent score alone isn't enough to stop looking,
    // since a middling retrace ratio could still slip under the old
    // combined-score cutoff without truly avoiding retracing.
    if (scoring.retraceRatio <= cleanRetraceThreshold && scoring.score <= goodEnoughScore) break;
  }

  if (all.length === 0) {
    return { best: null, all: [], rateLimited };
  }

  const best = all.reduce((a, b) => (b.score < a.score ? b : a));
  return { best, all, rateLimited };
}

export async function generateRouteOptions({
  startLat,
  startLng,
  targetLengthMeters,
  avoidPolygons,
  apiKey,
  spacingMeters = 500,
  anchorCount = 5,
  optionCount = 5,
  seeds = [1, 2, 3, 4, 5],
  waypoints = 10,
  httpClient = axios,
  goodEnoughScore = GOOD_ENOUGH_SCORE,
  maxOverageMeters = Infinity,
  cleanRetraceThreshold = CLEAN_RETRACE_THRESHOLD,
}) {
  // These anchors just give ORS a spread of lengths to try around the
  // target — the anchor a candidate came from doesn't decide what gets
  // shown; selectClosestOptions below picks the candidates closest to the
  // true target (favoring clean loops) regardless of which anchor produced
  // them.
  const anchors = buildDistanceAnchors(targetLengthMeters, spacingMeters, anchorCount);
  const candidatePool = [];
  let rateLimited = false;

  for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex++) {
    if (rateLimited) break; // already rate-limited — further anchors would just fail too

    const variantLabel = `anchor-${anchorIndex}`;
    const lengthMeters = anchors[anchorIndex];
    const { all, rateLimited: anchorRateLimited } = await generateSeedVariants({
      startLat,
      startLng,
      lengthMeters,
      avoidPolygons,
      apiKey,
      seeds,
      waypoints,
      httpClient,
      goodEnoughScore,
      cleanRetraceThreshold,
    });
    if (anchorRateLimited) rateLimited = true;

    const taggedAll = all.map((candidate) => ({
      ...tagCandidateWithDirection(candidate, startLat, startLng),
      variantLabel,
      used: false,
    }));
    candidatePool.push(...taggedAll);
  }

  const options = selectClosestOptions(candidatePool, targetLengthMeters, maxOverageMeters, optionCount, cleanRetraceThreshold);
  for (const option of options) {
    const poolEntry = candidatePool.find((c) => c.variantLabel === option.variantLabel && c.seed === option.seed);
    if (poolEntry) poolEntry.used = true;
  }

  return { options, candidatePool, rateLimited };
}

export async function changeRouteDirection({
  candidatePool,
  currentOption,
  requestedDirection,
  startLat,
  startLng,
  avoidPolygons,
  apiKey,
  waypoints = 10,
  httpClient = axios,
  triedSeeds = [],
  targetLengthMeters = currentOption.requestedLengthMeters,
  maxOverageMeters = Infinity,
  cleanRetraceThreshold = CLEAN_RETRACE_THRESHOLD,
}) {
  const isClean = (c) => c.retraceRatio <= cleanRetraceThreshold;
  const withinBound = (c) => Math.abs(c.distanceMeters - targetLengthMeters) <= maxOverageMeters;
  const tierOf = (c) => selectionTier(c, targetLengthMeters, maxOverageMeters, cleanRetraceThreshold);

  // A pool candidate is only reused without a network call if it's already
  // the best case (clean loop, within the preferred length range) — a
  // worse-tier pool candidate isn't worth reusing over trying a fresh seed.
  const poolMatch = candidatePool.find(
    (c) =>
      c.variantLabel === currentOption.variantLabel &&
      c.directionBucket === requestedDirection &&
      !c.used &&
      c.seed !== currentOption.seed &&
      tierOf(c) === 0
  );
  if (poolMatch) {
    return { ...poolMatch, used: true, fallback: false };
  }

  const alreadyTried = new Set([currentOption.seed, ...triedSeeds]);
  let bestDirectionMatch = null;
  let bestWrongDirectionClean = null;
  let bestWrongDirectionCleanAngleDiff = Infinity;
  let bestAny = null; // last-resort: some genuinely different route, any direction/tier
  const targetBucketCenter = { N: 0, E: 90, S: 180, W: 270 }[requestedDirection];

  for (let seedCandidate = 1; seedCandidate <= 100; seedCandidate++) {
    if (alreadyTried.has(seedCandidate)) continue;
    if (alreadyTried.size - triedSeeds.length >= 4) break; // cap fresh attempts at 4

    let candidate;
    try {
      candidate = await requestRoundTripCandidate({
        startLat,
        startLng,
        lengthMeters: currentOption.requestedLengthMeters,
        seed: seedCandidate,
        apiKey,
        avoidPolygons,
        waypoints,
        httpClient,
      });
    } catch (err) {
      alreadyTried.add(seedCandidate);
      if (isRateLimitError(err)) break; // stop immediately, further attempts will fail too
      continue; // some other transient failure — try the next seed instead
    }
    alreadyTried.add(seedCandidate);

    const scoring = scoreCandidate(candidate, currentOption.requestedLengthMeters);
    const tagged = tagCandidateWithDirection({ ...candidate, ...scoring }, startLat, startLng);

    if (!bestAny || tierOf(tagged) < tierOf(bestAny)) {
      bestAny = tagged;
    }

    if (tagged.directionBucket === requestedDirection) {
      if (tierOf(tagged) === 0) {
        return { ...tagged, variantLabel: currentOption.variantLabel, used: true, fallback: false };
      }
      if (!bestDirectionMatch || tierOf(tagged) < tierOf(bestDirectionMatch)) {
        bestDirectionMatch = tagged;
      }
      continue;
    }

    if (isClean(tagged) && withinBound(tagged)) {
      const angleDiff = Math.min(
        Math.abs(tagged.bearingDegrees - targetBucketCenter),
        360 - Math.abs(tagged.bearingDegrees - targetBucketCenter)
      );
      if (angleDiff < bestWrongDirectionCleanAngleDiff) {
        bestWrongDirectionCleanAngleDiff = angleDiff;
        bestWrongDirectionClean = tagged;
      }
    }
  }

  // Prefer keeping the requested direction (that's the point of the button)
  // even at a worse tier — but never prefer a wrong-direction route over a
  // direction match just because the match's tier is imperfect.
  if (bestDirectionMatch) {
    return {
      ...bestDirectionMatch,
      variantLabel: currentOption.variantLabel,
      used: true,
      fallback: true,
      fallbackReason: `Found a route heading ${requestedDirection}, but it's longer than your preferred range.`,
    };
  }

  if (bestWrongDirectionClean) {
    return {
      ...bestWrongDirectionClean,
      variantLabel: currentOption.variantLabel,
      used: true,
      fallback: true,
      fallbackReason: `No route found heading ${requestedDirection} from here — showing the closest match instead.`,
    };
  }

  // Last resort: as long as at least one fresh seed request actually
  // succeeded, show it rather than silently keeping the same route — a
  // route that doesn't hit every preference still beats the button
  // visibly doing nothing.
  if (bestAny) {
    return {
      ...bestAny,
      variantLabel: currentOption.variantLabel,
      used: true,
      fallback: true,
      fallbackReason: `Showing a different route — couldn't find one that fits every preference heading ${requestedDirection}.`,
    };
  }

  return {
    ...currentOption,
    fallback: true,
    fallbackReason: `Couldn't find an alternate route heading ${requestedDirection} — keeping the current route.`,
  };
}
