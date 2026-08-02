import axios from 'axios';

import { tagCandidateWithDirection } from './directions.js';

const ORS_ROUND_TRIP_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

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

export function scoreCandidate(candidate, targetLengthMeters) {
  const retraceRatio = estimateRetraceRatio(candidate.geojson.coordinates);
  const distanceAccuracy =
    targetLengthMeters > 0
      ? Math.abs(candidate.distanceMeters - targetLengthMeters) / targetLengthMeters
      : 0;
  const score = retraceRatio * 0.6 + distanceAccuracy * 0.4;
  return { retraceRatio, distanceAccuracy, score };
}

// Displayed in this order: closest match to the user's actual target first,
// furthest last — not tied to which "shorter/planned/longer" anchor a
// candidate happened to be requested under, since ORS's round_trip mode
// doesn't hit the requested length precisely and the anchor a candidate
// came from is not a reliable proxy for how close it actually landed.
export const RANK_LABELS = ['Closest match', 'Alternative', 'Furthest option'];

// Re-labels options by actual proximity to the target without changing their
// array order/position — used after a single slot is replaced (Change
// Route) so the card the user tapped stays where it is, while every card's
// label still reflects genuine relative proximity.
export function relabelByProximity(options, targetLengthMeters) {
  const withIndex = options.map((option, index) => ({
    index,
    deviation: Math.abs(option.distanceMeters - targetLengthMeters),
  }));
  const sorted = [...withIndex].sort((a, b) => a.deviation - b.deviation);
  const rankByIndex = new Map(sorted.map((entry, rank) => [entry.index, rank]));
  return options.map((option, index) => ({
    ...option,
    rankLabel: RANK_LABELS[rankByIndex.get(index)] ?? null,
  }));
}

// Picks the `count` candidates closest to the true target, preferring ones
// that don't overshoot it by more than maxOverageMeters. Falls back to the
// closest available candidates (flagged) if too few stay within that bound —
// showing an honest "further than we'd like" option beats showing nothing.
export function selectClosestOptions(candidatePool, targetLengthMeters, maxOverageMeters = Infinity, count = 3) {
  const withinBound = candidatePool.filter((c) => c.distanceMeters <= targetLengthMeters + maxOverageMeters);
  const pool = withinBound.length >= count ? withinBound : candidatePool;

  const sorted = [...pool].sort(
    (a, b) => Math.abs(a.distanceMeters - targetLengthMeters) - Math.abs(b.distanceMeters - targetLengthMeters)
  );

  const selected = sorted.slice(0, count).map((c) => ({
    ...c,
    exceedsPreferredBound: c.distanceMeters > targetLengthMeters + maxOverageMeters,
  }));

  return relabelByProximity(selected, targetLengthMeters);
}

export function buildDistanceVariantTargets(targetLengthMeters, spacingMeters = 1000) {
  return {
    shorter: Math.max(0, targetLengthMeters - spacingMeters),
    planned: targetLengthMeters,
    longer: targetLengthMeters + spacingMeters,
  };
}

export function buildDurationVariantTargets(targetDurationSeconds, spacingSeconds = 240) {
  return {
    shorter: Math.max(0, targetDurationSeconds - spacingSeconds),
    planned: targetDurationSeconds,
    longer: targetDurationSeconds + spacingSeconds,
  };
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
  seeds = [1, 2, 3],
  waypoints = 10,
  httpClient = axios,
  goodEnoughScore = GOOD_ENOUGH_SCORE,
}) {
  const all = [];

  for (const seed of seeds) {
    const candidate = await requestRoundTripCandidate({
      startLat,
      startLng,
      lengthMeters,
      seed,
      apiKey,
      avoidPolygons,
      waypoints,
      httpClient,
    });
    const scoring = scoreCandidate(candidate, lengthMeters);
    all.push({ ...candidate, ...scoring });

    if (scoring.score <= goodEnoughScore) break; // early-exit: good enough, stop spending ORS calls
  }

  const best = all.reduce((a, b) => (b.score < a.score ? b : a));
  return { best, all };
}

export async function generateRouteOptions({
  startLat,
  startLng,
  targetLengthMeters,
  avoidPolygons,
  apiKey,
  spacingMeters = 500,
  seeds = [1, 2, 3],
  waypoints = 10,
  httpClient = axios,
  goodEnoughScore = GOOD_ENOUGH_SCORE,
  maxOverageMeters = Infinity,
}) {
  // These 3 anchors just give ORS a spread of lengths to try around the
  // target — the anchor a candidate came from doesn't decide what gets
  // shown; selectClosestOptions below picks the 3 closest to the true
  // target regardless of which anchor produced them.
  const variantTargets = buildDistanceVariantTargets(targetLengthMeters, spacingMeters);
  const candidatePool = [];

  for (const variantLabel of ['shorter', 'planned', 'longer']) {
    const lengthMeters = variantTargets[variantLabel];
    const { all } = await generateSeedVariants({
      startLat,
      startLng,
      lengthMeters,
      avoidPolygons,
      apiKey,
      seeds,
      waypoints,
      httpClient,
      goodEnoughScore,
    });

    const taggedAll = all.map((candidate) => ({
      ...tagCandidateWithDirection(candidate, startLat, startLng),
      variantLabel,
      used: false,
    }));
    candidatePool.push(...taggedAll);
  }

  const options = selectClosestOptions(candidatePool, targetLengthMeters, maxOverageMeters);
  for (const option of options) {
    const poolEntry = candidatePool.find((c) => c.variantLabel === option.variantLabel && c.seed === option.seed);
    if (poolEntry) poolEntry.used = true;
  }

  return { options, candidatePool };
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
}) {
  const withinBound = (c) => c.distanceMeters <= targetLengthMeters + maxOverageMeters;

  const poolMatch = candidatePool.find(
    (c) =>
      c.variantLabel === currentOption.variantLabel &&
      c.directionBucket === requestedDirection &&
      !c.used &&
      c.seed !== currentOption.seed &&
      withinBound(c)
  );
  if (poolMatch) {
    return { ...poolMatch, used: true, fallback: false };
  }

  const alreadyTried = new Set([currentOption.seed, ...triedSeeds]);
  let closestWithinBound = null;
  let closestWithinBoundAngleDiff = Infinity;
  let directionMatchOverBound = null;
  const targetBucketCenter = { N: 0, E: 90, S: 180, W: 270 }[requestedDirection];

  for (let seedCandidate = 1; seedCandidate <= 100; seedCandidate++) {
    if (alreadyTried.has(seedCandidate)) continue;
    if (alreadyTried.size - triedSeeds.length >= 4) break; // cap fresh attempts at 4

    const candidate = await requestRoundTripCandidate({
      startLat,
      startLng,
      lengthMeters: currentOption.requestedLengthMeters,
      seed: seedCandidate,
      apiKey,
      avoidPolygons,
      waypoints,
      httpClient,
    });
    alreadyTried.add(seedCandidate);

    const scoring = scoreCandidate(candidate, currentOption.requestedLengthMeters);
    const tagged = tagCandidateWithDirection({ ...candidate, ...scoring }, startLat, startLng);

    if (tagged.directionBucket === requestedDirection) {
      if (withinBound(tagged)) {
        return { ...tagged, variantLabel: currentOption.variantLabel, used: true, fallback: false };
      }
      if (!directionMatchOverBound) {
        directionMatchOverBound = tagged;
      }
      continue;
    }

    if (withinBound(tagged)) {
      const angleDiff = Math.min(
        Math.abs(tagged.bearingDegrees - targetBucketCenter),
        360 - Math.abs(tagged.bearingDegrees - targetBucketCenter)
      );
      if (angleDiff < closestWithinBoundAngleDiff) {
        closestWithinBoundAngleDiff = angleDiff;
        closestWithinBound = tagged;
      }
    }
  }

  // Prefer keeping the requested direction (that's the point of the button)
  // even if it means exceeding the preferred length range — but say so.
  if (directionMatchOverBound) {
    return {
      ...directionMatchOverBound,
      variantLabel: currentOption.variantLabel,
      used: true,
      fallback: true,
      fallbackReason: `Found a route heading ${requestedDirection}, but it's longer than your preferred range.`,
    };
  }

  if (closestWithinBound) {
    return {
      ...closestWithinBound,
      variantLabel: currentOption.variantLabel,
      used: true,
      fallback: true,
      fallbackReason: `No route found heading ${requestedDirection} from here — showing the closest match instead.`,
    };
  }

  return {
    ...currentOption,
    fallback: true,
    fallbackReason: `Couldn't find an alternate route heading ${requestedDirection} — keeping the current route.`,
  };
}
