// OpenRouteService's round_trip mode has no direction/bearing input — only
// length, points, and seed. So "Change Route" direction cycling works by
// tagging routes we already generated with the compass direction they
// happen to bulge toward, rather than asking ORS for a direction directly.

const DIRECTION_CYCLE = ['N', 'E', 'S', 'W'];

export function computeBearingDegrees(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export function bearingToCompassBucket(bearingDeg) {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  if (normalized >= 315 || normalized < 45) return 'N';
  if (normalized < 135) return 'E';
  if (normalized < 225) return 'S';
  return 'W';
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// coordinates are [lng, lat] pairs (GeoJSON order), matching what ORS returns.
export function computeRouteDominantBearing(startLat, startLng, coordinates, { method = 'farthest' } = {}) {
  if (!coordinates || coordinates.length === 0) {
    return null;
  }

  if (method === 'centroid') {
    const sum = coordinates.reduce(
      (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
      { lat: 0, lng: 0 }
    );
    const centroidLat = sum.lat / coordinates.length;
    const centroidLng = sum.lng / coordinates.length;
    return computeBearingDegrees(startLat, startLng, centroidLat, centroidLng);
  }

  let farthest = null;
  let farthestDistance = -Infinity;
  for (const [lng, lat] of coordinates) {
    const distance = haversineDistanceMeters(startLat, startLng, lat, lng);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthest = { lat, lng };
    }
  }

  if (!farthest) return null;
  return computeBearingDegrees(startLat, startLng, farthest.lat, farthest.lng);
}

export function tagCandidateWithDirection(candidate, startLat, startLng) {
  const bearingDegrees = computeRouteDominantBearing(
    startLat,
    startLng,
    candidate.geojson?.coordinates ?? []
  );
  const directionBucket = bearingDegrees === null ? null : bearingToCompassBucket(bearingDegrees);
  return { ...candidate, bearingDegrees, directionBucket };
}

export function nextDirectionInCycle(currentBucket) {
  const index = DIRECTION_CYCLE.indexOf(currentBucket);
  if (index === -1) return DIRECTION_CYCLE[0];
  return DIRECTION_CYCLE[(index + 1) % DIRECTION_CYCLE.length];
}

export { DIRECTION_CYCLE };
