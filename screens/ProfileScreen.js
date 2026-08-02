import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';

import { getRunLog, computeRunLogSummary } from '../lib/runLog';
import { getProfile, saveProfileName } from '../lib/profile';
import { formatDuration } from '../lib/pace';
import { colors, radii, fonts } from '../lib/theme';
import ScreenHeader from '../components/ScreenHeader';

export default function ProfileScreen({ onViewDisclaimer, onViewPrivacyPolicy, onGoHome }) {
  const [summary, setSummary] = useState({ totalRuns: 0, totalDistanceMeters: 0, totalDurationSeconds: 0 });
  const [name, setName] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    getRunLog().then((log) => setSummary(computeRunLogSummary(log)));
    getProfile().then((profile) => setName(profile.name));
  }, []);

  const handleStartEditing = () => {
    setDraftName(name ?? '');
    setEditing(true);
  };

  const handleSaveName = async () => {
    const profile = await saveProfileName(draftName);
    setName(profile.name);
    setEditing(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader onPress={onGoHome} />
      <Text style={styles.title}>Profile</Text>

      {editing ? (
        <View style={styles.nameEditRow}>
          <TextInput
            style={styles.nameInput}
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Your name"
            placeholderTextColor={colors.textFaint}
            autoFocus
            onSubmitEditing={handleSaveName}
          />
          <TouchableOpacity style={styles.saveNameBtn} onPress={handleSaveName}>
            <Text style={styles.saveNameBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.nameRow} onPress={handleStartEditing}>
          <Text style={styles.nameText}>{name ?? 'Add your name'}</Text>
          <Text style={styles.editNameText}>{name ? 'Edit' : 'Add'}</Text>
        </TouchableOpacity>
      )}

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

      <View style={styles.linksGroup}>
        <TouchableOpacity style={styles.linkRow} onPress={onViewDisclaimer}>
          <Text style={styles.linkText}>Review safety disclaimer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onViewPrivacyPolicy}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.aboutText}>Circl'd · v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, backgroundColor: colors.background },
  title: { fontSize: 24, fontFamily: fonts.extraBold, marginBottom: 16, color: colors.text },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  nameText: { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  editNameText: { color: colors.primary, fontFamily: fonts.semiBold, fontSize: 14 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  nameInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 17,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  saveNameBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  saveNameBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 15 },
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  statValue: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontFamily: fonts.medium },
  linksGroup: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  linkRow: {
    paddingVertical: 8,
  },
  linkText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 12 },
  aboutText: { fontSize: 12, color: colors.textFaint, marginTop: 32, fontFamily: fonts.medium },
});
