import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';

import { fetchCrimeData } from '../lib/policeData';
import { buildAvoidPolygons } from '../lib/safety';
import { reverseGeocode } from '../lib/geocode';
import { distanceFromDuration, DEFAULT_PACE_MIN_PER_KM } from '../lib/pace';

export default function HomeScreen({ inputs, onChangeInputs, onTargetReady, onViewLog }) {
  const { mode, distanceKm, durationMin, paceMinPerKm, activity } = inputs;

  const [locating, setLocating] = useState(true);
  const [startLat, setStartLat] = useState(null);
  const [startLng, setStartLng] = useState(null);
  const [locationLabel, setLocationLabel] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    refreshLocation();
  }, []);

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

  const setActivity = (nextActivity) => {
    onChangeInputs({
      ...inputs,
      activity: nextActivity,
      paceMinPerKm: String(DEFAULT_PACE_MIN_PER_KM[nextActivity]),
    });
  };

  const targetDistanceMeters = () => {
    if (mode === 'distance') {
      return parseFloat(distanceKm) * 1000;
    }
    return distanceFromDuration(parseFloat(durationMin), parseFloat(paceMinPerKm));
  };

  const handleFindRoute = async () => {
    if (startLat === null || startLng === null) {
      Alert.alert('Still finding you', 'Waiting for your GPS location — try again in a moment.');
      return;
    }

    setLoading(true);
    try {
      const crimes = await fetchCrimeData(startLat, startLng);
      const avoidPolygons = buildAvoidPolygons(crimes);

      onTargetReady({
        startLat,
        startLng,
        locationLabel,
        targetLengthMeters: targetDistanceMeters(),
        activity,
        paceMinPerKm: parseFloat(paceMinPerKm),
        crimes,
        avoidPolygons,
      });
    } catch (err) {
      console.error(err);
      Alert.alert(
        'Could not generate a route',
        'Something went wrong reaching the routing or crime data service. Check your API key and connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Safe Loop Run</Text>
      <Text style={styles.subtitle}>
        Generates a real loop back to your starting point — different streets on
        the way back, weighted away from recently reported crime hotspots.
      </Text>

      <Text style={styles.locationLine}>
        {locating ? 'Finding your location…' : locationLabel ? `Starting near ${locationLabel}` : 'Location unavailable'}
      </Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, activity === 'run' && styles.toggleBtnActive]}
          onPress={() => setActivity('run')}
        >
          <Text style={activity === 'run' ? styles.toggleTextActive : styles.toggleText}>Run</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, activity === 'walk' && styles.toggleBtnActive]}
          onPress={() => setActivity('walk')}
        >
          <Text style={activity === 'walk' ? styles.toggleTextActive : styles.toggleText}>Walk</Text>
        </TouchableOpacity>
      </View>

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
        <View style={styles.field}>
          <Text style={styles.label}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={distanceKm}
            onChangeText={(value) => onChangeInputs({ ...inputs, distanceKm: value })}
          />
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={durationMin}
            onChangeText={(value) => onChangeInputs({ ...inputs, durationMin: value })}
          />
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Your pace (min per km)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={paceMinPerKm}
          onChangeText={(value) => onChangeInputs({ ...inputs, paceMinPerKm: value })}
        />
      </View>

      <TouchableOpacity style={styles.generateBtn} onPress={handleFindRoute} disabled={loading || locating}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateBtnText}>Find my route</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logLink} onPress={onViewLog}>
        <Text style={styles.logLinkText}>View run log</Text>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Routes are based on reported crime data, which is historical and does not
        capture every incident or account for time of day. No route can be
        guaranteed safe. Always stay aware of your surroundings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 70, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 12, lineHeight: 20 },
  locationLine: { fontSize: 13, color: '#1e6fff', marginBottom: 20, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', marginBottom: 16 },
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
  field: { marginBottom: 16 },
  label: { fontSize: 13, color: '#333', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  generateBtn: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logLink: { marginTop: 16, alignItems: 'center' },
  logLinkText: { color: '#1e6fff', fontWeight: '600' },
  disclaimer: { fontSize: 11, color: '#888', marginTop: 24, lineHeight: 16 },
});
