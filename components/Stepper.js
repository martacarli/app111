import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { clampStep } from '../lib/stepper';

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
  label: { fontSize: 13, color: '#333', marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 22, fontWeight: '700' },
  value: { fontSize: 20, fontWeight: '700' },
});
