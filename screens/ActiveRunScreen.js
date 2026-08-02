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
import { colors, radii, shadow, fonts } from '../lib/theme';
import CompletionModal from '../components/CompletionModal';
import Logo from '../components/Logo';
import RecenterButton from '../components/RecenterButton';

const RECENTER_DELTA = 0.006;

// Generous enough for any realistic gap between GPS fixes (even sprinting
// for a couple of seconds), while still much smaller than typical route
// lengths — small enough to rule out ever snapping across a loop to its
// opposite end.
const PROGRESS_WINDOW_METERS = 250;

export default function ActiveRunScreen({ route, activity, mode, paceMinPerKm, startLat, startLng, locationLabel, onFinish, onCancel }) {
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
  // Tracks how far along the route we last believed we were, so each new
  // GPS fix is matched against a window around that position instead of
  // the whole loop — see lib/progress.js for why an unrestricted search
  // can otherwise snap all the way to the finish while you're still
  // standing at the start.
  const progressAnchorRef = useRef(0);
  const mapRef = useRef(null);

  useEffect(() => {
    // Ask up front (not just on Start) so the native "you are here" dot
    // can show as soon as this screen opens, before you've pressed Start.
    Location.requestForegroundPermissionsAsync();
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
    progressAnchorRef.current = 0;
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

        const anchorOptions = { anchorDistanceMeters: progressAnchorRef.current, windowMeters: PROGRESS_WINDOW_METERS };
        const fraction = computeProgressFraction(
          point,
          routeCoordinates,
          totalRouteDistanceMeters,
          cumulativeDistances,
          anchorOptions
        );
        setProgressFraction(fraction);

        const projection = projectOntoRoute(point, routeCoordinates, cumulativeDistances, anchorOptions);
        if (projection) {
          progressAnchorRef.current = projection.distanceAlongRouteMeters;
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

  const handleRecenter = async () => {
    let lat = currentPosition?.lat;
    let lng = currentPosition?.lng;
    if (lat == null || lng == null) {
      try {
        const position = await Location.getCurrentPositionAsync({});
        lat = position.coords.latitude;
        lng = position.coords.longitude;
      } catch (err) {
        lat = startLat;
        lng = startLng;
      }
    }
    mapRef.current?.animateToRegion(
      { latitude: lat, longitude: lng, latitudeDelta: RECENTER_DELTA, longitudeDelta: RECENTER_DELTA },
      400
    );
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
      <View style={styles.mapArea}>
        {!running && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <View style={styles.brandBadge}>
          <Logo size={16} />
          <Text style={styles.brandBadgeText}>Circl'd</Text>
        </View>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={fittedRegion ?? undefined}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Polyline coordinates={mapCoordinates} strokeWidth={4} strokeColor={colors.routePlanned} />
          {progressCoordinates.length > 1 && (
            <Polyline coordinates={progressCoordinates} strokeWidth={5} strokeColor={colors.primary} />
          )}
          <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Start / Finish" />
        </MapView>
        <RecenterButton style={styles.recenterBtn} onPress={handleRecenter} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.stat}>{km} km · planned {plannedDurationLabel}</Text>

        {running && (
          <>
            {mode === 'distance' ? (
              <Text style={styles.timer}>{(traveledMeters / 1000).toFixed(2)} km</Text>
            ) : (
              <Text style={styles.timer}>{formatStopwatch(elapsedSeconds)}</Text>
            )}
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
          <Text style={styles.actionBtnText}>
            {running ? `Stop ${activity === 'walk' ? 'Walk' : 'Run'}` : `Start ${activity === 'walk' ? 'Walk' : 'Run'}`}
          </Text>
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
  mapArea: { flex: 1 },
  map: { flex: 1 },
  recenterBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 1,
  },
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
  cancelBtnText: { color: colors.primary, fontFamily: fonts.semiBold },
  brandBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    ...shadow,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  brandBadgeText: { fontSize: 12, fontFamily: fonts.bold, color: colors.text },
  panel: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadow,
    shadowOffset: { width: 0, height: -2 },
  },
  stat: { fontSize: 18, fontFamily: fonts.bold, marginBottom: 10, color: colors.text },
  timer: { fontSize: 40, fontFamily: fonts.extraBold, textAlign: 'center', marginBottom: 10, color: colors.text },
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
  actionBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
