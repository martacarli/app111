import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { colors } from '../lib/theme';

const TABS = [
  { key: 'plan', label: 'Home' },
  { key: 'log', label: 'Log' },
  { key: 'profile', label: 'Profile' },
];

export default function BottomTabBar({ activeTab, onSelect }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onSelect(tab.key)}>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { fontSize: 13, fontWeight: '600', color: colors.textFaint },
  labelActive: { color: colors.primary },
});
