// Grid-based hotspot model: bucket recent crime reports into coarse cells,
// weight them by severity, and turn the highest-risk cells into rectangular
// avoid-polygons for OpenRouteService. Intentionally simple — cells aren't
// merged across boundaries, so avoid zones can look blocky. Good enough to
// prove the concept; revisit before this is anyone's only safety signal.

export const CRIME_WEIGHTS = {
  'violent-crime': 5,
  robbery: 5,
  'weapons-possession': 4,
  burglary: 3,
  'theft-from-the-person': 3,
  'vehicle-crime': 2,
  'criminal-damage-arson': 2,
  'public-order': 2,
  drugs: 2,
  'other-theft': 2,
  'anti-social-behaviour': 1,
  'bicycle-theft': 1,
  shoplifting: 1,
  'other-crime': 1,
};

const UNKNOWN_CATEGORY_WEIGHT = 1;
const METERS_PER_DEGREE_LAT = 111320;

export function assignCrimesToGrid(crimes, cellSizeMeters = 200) {
  const cells = {};
  if (!crimes || crimes.length === 0) {
    return cells;
  }

  const refLatRad =
    (crimes.reduce((sum, c) => sum + c.latitude, 0) / crimes.length) * (Math.PI / 180);
  const latCellSize = cellSizeMeters / METERS_PER_DEGREE_LAT;
  const lngCellSize = cellSizeMeters / (METERS_PER_DEGREE_LAT * Math.cos(refLatRad));

  for (const crime of crimes) {
    const row = Math.floor(crime.latitude / latCellSize);
    const col = Math.floor(crime.longitude / lngCellSize);
    const key = `${row}:${col}`;
    if (!cells[key]) {
      cells[key] = {
        row,
        col,
        latCellSize,
        lngCellSize,
        crimes: [],
      };
    }
    cells[key].crimes.push(crime);
  }

  return cells;
}

export function scoreGrid(cells, weights = CRIME_WEIGHTS) {
  const scored = {};
  for (const [key, cell] of Object.entries(cells)) {
    const score = cell.crimes.reduce(
      (sum, crime) => sum + (weights[crime.category] ?? UNKNOWN_CATEGORY_WEIGHT),
      0
    );
    scored[key] = { ...cell, score };
  }
  return scored;
}

export function describeSafety(hotspotCellCount, crimeCount) {
  if (hotspotCellCount > 0) {
    return `Routed around ${hotspotCellCount} recently flagged area${hotspotCellCount === 1 ? '' : 's'} (from ${crimeCount} report${crimeCount === 1 ? '' : 's'} nearby).`;
  }
  return `No significant crime hotspots found nearby (${crimeCount} report${crimeCount === 1 ? '' : 's'} considered), or you're outside data coverage.`;
}

function cellToPolygon(cell, paddingMeters) {
  const latPadding = paddingMeters / METERS_PER_DEGREE_LAT;
  const lngPadding = cell.lngCellSize * (paddingMeters / (cell.latCellSize * METERS_PER_DEGREE_LAT));

  const south = cell.row * cell.latCellSize - latPadding;
  const north = (cell.row + 1) * cell.latCellSize + latPadding;
  const west = cell.col * cell.lngCellSize - lngPadding;
  const east = (cell.col + 1) * cell.lngCellSize + lngPadding;

  // GeoJSON ring: [lng, lat] pairs, closed (first === last).
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}

export function buildAvoidPolygons(crimes, { cellSizeMeters = 200, threshold = 8, paddingMeters = 30 } = {}) {
  if (!crimes || crimes.length === 0) {
    return { type: 'MultiPolygon', coordinates: [], meta: { hotspotCellCount: 0 } };
  }

  const grid = assignCrimesToGrid(crimes, cellSizeMeters);
  const scored = scoreGrid(grid);
  const hotspotCells = Object.values(scored).filter((cell) => cell.score >= threshold);

  const coordinates = hotspotCells.map((cell) => [cellToPolygon(cell, paddingMeters)]);

  return {
    type: 'MultiPolygon',
    coordinates,
    meta: { hotspotCellCount: hotspotCells.length },
  };
}
