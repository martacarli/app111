// Rough bounding-box approximation of where data.police.uk has coverage
// (England, Wales, Northern Ireland — Scotland is policed separately and
// isn't covered by this app). This is intentionally simple: it's a couple
// of axis-aligned boxes, not the real coastline/border, so points close to
// a border may be misclassified either way. Good enough to separate "no
// crime data here" from "no hotspots found," which is the actual UX gap
// this fixes.
const ENGLAND_WALES_BOUNDS = { minLat: 49.8, maxLat: 55.8, minLng: -6.5, maxLng: 2.0 };
const NORTHERN_IRELAND_BOUNDS = { minLat: 54.0, maxLat: 55.5, minLng: -8.2, maxLng: -5.3 };

function withinBounds(lat, lng, bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng;
}

export function isLikelyUkPoliceCoverage(lat, lng) {
  return withinBounds(lat, lng, ENGLAND_WALES_BOUNDS) || withinBounds(lat, lng, NORTHERN_IRELAND_BOUNDS);
}
