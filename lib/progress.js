const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

// route coordinates are [lng, lat] pairs (GeoJSON order).
export function buildCumulativeDistances(routeCoordinates) {
  const cumulative = [0];
  for (let i = 1; i < routeCoordinates.length; i++) {
    const [prevLng, prevLat] = routeCoordinates[i - 1];
    const [lng, lat] = routeCoordinates[i];
    const segmentLength = haversineDistanceMeters(prevLat, prevLng, lat, lng);
    cumulative.push(cumulative[i - 1] + segmentLength);
  }
  return cumulative;
}

// Local equirectangular projection using the segment's mean latitude —
// accurate enough for segments a few hundred meters long.
export function projectPointOntoSegment(point, segStart, segEnd) {
  const meanLatRad = ((segStart.lat + segEnd.lat) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(meanLatRad);

  const toXY = (p) => ({ x: p.lng * cosLat, y: p.lat });
  const p = toXY(point);
  const a = toXY(segStart);
  const b = toXY(segEnd);

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;

  let t = lengthSquared === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const nearest = { lat: segStart.lat + t * (segEnd.lat - segStart.lat), lng: segStart.lng + t * (segEnd.lng - segStart.lng) };
  const perpendicularDistanceMeters = haversineDistanceMeters(point.lat, point.lng, nearest.lat, nearest.lng);

  return { nearest, t, perpendicularDistanceMeters };
}

// `anchorDistanceMeters` + `windowMeters` restrict the search to segments
// near where we last knew we were along the route. This matters for round
// trip loops: the outbound and return legs usually approach the shared
// start/finish point from different directions (that's what makes it a
// loop instead of an out-and-back retrace), so a GPS fix with a few
// meters of ordinary noise near the start can end up perpendicular-closer
// to the return leg (near the very end of the route) than to the
// outbound leg — without a continuity constraint that reports "100%
// complete" while you're still standing at the start. Restricting the
// search to a window around the last known position rules out that
// false jump to the opposite end of the loop, while still finding the
// true nearest point within a plausible travel distance.
export function projectOntoRoute(point, routeCoordinates, cumulativeDistances, options = {}) {
  const { anchorDistanceMeters = null, windowMeters = Infinity } = options;

  const inWindow = (segStartDist, segEndDist) => {
    if (anchorDistanceMeters == null || windowMeters === Infinity) return true;
    return segEndDist >= anchorDistanceMeters - windowMeters && segStartDist <= anchorDistanceMeters + windowMeters;
  };

  let best = null;
  let bestUnrestricted = null;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const [lngA, latA] = routeCoordinates[i];
    const [lngB, latB] = routeCoordinates[i + 1];
    const { nearest, t, perpendicularDistanceMeters } = projectPointOntoSegment(
      point,
      { lat: latA, lng: lngA },
      { lat: latB, lng: lngB }
    );

    const segmentLength = cumulativeDistances[i + 1] - cumulativeDistances[i];
    const candidate = {
      nearestSegmentIndex: i,
      nearestPointLat: nearest.lat,
      nearestPointLng: nearest.lng,
      perpendicularDistanceMeters,
      distanceAlongRouteMeters: cumulativeDistances[i] + t * segmentLength,
    };

    if (!bestUnrestricted || perpendicularDistanceMeters < bestUnrestricted.perpendicularDistanceMeters) {
      bestUnrestricted = candidate;
    }
    if (
      inWindow(cumulativeDistances[i], cumulativeDistances[i + 1]) &&
      (!best || perpendicularDistanceMeters < best.perpendicularDistanceMeters)
    ) {
      best = candidate;
    }
  }

  // Fall back to the unrestricted match if nothing fell inside the window
  // (e.g. the very first fix, or a genuinely large GPS gap).
  return best ?? bestUnrestricted;
}

export function computeProgressFraction(point, routeCoordinates, totalRouteDistanceMeters, cumulativeDistances, options = {}) {
  if (!totalRouteDistanceMeters || totalRouteDistanceMeters <= 0) {
    return 0;
  }
  const projection = projectOntoRoute(point, routeCoordinates, cumulativeDistances, options);
  if (!projection) return 0;
  const fraction = projection.distanceAlongRouteMeters / totalRouteDistanceMeters;
  return Math.max(0, Math.min(1, fraction));
}

export function sliceRouteUpToProgress(routeCoordinates, nearestSegmentIndex, nearestPointLat, nearestPointLng) {
  const sliced = routeCoordinates.slice(0, nearestSegmentIndex + 1);
  sliced.push([nearestPointLng, nearestPointLat]);
  return sliced;
}
