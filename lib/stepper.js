// Rounds to avoid floating-point drift (e.g. 0.1 + 0.2 !== 0.3) when
// stepping by fractional amounts like 0.5km.
function round(n) {
  return Math.round(n * 1000) / 1000;
}

export function clampStep(value, delta, { min = -Infinity, max = Infinity } = {}) {
  return Math.min(max, Math.max(min, round(value + delta)));
}
