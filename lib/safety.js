// Grid-based hotspot model: bucket recent crime reports into coarse cells,
// weight them by severity, and turn the highest-risk cells into avoid-
// polygons for OpenRouteService. Adjacent hotspot cells are merged into a
// single bounding-box region (see groupIntoConnectedComponents) so a
// cluster doesn't show up as several disjoint rectangles with visible
// seams — still a simplification (axis-aligned box, not a true polygon
// union), good enough to prove the concept; revisit before this is
// anyone's only safety signal.

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

export function describeSafety(hotspotCellCount, crimeCount, { inCoverageArea = true } = {}) {
  if (!inCoverageArea) {
    return "Outside UK crime-data coverage (England, Wales, Northern Ireland) — showing a standard loop with no safety weighting.";
  }
  if (hotspotCellCount > 0) {
    return `Routed around ${hotspotCellCount} recently flagged area${hotspotCellCount === 1 ? '' : 's'} (from ${crimeCount} report${crimeCount === 1 ? '' : 's'} nearby).`;
  }
  return `No significant crime hotspots found nearby (${crimeCount} report${crimeCount === 1 ? '' : 's'} considered).`;
}

// Groups hotspot cells that touch (share an edge, 4-connectivity) into
// connected components via breadth-first search, so a cluster of adjacent
// flagged cells becomes one merged region instead of several disjoint
// rectangles with visible seams between them.
export function groupIntoConnectedComponents(hotspotCells) {
  const byKey = new Map(hotspotCells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
  const visited = new Set();
  const components = [];

  for (const cell of hotspotCells) {
    const startKey = `${cell.row}:${cell.col}`;
    if (visited.has(startKey)) continue;

    const component = [];
    const queue = [cell];
    visited.add(startKey);

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);

      const neighborKeys = [
        `${current.row - 1}:${current.col}`,
        `${current.row + 1}:${current.col}`,
        `${current.row}:${current.col - 1}`,
        `${current.row}:${current.col + 1}`,
      ];
      for (const key of neighborKeys) {
        if (visited.has(key)) continue;
        const neighbor = byKey.get(key);
        if (neighbor) {
          visited.add(key);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components;
}

// Bounding-box rectangle spanning every cell in a connected component. Still
// axis-aligned, so an L-shaped cluster's polygon includes some non-hotspot
// area within its bounding box — a deliberate simplification, not a true
// polygon union, but it removes the internal seams between adjacent cells.
function componentToPolygon(component, paddingMeters) {
  const { latCellSize, lngCellSize } = component[0];
  const rows = component.map((cell) => cell.row);
  const cols = component.map((cell) => cell.col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);

  const latPadding = paddingMeters / METERS_PER_DEGREE_LAT;
  const lngPadding = lngCellSize * (paddingMeters / (latCellSize * METERS_PER_DEGREE_LAT));

  const south = minRow * latCellSize - latPadding;
  const north = (maxRow + 1) * latCellSize + latPadding;
  const west = minCol * lngCellSize - lngPadding;
  const east = (maxCol + 1) * lngCellSize + lngPadding;

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
    return { type: 'MultiPolygon', coordinates: [], meta: { hotspotCellCount: 0, hotspotRegionCount: 0 } };
  }

  const grid = assignCrimesToGrid(crimes, cellSizeMeters);
  const scored = scoreGrid(grid);
  const hotspotCells = Object.values(scored).filter((cell) => cell.score >= threshold);
  const components = groupIntoConnectedComponents(hotspotCells);

  const coordinates = components.map((component) => [componentToPolygon(component, paddingMeters)]);

  return {
    type: 'MultiPolygon',
    coordinates,
    meta: { hotspotCellCount: hotspotCells.length, hotspotRegionCount: components.length },
  };
}
