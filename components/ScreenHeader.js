import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import Logo from './Logo';
import { colors, fonts } from '../lib/theme';

export default function ScreenHeader({ size = 20, onPress }) {
  const content = (
    <>
      <Logo size={size} />
      <Text style={styles.text}>Circl'd</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  text: { fontSize: 13, fontFamily: fonts.bold, color: colors.textMuted },
});
