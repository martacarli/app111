import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizePaceTier } from './paceTierCore.js';
import { DEFAULT_PACE_TIER } from './pace.js';

export { normalizePaceTier } from './paceTierCore.js';

const STORAGE_KEY = '@safe_loop_run/pace_tier_v1';

export async function getPaceTier() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return normalizePaceTier(raw);
  } catch (err) {
    return DEFAULT_PACE_TIER;
  }
}

export async function savePaceTier(tier) {
  const normalized = normalizePaceTier(tier);
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
  return normalized;
}
