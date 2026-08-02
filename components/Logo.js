import React from 'react';
import { View } from 'react-native';

import { colors } from '../lib/theme';

export default function Logo({ size = 28 }) {
  const ringWidth = size * 0.18;
  const markerSize = size * 0.24;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: colors.primary,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: -markerSize * 0.15,
          right: -markerSize * 0.15,
          width: markerSize,
          height: markerSize,
          borderRadius: markerSize / 2,
          backgroundColor: colors.celebrationGold,
        }}
      />
    </View>
  );
}
