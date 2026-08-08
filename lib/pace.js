// Fixed speeds per pace tier (no personalization yet — no health-app
// integration or in-app run history to average from). "Average" keeps the
// original defaults; "slow"/"fast" are reasonable brisk-walk/easy-jog and
// fast-walk/fast-run bounds around them, chosen directly rather than
// derived from any user data.
export const PACE_TIERS = {
  slow: { walk: 3.5, run: 7.5 },
  average: { walk: 4.7, run: 9.5 },
  fast: { walk: 6.0, run: 12.0 },
};
export const DEFAULT_PACE_TIER = 'average';
export const PACE_TIER_LABELS = { slow: 'Slow', average: 'Average', fast: 'Fast' };

export function getSpeedKmh(tier, activity) {
  const tierSpeeds = PACE_TIERS[tier] ?? PACE_TIERS[DEFAULT_PACE_TIER];
  return tierSpeeds[activity] ?? tierSpeeds.run;
}

export function getPaceMinPerKm(tier, activity) {
  return 60 / getSpeedKmh(tier, activity);
}

// Kept as the "average" tier for backward compatibility with callers that
// don't care about the pace tier preference.
export const DEFAULT_SPEED_KMH = PACE_TIERS[DEFAULT_PACE_TIER];
export const DEFAULT_PACE_MIN_PER_KM = {
  run: 60 / DEFAULT_SPEED_KMH.run,
  walk: 60 / DEFAULT_SPEED_KMH.walk,
};

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
