import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatLocationLabel } from '../geocode.js';

test('formatLocationLabel prefers suburb over everything else', () => {
  const label = formatLocationLabel({
    suburb: 'Shoreditch',
    city: 'London',
    country: 'United Kingdom',
  });
  assert.equal(label, 'Shoreditch');
});

test('formatLocationLabel falls through priority order when suburb missing', () => {
  assert.equal(formatLocationLabel({ neighbourhood: 'SoHo', city: 'New York' }), 'SoHo');
  assert.equal(formatLocationLabel({ city_district: 'Manhattan', city: 'New York' }), 'Manhattan');
  assert.equal(formatLocationLabel({ city: 'London' }), 'London');
  assert.equal(formatLocationLabel({ town: 'Reading' }), 'Reading');
  assert.equal(formatLocationLabel({ village: 'Grantchester' }), 'Grantchester');
  assert.equal(formatLocationLabel({ country: 'France' }), 'France');
});

test('formatLocationLabel returns null when everything is missing', () => {
  assert.equal(formatLocationLabel({}), null);
  assert.equal(formatLocationLabel(null), null);
});
