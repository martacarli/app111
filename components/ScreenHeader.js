import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Logo from './Logo';
import { colors, fonts } from '../lib/theme';

export default function ScreenHeader({ size = 20 }) {
  return (
    <View style={styles.row}>
      <Logo size={size} />
      <Text style={styles.text}>Circl'd</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  text: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
});
