import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';

import { colors, radii, shadow } from '../lib/theme';
import { formatDuration } from '../lib/pace';

const BURST_DOTS = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => ({
  angle,
  color: i % 3 === 0 ? colors.celebrationGold : i % 3 === 1 ? colors.primary : colors.primarySoft,
}));
const BURST_RADIUS = 70;

export default function CompletionModal({ visible, activity, distanceMeters, durationSeconds, onDismiss }) {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(12)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    badgeScale.setValue(0);
    ringScale.setValue(0);
    ringOpacity.setValue(0.6);
    burst.setValue(0);
    textTranslateY.setValue(12);
    textOpacity.setValue(0);
    buttonOpacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.stagger(100, [
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(textTranslateY, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.timing(buttonOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible]);

  const activityLabel = activity === 'walk' ? 'Walk' : 'Run';
  const km = (distanceMeters / 1000).toFixed(2);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badgeArea}>
            {BURST_DOTS.map((dot, i) => {
              const radians = (dot.angle * Math.PI) / 180;
              const translateX = burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.cos(radians) * BURST_RADIUS],
              });
              const translateY = burst.interpolate({
                inputRange: [0, 1],
                outputRange: [0, Math.sin(radians) * BURST_RADIUS],
              });
              const dotOpacity = burst.interpolate({
                inputRange: [0, 0.6, 1],
                outputRange: [1, 1, 0],
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.burstDot,
                    { backgroundColor: dot.color, opacity: dotOpacity, transform: [{ translateX }, { translateY }] },
                  ]}
                />
              );
            })}

            <Animated.View
              style={[
                styles.ring,
                { opacity: ringOpacity, transform: [{ scale: ringScale.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] },
              ]}
            />

            <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.badgeCheck}>✓</Text>
            </Animated.View>
          </View>

          <Animated.Text style={[styles.title, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            {activityLabel} completed!
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, { opacity: textOpacity, transform: [{ translateY: textTranslateY }] }]}>
            {km} km · {formatDuration(durationSeconds)}
          </Animated.Text>

          <Animated.View style={{ opacity: buttonOpacity, width: '100%' }}>
            <TouchableOpacity style={styles.doneBtn} onPress={onDismiss}>
              <Text style={styles.doneBtnText}>Nice work</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
    ...shadow,
  },
  badgeArea: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  burstDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ring: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheck: { color: colors.white, fontSize: 40, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textMuted, marginBottom: 20, textAlign: 'center' },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  doneBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
