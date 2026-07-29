import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';

export default function RouteScreen({ data, onBack }) {
  const { route, startLat, startLng, crimeCount, hotspotCellCount } = data;

  const coordinates = route.geojson.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const km = (route.distanceMeters / 1000).toFixed(2);
  const minutes = Math.round(route.durationSeconds / 60);

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
        <Polyline coordinates={coordinates} strokeWidth={4} strokeColor="#1e6fff" />
        <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Start / Finish" />
      </MapView>

      <View style={styles.infoPanel}>
        <Text style={styles.stat}>{km} km · about {minutes} min</Text>
        <Text style={styles.meta}>
          {hotspotCellCount > 0
            ? `Routed around ${hotspotCellCount} recently flagged area${hotspotCellCount === 1 ? '' : 's'} (from ${crimeCount} reports nearby).`
            : `No significant crime hotspots found nearby (${crimeCount} reports considered), or you're outside data coverage.`}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Generate another</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  infoPanel: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  stat: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  meta: { fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 18 },
  backBtn: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
