import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Polyline, Marker } from 'react-native-maps';

import { fetchCrimeData } from '../lib/policeData';
import { buildAvoidPolygons } from '../lib/safety';
import { reverseGeocode } from '../lib/geocode';
import { distanceFromDuration, DEFAULT_PACE_MIN_PER_KM, estimateDurationSeconds, formatDuration } from '../lib/pace';
import { isLikelyUkPoliceCoverage } from '../lib/ukCoverage';
import { ORS_API_KEY } from '../lib/config';
import { generateRouteOptions } from '../lib/routing';
import { computeRegionForCoordinates } from '../lib/mapRegion';
import Stepper from '../components/Stepper';

const MAX_DISTANCE_OVERAGE_METERS = 1000; // "distance shouldn't be more than 1km greater"
const MAX_DURATION_OVERAGE_MINUTES = 10; // "duration shouldn't be more than 10 min greater"

function toMapCoordinates(candidate) {
  return candidate.geojson.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export default function PlanScreen({ inputs, onChangeInputs, initialPlan, onStateChange, onSelectRoute }) {
  const { mode, distanceKm, durationMin, activity } = inputs;
  const paceMinPerKm = DEFAULT_PACE_MIN_PER_KM[activity];

  const [locating, setLocating] = useState(true);
  const [startLat, setStartLat] = useState(initialPlan?.target?.startLat ?? null);
  const [startLng, setStartLng] = useState(initialPlan?.target?.startLng ?? null);
  const [locationLabel, setLocationLabel] = useState(initialPlan?.target?.locationLabel ?? null);

  const [target, setTarget] = useState(initialPlan?.target ?? null);
  const [options, setOptions] = useState(initialPlan?.options ?? null);
  const [bannerOpen, setBannerOpen] = useState(!initialPlan?.options);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    refreshLocation();
  }, []);

  useEffect(() => {
    onStateChange({ target, options });
  }, [target, options]);

  const refreshLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'This app needs your location to build a route from where you are.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setStartLat(position.coords.latitude);
      setStartLng(position.coords.longitude);

      const { label } = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      setLocationLabel(label);
    } catch (err) {
      console.error(err);
    } finally {
      setLocating(false);
    }
  };

  const targetDistanceMeters = () => {
    if (mode === 'distance') {
      return distanceKm * 1000;
    }
    return distanceFromDuration(durationMin, paceMinPerKm);
  };

  const handleFindRoute = async () => {
    if (startLat === null || startLng === null) {
      Alert.alert('Still finding you', 'Waiting for your GPS location — try again in a moment.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const inCoverageArea = isLikelyUkPoliceCoverage(startLat, startLng);
      const crimes = inCoverageArea ? await fetchCrimeData(startLat, startLng) : [];
      const avoidPolygons = buildAvoidPolygons(crimes);

      const maxOverageMeters =
        mode === 'distance' ? MAX_DISTANCE_OVERAGE_METERS : distanceFromDuration(MAX_DURATION_OVERAGE_MINUTES, paceMinPerKm);

      const nextTarget = {
        startLat,
        startLng,
        locationLabel,
        targetLengthMeters: targetDistanceMeters(),
        activity,
        paceMinPerKm,
        crimes,
        avoidPolygons,
        inCoverageArea,
        maxOverageMeters,
      };

      const result = await generateRouteOptions({
        startLat,
        startLng,
        targetLengthMeters: nextTarget.targetLengthMeters,
        avoidPolygons,
        apiKey: ORS_API_KEY,
        maxOverageMeters,
      });

      if (result.options.length === 0) {
        setError(
          result.rateLimited
            ? 'OpenRouteService is temporarily rate-limiting requests. Wait a moment and try again.'
            : 'Could not generate a route. Check your OpenRouteService API key and connection.'
        );
        return;
      }

      setTarget(nextTarget);
      setOptions(result.options);
      setFocusedIndex(0);
      setBannerOpen(false);
    } catch (err) {
      console.error(err);
      setError('Could not generate a route. Check your OpenRouteService API key and connection.');
    } finally {
      setLoading(false);
    }
  };

  const focused = options?.[focusedIndex];

  // Hide the route while the banner is open (editing the target) — otherwise
  // the previous route stays visible underneath, which reads as if it's
  // still the current plan even though you're about to replace it.
  const showRoute = !bannerOpen && focused;

  const mapRegion = useMemo(() => {
    if (showRoute) {
      return computeRegionForCoordinates(toMapCoordinates(focused));
    }
    if (startLat !== null && startLng !== null) {
      return computeRegionForCoordinates([{ latitude: startLat, longitude: startLng }], { minDelta: 0.02 });
    }
    return null;
  }, [showRoute, focused, startLat, startLng]);

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={mapRegion ?? undefined}>
        {showRoute && <Polyline coordinates={toMapCoordinates(focused)} strokeWidth={4} strokeColor="#1e6fff" />}
        {startLat !== null && startLng !== null && (
          <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Start / Finish" />
        )}
      </MapView>

      {!bannerOpen && (
        <View style={styles.collapsedBanner}>
          <TouchableOpacity style={styles.collapsedBannerRow} onPress={() => setBannerOpen(true)}>
            <Text style={styles.collapsedBannerText}>
              {target ? `${(target.targetLengthMeters / 1000).toFixed(1)} km · ${target.activity === 'walk' ? 'Walk' : 'Run'}` : 'Set your target'}
            </Text>
            <Text style={styles.collapsedBannerEdit}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {bannerOpen && (
        <ScrollView style={styles.banner} contentContainerStyle={styles.bannerContent}>
          <View style={styles.bannerHeaderRow}>
            <Text style={styles.title}>Circl'd</Text>
            {options && (
              <TouchableOpacity onPress={() => setBannerOpen(false)}>
                <Text style={styles.closeBannerText}>Close</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'duration' && styles.tabActive]}
              onPress={() => onChangeInputs({ ...inputs, mode: 'duration' })}
            >
              <Text style={[styles.tabText, mode === 'duration' && styles.tabTextActive]}>Duration</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'distance' && styles.tabActive]}
              onPress={() => onChangeInputs({ ...inputs, mode: 'distance' })}
            >
              <Text style={[styles.tabText, mode === 'distance' && styles.tabTextActive]}>Distance</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.locationLine}>
            {locating ? 'Finding your location…' : locationLabel ? `Starting near ${locationLabel}` : 'Location unavailable'}
          </Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, activity === 'run' && styles.toggleBtnActive]}
              onPress={() => onChangeInputs({ ...inputs, activity: 'run' })}
            >
              <Text style={activity === 'run' ? styles.toggleTextActive : styles.toggleText}>Run</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activity === 'walk' && styles.toggleBtnActive]}
              onPress={() => onChangeInputs({ ...inputs, activity: 'walk' })}
            >
              <Text style={activity === 'walk' ? styles.toggleTextActive : styles.toggleText}>Walk</Text>
            </TouchableOpacity>
          </View>

          {mode === 'distance' ? (
            <Stepper
              label="Distance"
              value={distanceKm}
              step={0.5}
              min={0.5}
              format={(v) => `${v.toFixed(1)} km`}
              onChange={(next) => onChangeInputs({ ...inputs, distanceKm: next })}
            />
          ) : (
            <Stepper
              label="Duration"
              value={durationMin}
              step={5}
              min={5}
              format={(v) => `${v} min`}
              onChange={(next) => onChangeInputs({ ...inputs, durationMin: next })}
            />
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.generateBtn} onPress={handleFindRoute} disabled={loading || locating}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Find my route</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}

      {!bannerOpen && options && (
        <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
          {options.map((option, index) => {
            const km = (option.distanceMeters / 1000).toFixed(2);
            const durationSeconds = estimateDurationSeconds(option.distanceMeters, target.activity, target.paceMinPerKm);

            return (
              <TouchableOpacity
                key={`${option.variantLabel}-${option.seed}`}
                style={[styles.card, focusedIndex === index && styles.cardFocused]}
                onPress={() => setFocusedIndex(index)}
              >
                <Text style={styles.cardLabel}>{option.rankLabel}</Text>
                <Text style={styles.cardStat}>{km} km · about {formatDuration(durationSeconds)}</Text>

                <TouchableOpacity style={styles.selectBtn} onPress={() => onSelectRoute(option, target)}>
                  <Text style={styles.selectBtnText}>Start with this route</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  title: { fontSize: 22, fontWeight: '700' },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: '78%',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  bannerContent: { padding: 20, paddingTop: 16 },
  bannerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  closeBannerText: { color: '#1e6fff', fontWeight: '600' },
  locationLine: { fontSize: 13, color: '#1e6fff', marginBottom: 16, fontWeight: '600' },
  tabRow: { flexDirection: 'row', marginBottom: 16 },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1e6fff' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#888' },
  tabTextActive: { color: '#222' },
  toggleRow: { flexDirection: 'row', marginBottom: 14, gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: '#222' },
  toggleText: { color: '#222', fontWeight: '600' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#c0392b', marginBottom: 12, fontSize: 13 },
  generateBtn: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  collapsedBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  collapsedBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  collapsedBannerText: { fontSize: 15, fontWeight: '700' },
  collapsedBannerEdit: { color: '#1e6fff', fontWeight: '600' },
  cards: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '46%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 4,
  },
  cardsContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardFocused: { borderColor: '#1e6fff' },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardStat: { fontSize: 17, fontWeight: '700', marginTop: 6 },
  selectBtn: {
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  selectBtnText: { color: '#fff', fontWeight: '700' },
});
