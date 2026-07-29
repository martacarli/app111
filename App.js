import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';

import { fetchCrimeData } from '../lib/policeData';
import { buildAvoidPolygons } from '../lib/safety';
import { generateSafeLoop } from '../lib/routing';

// Get your own free key at https://openrouteservice.org/dev/#/signup
const ORS_API_KEY = 'YOUR_OPENROUTESERVICE_API_KEY';

export default function HomeScreen({ onRouteGenerated }) {
  const [mode, setMode] = useState('distance'); // 'distance' | 'duration'
  const [distanceKm, setDistanceKm] = useState('5');
  const [durationMin, setDurationMin] = useState('30');
  const [paceMinPerKm, setPaceMinPerKm] = useState('6');
  const [loading, setLoading] = useState(false);

  const targetDistanceMeters = () => {
    if (mode === 'distance') {
      return parseFloat(distanceKm) * 1000;
    }
    const km = parseFloat(durationMin) / parseFloat(paceMinPerKm);
    return km * 1000;
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'This app needs your location to build a route from where you are.');
        setLoading(false);
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const startLat = position.coords.latitude;
      const startLng = position.coords.longitude;

      // Pull recent crime reports near the start point
      const crimes = await fetchCrimeData(startLat, startLng);

      // Turn the highest-risk grid cells into polygons to route around.
      // If there's no coverage here (outside England/Wales/NI), this
      // just comes back empty and we route without the safety layer.
      const avoidPolygons = buildAvoidPolygons(crimes);

      const route = await generateSafeLoop({
        startLat,
        startLng,
        distanceMeters: targetDistanceMeters(),
        avoidPolygons,
        apiKey: ORS_API_KEY,
      });

      onRouteGenerated({
        route,
        startLat,
        startLng,
        crimeCount: crimes.length,
        hotspotCellCount: avoidPolygons.meta?.hotspotCellCount ?? 0,
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
    <View style={styles.container}>
      <Text style={styles.title}>Safe Loop Run</Text>
      <Text style={styles.subtitle}>
        Generates a loop back to your starting point, weighted away from
        recently reported crime hotspots.
      </Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'distance' && styles.toggleBtnActive]}
          onPress={() => setMode('distance')}
        >
          <Text style={mode === 'distance' ? styles.toggleTextActive : styles.toggleText}>
            By distance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'duration' && styles.toggleBtnActive]}
          onPress={() => setMode('duration')}
        >
          <Text style={mode === 'duration' ? styles.toggleTextActive : styles.toggleText}>
            By duration
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'distance' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Distance (km)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={distanceKm}
            onChangeText={setDistanceKm}
          />
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={durationMin}
              onChangeText={setDurationMin}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Your pace (min per km)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={paceMinPerKm}
              onChangeText={setPaceMinPerKm}
            />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>Generate route</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Routes are based on reported crime data, which is historical and does
        not capture every incident or account for time of day. No route can
        be guaranteed safe. Always stay aware of your surroundings.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 70, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 24, lineHeight: 20 },
  toggleRow: { flexDirection: 'row', marginBottom: 20 },
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
  disclaimer: { fontSize: 11, color: '#888', marginTop: 24, lineHeight: 16 },
});
