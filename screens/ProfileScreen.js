import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import { getRunLog, computeRunLogSummary } from '../lib/runLog';
import { formatDuration } from '../lib/pace';

export default function ProfileScreen({ onViewDisclaimer }) {
  const [summary, setSummary] = useState({ totalRuns: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 });

  useEffect(() => {
    getRunLog().then((log) => setSummary(computeRunLogSummary(log)));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{summary.totalRuns}</Text>
          <Text style={styles.statLabel}>Runs logged</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(summary.totalDistanceMeters / 1000).toFixed(1)}</Text>
          <Text style={styles.statLabel}>Total km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatDuration(summary.totalDurationSeconds)}</Text>
          <Text style={styles.statLabel}>Total time</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.linkRow} onPress={onViewDisclaimer}>
        <Text style={styles.linkText}>Review safety disclaimer</Text>
      </TouchableOpacity>

      <Text style={styles.aboutText}>Circl'd · v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#555', marginTop: 4 },
  linkRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  linkText: { color: '#1e6fff', fontWeight: '600', fontSize: 15 },
  aboutText: { fontSize: 12, color: '#888', marginTop: 32 },
});
