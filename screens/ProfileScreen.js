import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import { getRunLog, computeRunLogSummary } from '../lib/runLog';
import { formatDuration } from '../lib/pace';
import { colors, radii } from '../lib/theme';

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
          <Text style={styles.statLabel}>Activities logged</Text>
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
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24, color: colors.text },
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  linkRow: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  aboutText: { fontSize: 12, color: colors.textFaint, marginTop: 32 },
});
