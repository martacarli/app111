import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assignCrimesToGrid,
  scoreGrid,
  buildAvoidPolygons,
  describeSafety,
  groupIntoConnectedComponents,
  CRIME_WEIGHTS,
} from '../safety.js';

function crime(category, latitude, longitude) {
  return { id: `${category}-${latitude}-${longitude}`, category, latitude, longitude, month: '2026-01' };
}

test('assignCrimesToGrid groups nearby points, separates distant ones', () => {
  const crimes = [
    crime('burglary', 51.5074, -0.1278),
    crime('burglary', 51.5075, -0.1277), // ~15m away, same cell at 200m
    crime('burglary', 51.55, -0.05), // several km away, different cell
  ];
  const grid = assignCrimesToGrid(crimes, 200);
  const cellSizes = Object.values(grid).map((cell) => cell.crimes.length);
  assert.equal(Object.keys(grid).length, 2);
  assert.ok(cellSizes.includes(2));
  assert.ok(cellSizes.includes(1));
});

test('scoreGrid sums weights including unknown-category fallback', () => {
  const grid = {
    a: { crimes: [{ category: 'violent-crime' }, { category: 'burglary' }] },
    b: { crimes: [{ category: 'totally-unknown-category' }] },
  };
  const scored = scoreGrid(grid);
  assert.equal(scored.a.score, CRIME_WEIGHTS['violent-crime'] + CRIME_WEIGHTS['burglary']);
  assert.equal(scored.b.score, 1);
});

test('buildAvoidPolygons on empty crimes returns empty MultiPolygon', () => {
  const result = buildAvoidPolygons([]);
  assert.equal(result.type, 'MultiPolygon');
  assert.deepEqual(result.coordinates, []);
  assert.equal(result.meta.hotspotCellCount, 0);
});

test('buildAvoidPolygons flags a dense synthetic cluster above threshold', () => {
  // 3 violent-crimes in the same ~200m cell = score 15, well above threshold 8.
  const crimes = [
    crime('violent-crime', 51.5074, -0.1278),
    crime('violent-crime', 51.5074, -0.1278),
    crime('violent-crime', 51.5074, -0.1278),
  ];
  const result = buildAvoidPolygons(crimes, { threshold: 8 });
  assert.equal(result.meta.hotspotCellCount, 1);
  assert.equal(result.coordinates.length, 1);
  const ring = result.coordinates[0][0];
  assert.equal(ring[0][0], ring[ring.length - 1][0]);
  assert.equal(ring[0][1], ring[ring.length - 1][1]);
});

test('buildAvoidPolygons boundary: exactly at threshold counts as a hotspot', () => {
  // weight 4 * 2 = 8, equal to default threshold -> should be included (>=).
  const crimes = [crime('weapons-possession', 51.5074, -0.1278), crime('weapons-possession', 51.5074, -0.1278)];
  const result = buildAvoidPolygons(crimes, { threshold: 8 });
  assert.equal(result.meta.hotspotCellCount, 1);
});

test('buildAvoidPolygons boundary: just under threshold is excluded', () => {
  const crimes = [crime('weapons-possession', 51.5074, -0.1278)]; // weight 4, threshold 8
  const result = buildAvoidPolygons(crimes, { threshold: 8 });
  assert.equal(result.meta.hotspotCellCount, 0);
});

test('describeSafety: out-of-coverage message takes priority regardless of counts', () => {
  const message = describeSafety(3, 10, { inCoverageArea: false });
  assert.match(message, /outside uk crime-data coverage/i);
});

test('describeSafety: in-coverage with hotspots vs. no hotspots are distinct messages', () => {
  const withHotspots = describeSafety(2, 5, { inCoverageArea: true });
  assert.match(withHotspots, /routed around 2/i);

  const noHotspots = describeSafety(0, 5, { inCoverageArea: true });
  assert.match(noHotspots, /no significant crime hotspots/i);
  assert.doesNotMatch(noHotspots, /outside/i);
});

test('describeSafety: defaults to in-coverage when the option is omitted', () => {
  const message = describeSafety(0, 0);
  assert.match(message, /no significant crime hotspots/i);
});

test('groupIntoConnectedComponents: merges 4-adjacent cells, keeps distant cells separate', () => {
  const cellDefaults = { latCellSize: 0.0018, lngCellSize: 0.0028 };
  const cells = [
    { row: 5, col: 5, ...cellDefaults },
    { row: 6, col: 5, ...cellDefaults }, // adjacent to (5,5) via shared edge
    { row: 5, col: 6, ...cellDefaults }, // adjacent to (5,5) via shared edge
    { row: 50, col: 50, ...cellDefaults }, // far away, its own component
  ];
  const components = groupIntoConnectedComponents(cells);
  assert.equal(components.length, 2);
  const sizes = components.map((c) => c.length).sort();
  assert.deepEqual(sizes, [1, 3]);
});

test('groupIntoConnectedComponents: diagonal-only cells do not merge (4-connectivity, not 8)', () => {
  const cellDefaults = { latCellSize: 0.0018, lngCellSize: 0.0028 };
  const cells = [
    { row: 5, col: 5, ...cellDefaults },
    { row: 6, col: 6, ...cellDefaults }, // diagonal neighbor only
  ];
  const components = groupIntoConnectedComponents(cells);
  assert.equal(components.length, 2);
});

test('buildAvoidPolygons merges two adjacent hotspot cells into one region', () => {
  const baseLat = 51.5074;
  const lng = -0.1278;
  const latCellSize = 200 / 111320;

  // Two rows of a dense cluster, directly adjacent (row and row+1, same col),
  // each scoring well above threshold on its own.
  const crimes = [
    crime('violent-crime', baseLat, lng),
    crime('violent-crime', baseLat, lng),
    crime('violent-crime', baseLat + latCellSize * 1.01, lng),
    crime('violent-crime', baseLat + latCellSize * 1.01, lng),
  ];

  const result = buildAvoidPolygons(crimes, { threshold: 8 });
  assert.equal(result.meta.hotspotCellCount, 2); // two flagged grid cells...
  assert.equal(result.meta.hotspotRegionCount, 1); // ...merged into one region
  assert.equal(result.coordinates.length, 1);
});

test('buildAvoidPolygons keeps two distant hotspots as separate regions', () => {
  const crimes = [
    crime('violent-crime', 51.5074, -0.1278),
    crime('violent-crime', 51.5074, -0.1278),
    crime('violent-crime', 51.5074, -0.1278),
    crime('violent-crime', 51.55, -0.05), // several km away
    crime('violent-crime', 51.55, -0.05),
    crime('violent-crime', 51.55, -0.05),
  ];
  const result = buildAvoidPolygons(crimes, { threshold: 8 });
  assert.equal(result.meta.hotspotRegionCount, 2);
  assert.equal(result.coordinates.length, 2);
});
