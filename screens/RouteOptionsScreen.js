import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';

import { ORS_API_KEY } from '../lib/config';
import { generateRouteOptions, changeRouteDirection } from '../lib/routing';
import { nextDirectionInCycle } from '../lib/directions';
import { estimateDurationSeconds, formatDuration } from '../lib/pace';
import { describeSafety } from '../lib/safety';

const VARIANT_LABELS = { shorter: 'Shorter', planned: 'Your target', longer: 'Longer' };

function toMapCoordinates(candidate) {
  return candidate.geojson.coordinates.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export default function RouteOptionsScreen({ target, cachedOptions, cachedPool, onOptionsReady, onSelectRoute, onBack }) {
  const [loading, setLoading] = useState(!cachedOptions);
  const [error, setError] = useState(null);
  const [options, setOptions] = useState(cachedOptions ?? []);
  const [candidatePool, setCandidatePool] = useState(cachedPool ?? []);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [changingVariant, setChangingVariant] = useState(null);
  const [triedSeedsByVariant, setTriedSeedsByVariant] = useState({});

  useEffect(() => {
    if (!cachedOptions) {
      loadOptions();
    }
  }, []);

  const loadOptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateRouteOptions({
        startLat: target.startLat,
        startLng: target.startLng,
        targetLengthMeters: target.targetLengthMeters,
        avoidPolygons: target.avoidPolygons,
        apiKey: ORS_API_KEY,
      });
      setOptions(result.options);
      setCandidatePool(result.candidatePool);
      onOptionsReady(result.options, result.candidatePool);
    } catch (err) {
      console.error(err);
      setError('Could not generate routes. Check your OpenRouteService API key and connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRoute = async (index) => {
    const current = options[index];
    const requestedDirection = nextDirectionInCycle(current.directionBucket ?? 'N');
    setChangingVariant(current.variantLabel);
    try {
      const triedSeeds = triedSeedsByVariant[current.variantLabel] ?? [];
      const updated = await changeRouteDirection({
        candidatePool,
        currentOption: current,
        requestedDirection,
        startLat: target.startLat,
        startLng: target.startLng,
        avoidPolygons: target.avoidPolygons,
        apiKey: ORS_API_KEY,
        triedSeeds,
      });

      const nextOptions = [...options];
      nextOptions[index] = updated;
      setOptions(nextOptions);
      setCandidatePool((pool) => [...pool, updated]);
      setTriedSeedsByVariant((prev) => ({
        ...prev,
        [current.variantLabel]: [...triedSeeds, updated.seed],
      }));
      setFocusedIndex(index);
    } catch (err) {
      console.error(err);
    } finally {
      setChangingVariant(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Finding three route options…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Try a Different Length</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const focused = options[focusedIndex];

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={{
          latitude: target.startLat,
          longitude: target.startLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {focused && <Polyline coordinates={toMapCoordinates(focused)} strokeWidth={4} strokeColor="#1e6fff" />}
        <Marker coordinate={{ latitude: target.startLat, longitude: target.startLng }} title="Start / Finish" />
      </MapView>

      <ScrollView style={styles.cards} contentContainerStyle={styles.cardsContent}>
        {options.map((option, index) => {
          const km = (option.distanceMeters / 1000).toFixed(2);
          const durationSeconds = estimateDurationSeconds(option.distanceMeters, target.activity, target.paceMinPerKm);
          const hotspotRegionCount = target.avoidPolygons?.meta?.hotspotRegionCount ?? 0;
          const crimeCount = target.crimes?.length ?? 0;

          return (
            <TouchableOpacity
              key={option.variantLabel}
              style={[styles.card, focusedIndex === index && styles.cardFocused]}
              onPress={() => setFocusedIndex(index)}
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardLabel}>{VARIANT_LABELS[option.variantLabel]}</Text>
                {option.directionBucket && <Text style={styles.cardDirection}>{option.directionBucket}</Text>}
              </View>
              <Text style={styles.cardStat}>{km} km · about {formatDuration(durationSeconds)}</Text>
              <Text style={styles.cardMeta}>
                {describeSafety(hotspotRegionCount, crimeCount, { inCoverageArea: target.inCoverageArea })}
              </Text>
              {option.fallback && <Text style={styles.cardFallback}>{option.fallbackReason}</Text>}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => handleChangeRoute(index)}
                  disabled={changingVariant === option.variantLabel}
                >
                  {changingVariant === option.variantLabel ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Text style={styles.changeBtnText}>Change Route</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectBtn} onPress={() => onSelectRoute(option)}>
                  <Text style={styles.selectBtnText}>Start with this route</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Try a Different Length</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#555' },
  errorText: { color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  cards: { maxHeight: '48%', borderTopWidth: 1, borderTopColor: '#eee' },
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
  cardFallback: { fontSize: 11, color: '#c0392b', marginTop: 4 },
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
  backBtn: { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { color: '#1e6fff', fontWeight: '600' },
});
