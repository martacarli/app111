import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeProfileName } from './profileCore.js';

export { normalizeProfileName } from './profileCore.js';

const STORAGE_KEY = '@safe_loop_run/profile_v1';

export async function getProfile() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { name: null };
    const parsed = JSON.parse(raw);
    return { name: normalizeProfileName(parsed?.name) };
  } catch (err) {
    return { name: null };
  }
}

export async function saveProfileName(name) {
  const profile = { name: normalizeProfileName(name) };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}
