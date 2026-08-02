import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clampStep } from '../stepper.js';

test('clampStep: adds the delta within bounds', () => {
  assert.equal(clampStep(30, 5, { min: 5 }), 35);
  assert.equal(clampStep(30, -5, { min: 5 }), 25);
});

test('clampStep: clamps at the minimum', () => {
  assert.equal(clampStep(5, -5, { min: 5 }), 5);
  assert.equal(clampStep(3, -1000, { min: 0 }), 0);
});

test('clampStep: clamps at the maximum', () => {
  assert.equal(clampStep(295, 10, { max: 300 }), 300);
});

test('clampStep: avoids floating point drift with fractional steps', () => {
  assert.equal(clampStep(3, 0.5, { min: 0.5 }), 3.5);
  assert.equal(clampStep(0.5, 0.1, { min: 0 }), 0.6);
});
