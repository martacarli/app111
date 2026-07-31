export const DEFAULT_PACE_MIN_PER_KM = { run: 6, walk: 12 };

export function distanceFromDuration(durationMinutes, paceMinPerKm) {
  return (durationMinutes / paceMinPerKm) * 1000;
}

export function durationFromDistance(distanceMeters, paceMinPerKm) {
  const km = distanceMeters / 1000;
  return km * paceMinPerKm * 60;
}

export function estimateDurationSeconds(distanceMeters, activity, customPaceMinPerKm) {
  const pace = customPaceMinPerKm ?? DEFAULT_PACE_MIN_PER_KM[activity] ?? DEFAULT_PACE_MIN_PER_KM.run;
  return durationFromDistance(distanceMeters, pace);
}

export function formatPace(paceMinPerKm) {
  const totalSeconds = Math.round(paceMinPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function formatDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatStopwatch(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
