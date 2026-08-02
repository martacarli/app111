// Computes a MapView region that fits a set of points, instead of a fixed
// zoom level around the start point — a fixed delta looks fine for a small
// loop and cuts off a bigger one, making the route look like it vanished.
export function computeRegionForCoordinates(points, { paddingRatio = 0.25, minDelta = 0.006 } = {}) {
  if (!points || points.length === 0) return null;

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latDelta = Math.max((maxLat - minLat) * (1 + paddingRatio), minDelta);
  const lngDelta = Math.max((maxLng - minLng) * (1 + paddingRatio), minDelta);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
