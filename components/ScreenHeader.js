import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import Logo from './Logo';
import { colors, fonts } from '../lib/theme';

// Mirrors PlanScreen's banner header row exactly (same Logo size, same
// title size/weight/color) so every screen's top brand mark looks and
// sits identically to the Home screen's.
export default function ScreenHeader({ onPress }) {
  const content = (
    <>
      <Logo size={26} />
      <Text style={styles.title}>Circl'd</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.row}>{content}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.text, letterSpacing: 0.2 },
});
