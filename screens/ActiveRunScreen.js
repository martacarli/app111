import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import {
  buildCumulativeDistances,
  computeProgressFraction,
  sliceRouteUpToProgress,
  projectOntoRoute,
  haversineDistanceMeters,
} from '../lib/progress';
import { formatStopwatch, formatDuration } from '../lib/pace';
import { addRunLogEntry, computeActualPace } from '../lib/runLog';
import { computeRegionForCoordinates } from '../lib/mapRegion';
import { colors, radii, shadow } from '../lib/theme';
import CompletionModal from '../components/CompletionModal';

export default function ActiveRunScreen({ route, activity, paceMinPerKm, startLat, startLng, locationLabel, onFinish, onCancel }) {
  const routeCoordinates = route.geojson.coordinates;
  const cumulativeDistances = useMemo(() => buildCumulativeDistances(routeCoordinates), [routeCoordinates]);
  const totalRouteDistanceMeters = route.distanceMeters;

  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [progressFraction, setProgressFraction] = useState(0);
  const [progressCoordinates, setProgressCoordinates] = useState([]);
  const [traveledMeters, setTraveledMeters] = useState(0);
  const [saving, setSaving] = useState(false);
  const [completedEntry, setCompletedEntry] = useState(null);

  const watchSubscriptionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimestampRef = useRef(null);
  const lastPositionRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTrackingInternals();
    };
  }, []);

  const stopTrackingInternals = () => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStartRun = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    startTimestampRef.current = Date.now();
    lastPositionRef.current = null;
    setElapsedSeconds(0);
    setTraveledMeters(0);
    setProgressFraction(0);
    setProgressCoordinates([]);
    setRunning(true);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((Date.now() - startTimestampRef.current) / 1000);
    }, 1000);

    watchSubscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 5 },
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPosition(point);

        if (lastPositionRef.current) {
          const stepMeters = haversineDistanceMeters(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            point.lat,
            point.lng
          );
          setTraveledMeters((prev) => prev + stepMeters);
        }
        lastPositionRef.current = point;

        const fraction = computeProgressFraction(point, routeCoordinates, totalRouteDistanceMeters, cumulativeDistances);
        setProgressFraction(fraction);

        const projection = projectOntoRoute(point, routeCoordinates, cumulativeDistances);
        if (projection) {
          setProgressCoordinates(
            sliceRouteUpToProgress(
              routeCoordinates,
              projection.nearestSegmentIndex,
              projection.nearestPointLat,
              projection.nearestPointLng
            ).map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
          );
        }
      }
    );
  };

  const handleStopRun = async () => {
    stopTrackingInternals();
    setRunning(false);
    setSaving(true);

    const durationSeconds = elapsedSeconds;
    const distanceMeters = traveledMeters > 0 ? traveledMeters : totalRouteDistanceMeters * progressFraction;
    const actualPace = computeActualPace(distanceMeters, durationSeconds);

    const entry = {
      id: `${Date.now()}`,
      completedAt: new Date().toISOString(),
      distanceMeters,
      durationSeconds,
      paceMinPerKm: actualPace,
      activity,
      startLat,
      startLng,
      locationLabel,
      safetyNote:
        route.directionBucket != null
          ? `Loop headed ${route.directionBucket} from start.`
          : null,
      directionBucket: route.directionBucket ?? null,
    };

    try {
      await addRunLogEntry(entry);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setCompletedEntry(entry);
    }
  };

  const handleDismissCompletion = () => {
    const entry = completedEntry;
    setCompletedEntry(null);
    onFinish(entry);
  };

  const mapCoordinates = routeCoordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  const km = (totalRouteDistanceMeters / 1000).toFixed(2);
  const plannedDurationLabel = formatDuration((totalRouteDistanceMeters / 1000) * paceMinPerKm * 60);
  // Fit the whole planned loop on screen instead of a fixed tight zoom
  // around the start point — otherwise a bigger loop looks like it
  // "disappeared" when this screen mounts.
  const fittedRegion = useMemo(() => computeRegionForCoordinates(mapCoordinates), [mapCoordinates]);

  return (
    <View style={styles.container}>
      {!running && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      )}
      <MapView style={styles.map} initialRegion={fittedRegion ?? undefined}>
        <Polyline coordinates={mapCoordinates} strokeWidth={4} strokeColor={colors.primarySoft} />
        {progressCoordinates.length > 1 && (
          <Polyline coordinates={progressCoordinates} strokeWidth={5} strokeColor={colors.primary} />
        )}
        <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Start / Finish" />
        {currentPosition && (
          <Marker coordinate={{ latitude: currentPosition.lat, longitude: currentPosition.lng }} title="You" pinColor={colors.primary} />
        )}
      </MapView>

      <View style={styles.panel}>
        <Text style={styles.stat}>{km} km · planned {plannedDurationLabel}</Text>

        {running && (
          <>
            <Text style={styles.timer}>{formatStopwatch(elapsedSeconds)}</Text>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${Math.round(progressFraction * 100)}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round(progressFraction * 100)}% of loop covered</Text>
          </>
        )}

        <TouchableOpacity
          style={[styles.actionBtn, running ? styles.stopBtn : styles.startBtn]}
          onPress={running ? handleStopRun : handleStartRun}
          disabled={saving}
        >
          <Text style={styles.actionBtnText}>{running ? 'Stop Run' : 'Start Run'}</Text>
        </TouchableOpacity>
      </View>

      <CompletionModal
        visible={!!completedEntry}
        activity={activity}
        distanceMeters={completedEntry?.distanceMeters ?? 0}
        durationSeconds={completedEntry?.durationSeconds ?? 0}
        onDismiss={handleDismissCompletion}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  cancelBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    ...shadow,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  cancelBtnText: { color: colors.primary, fontWeight: '600' },
  panel: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadow,
    shadowOffset: { width: 0, height: -2 },
  },
  stat: { fontSize: 18, fontWeight: '700', marginBottom: 10, color: colors.text },
  timer: { fontSize: 40, fontWeight: '800', textAlign: 'center', marginBottom: 10, color: colors.text },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: { height: 8, backgroundColor: colors.primary },
  progressLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 16, textAlign: 'center' },
  actionBtn: { borderRadius: radii.md, paddingVertical: 14, alignItems: 'center' },
  startBtn: { backgroundColor: colors.primary },
  stopBtn: { backgroundColor: colors.danger },
  actionBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
