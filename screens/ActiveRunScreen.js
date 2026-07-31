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

export default function ActiveRunScreen({ route, activity, paceMinPerKm, startLat, startLng, locationLabel, onFinish }) {
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
      onFinish(entry);
    }
  };

  const mapCoordinates = routeCoordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  const km = (totalRouteDistanceMeters / 1000).toFixed(2);
  const plannedDurationLabel = formatDuration((totalRouteDistanceMeters / 1000) * paceMinPerKm * 60);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: startLat,
          longitude: startLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        <Polyline coordinates={mapCoordinates} strokeWidth={4} strokeColor="#c7d4ea" />
        {progressCoordinates.length > 1 && (
          <Polyline coordinates={progressCoordinates} strokeWidth={5} strokeColor="#1e6fff" />
        )}
        <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Start / Finish" />
        {currentPosition && (
          <Marker coordinate={{ latitude: currentPosition.lat, longitude: currentPosition.lng }} title="You" pinColor="#1e6fff" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  stat: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  timer: { fontSize: 40, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#eee',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: { height: 8, backgroundColor: '#1e6fff' },
  progressLabel: { fontSize: 12, color: '#555', marginBottom: 16, textAlign: 'center' },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  startBtn: { backgroundColor: '#222' },
  stopBtn: { backgroundColor: '#c0392b' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
