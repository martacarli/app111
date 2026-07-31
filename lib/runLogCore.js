// Pure reducers for the run log, kept free of any AsyncStorage/React Native
// import so they can be unit-tested under plain Node.

export function computeActualPace(distanceMeters, durationSeconds) {
  if (!distanceMeters || distanceMeters <= 0) return null;
  const km = distanceMeters / 1000;
  const minutes = durationSeconds / 60;
  return minutes / km;
}

export function applyAddEntry(log, entry) {
  return [entry, ...log];
}

export function applyDeleteEntry(log, id) {
  return log.filter((entry) => entry.id !== id);
}

export function applyClear() {
  return [];
}
