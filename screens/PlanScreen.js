import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Polyline, Marker } from 'react-native-maps';

import { fetchCrimeData } from '../lib/policeData';
import { buildAvoidPolygons, describeSafety } from '../lib/safety';
import { reverseGeocode } from '../lib/geocode';
import {
  distanceFromDuration,
  DEFAULT_PACE_MIN_PER_KM,
  DEFAULT_SPEED_KMH,
  estimateDurationSeconds,
  formatDuration,
} from '../lib/pace';
import { isLikelyUkPoliceCoverage } from '../lib/ukCoverage';
import { ORS_API_KEY } from '../lib/config';
import { generateRouteOptions, changeRouteDirection, relabelByProximity } from '../lib/routing';
import { nextDirectionInCycle } from '../lib/directions';
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
  const [candidatePool, setCandidatePool] = useState(initialPlan?.candidatePool ?? []);
  const [bannerOpen, setBannerOpen] = useState(!initialPlan?.options);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [changingIndex, setChangingIndex] = useState(null);
  const [triedSeedsByIndex, setTriedSeedsByIndex] = useState({});

  useEffect(() => {
    refreshLocation();
  }, []);

  useEffect(() => {
    onStateChange({ target, options, candidatePool });
  }, [target, options, candidatePool]);

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
      setCandidatePool(result.candidatePool);
      setFocusedIndex(0);
      setTriedSeedsByIndex({});
      setBannerOpen(false);
    } catch (err) {
      console.error(err);
      setError('Could not generate a route. Check your OpenRouteService API key and connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRoute = async (index) => {
    const current = options[index];
    const requestedDirection = nextDirectionInCycle(current.directionBucket ?? 'N');
    setChangingIndex(index);
    try {
      const triedSeeds = triedSeedsByIndex[index] ?? [];
      const updated = await changeRouteDirection({
        candidatePool,
        currentOption: current,
        requestedDirection,
        startLat: target.startLat,
        startLng: target.startLng,
        avoidPolygons: target.avoidPolygons,
        apiKey: ORS_API_KEY,
        triedSeeds,
        targetLengthMeters: target.targetLengthMeters,
        maxOverageMeters: target.maxOverageMeters,
      });

      const nextOptions = [...options];
      nextOptions[index] = updated;
      setOptions(relabelByProximity(nextOptions, target.targetLengthMeters));
      setCandidatePool((pool) => [...pool, updated]);
      setTriedSeedsByIndex((prev) => ({
        ...prev,
        [index]: [...triedSeeds, updated.seed],
      }));
      setFocusedIndex(index);
    } catch (err) {
      console.error(err);
    } finally {
      setChangingIndex(null);
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
            <Text style={styles.title}>Safe Loop Run</Text>
            {options && (
              <TouchableOpacity onPress={() => setBannerOpen(false)}>
                <Text style={styles.closeBannerText}>Close</Text>
              </TouchableOpacity>
            )}
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

          <Text style={styles.paceLine}>
            Estimated pace: {activity === 'walk' ? DEFAULT_SPEED_KMH.walk : DEFAULT_SPEED_KMH.run} km/h
          </Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'distance' && styles.toggleBtnActive]}
              onPress={() => onChangeInputs({ ...inputs, mode: 'distance' })}
            >
              <Text style={mode === 'distance' ? styles.toggleTextActive : styles.toggleText}>By distance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'duration' && styles.toggleBtnActive]}
              onPress={() => onChangeInputs({ ...inputs, mode: 'duration' })}
            >
              <Text style={mode === 'duration' ? styles.toggleTextActive : styles.toggleText}>By duration</Text>
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

          <Text style={styles.disclaimer}>
            Routes are based on reported crime data, which is historical and does not
            capture every incident or account for time of day. No route can be
            guaranteed safe. Always stay aware of your surroundings.
          </Text>
        </ScrollView>
      )}

      {!bannerOpen && options && (
        <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
          {options.map((option, index) => {
            const km = (option.distanceMeters / 1000).toFixed(2);
            const durationSeconds = estimateDurationSeconds(option.distanceMeters, target.activity, target.paceMinPerKm);
            const hotspotRegionCount = target.avoidPolygons?.meta?.hotspotRegionCount ?? 0;
            const crimeCount = target.crimes?.length ?? 0;

            return (
              <TouchableOpacity
                key={`${option.variantLabel}-${option.seed}`}
                style={[styles.card, focusedIndex === index && styles.cardFocused]}
                onPress={() => setFocusedIndex(index)}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardLabel}>{option.rankLabel}</Text>
                  {option.directionBucket && <Text style={styles.cardDirection}>{option.directionBucket}</Text>}
                </View>
                <Text style={styles.cardStat}>{km} km · about {formatDuration(durationSeconds)}</Text>
                <Text style={styles.cardMeta}>
                  {describeSafety(hotspotRegionCount, crimeCount, { inCoverageArea: target.inCoverageArea })}
                </Text>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => handleChangeRoute(index)}
                    disabled={changingIndex === index}
                  >
                    {changingIndex === index ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text style={styles.changeBtnText}>Change Route</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.selectBtn} onPress={() => onSelectRoute(option, target)}>
                    <Text style={styles.selectBtnText}>Start with this route</Text>
                  </TouchableOpacity>
                </View>
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
  paceLine: { fontSize: 12, color: '#555', marginBottom: 14 },
  toggleRow: { flexDirection: 'row', marginBottom: 14 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222',
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
  disclaimer: { fontSize: 11, color: '#888', marginTop: 20, lineHeight: 16 },
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
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '700' },
  cardDirection: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e6fff',
    borderWidth: 1,
    borderColor: '#1e6fff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cardStat: { fontSize: 17, fontWeight: '700', marginTop: 6 },
  cardMeta: { fontSize: 12, color: '#555', marginTop: 4, lineHeight: 16 },
  cardActions: { flexDirection: 'row', marginTop: 10 },
  changeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  changeBtnText: { fontWeight: '600' },
  selectBtn: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectBtnText: { color: '#fff', fontWeight: '700' },
});
