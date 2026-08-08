import { PACE_TIERS, DEFAULT_PACE_TIER } from './pace.js';

export function normalizePaceTier(tier) {
  return Object.prototype.hasOwnProperty.call(PACE_TIERS, tier) ? tier : DEFAULT_PACE_TIER;
}
