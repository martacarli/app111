import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assignCrimesToGrid, scoreGrid, buildAvoidPolygons, CRIME_WEIGHTS } from '../safety.js';

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
