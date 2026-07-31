import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyAddEntry, applyDeleteEntry } from './runLogCore.js';

export { computeActualPace, applyAddEntry, applyDeleteEntry, applyClear } from './runLogCore.js';

const STORAGE_KEY = '@safe_loop_run/run_log_v1';

export async function getRunLog() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

async function saveRunLog(log) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export async function addRunLogEntry(entry) {
  const log = await getRunLog();
  const next = applyAddEntry(log, entry);
  await saveRunLog(next);
  return next;
}

export async function deleteRunLogEntry(id) {
  const log = await getRunLog();
  const next = applyDeleteEntry(log, id);
  await saveRunLog(next);
  return next;
}

export async function clearRunLog() {
  await AsyncStorage.removeItem(STORAGE_KEY);
  return [];
}
