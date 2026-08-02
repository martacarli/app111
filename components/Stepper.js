import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { clampStep } from '../lib/stepper';
import { colors, fonts } from '../lib/theme';

export default function Stepper({ label, value, step, min, max, format, onChange }) {
  const displayValue = format ? format(value) : String(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(clampStep(value, -step, { min, max }))}
        >
          <Text style={styles.buttonText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{displayValue}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(clampStep(value, step, { min, max }))}
        >
          <Text style={styles.buttonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, color: colors.textMuted, marginBottom: 6, fontFamily: fonts.semiBold },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  buttonText: { fontSize: 22, fontFamily: fonts.bold, color: colors.primary },
  value: { fontSize: 22, fontFamily: fonts.bold, color: colors.text },
});
