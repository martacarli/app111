import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';

import { getRunLog, deleteRunLogEntry } from '../lib/runLog';
import { formatDuration, formatPace } from '../lib/pace';
import { colors, radii, shadow, fonts } from '../lib/theme';
import ScreenHeader from '../components/ScreenHeader';

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RunLogScreen({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    const log = await getRunLog();
    setEntries(log);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    const next = await deleteRunLogEntry(id);
    setEntries(next);
  };

  const renderItem = ({ item }) => {
    const km = (item.distanceMeters / 1000).toFixed(2);
    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>
            {formatDate(item.completedAt)} · {item.activity === 'walk' ? 'Walk' : 'Run'}
          </Text>
          <Text style={styles.rowStat}>
            {km} km · {formatDuration(item.durationSeconds)}
            {item.paceMinPerKm ? ` · ${formatPace(item.paceMinPerKm)}` : ''}
          </Text>
          {item.locationLabel && <Text style={styles.rowMeta}>Near {item.locationLabel}</Text>}
          {item.safetyNote && <Text style={styles.rowMeta}>{item.safetyNote}</Text>}
        </View>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader />
      <Text style={styles.title}>Activity Log</Text>

      {!loading && entries.length === 0 && (
        <Text style={styles.emptyText}>No activities logged yet. Finish a run or walk to see it here.</Text>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: colors.background },
  title: { fontSize: 24, fontFamily: fonts.extraBold, marginBottom: 16, color: colors.text },
  emptyText: { color: colors.textMuted, marginBottom: 16, fontFamily: fonts.regular },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.text },
  rowStat: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontFamily: fonts.regular },
  rowMeta: { fontSize: 12, color: colors.textFaint, marginTop: 2, fontFamily: fonts.regular },
  deleteText: { color: colors.danger, fontFamily: fonts.semiBold },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    ...shadow,
  },
  backBtnText: { color: colors.white, fontFamily: fonts.bold },
});
