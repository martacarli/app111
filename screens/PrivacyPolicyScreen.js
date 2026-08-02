import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

import { colors, radii, shadow, fonts } from '../lib/theme';
import ScreenHeader from '../components/ScreenHeader';

export default function PrivacyPolicyScreen({ onBack, onGoHome }) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader onPress={onGoHome} />
        <Text style={styles.title}>Privacy Policy</Text>

        <Text style={styles.heading}>What Circl'd collects</Text>
        <Text style={styles.paragraph}>
          Your device's GPS location, used only to build a route from where
          you are and to track your progress during a run or walk. The
          display name you optionally add on the Profile screen. The
          activities you complete (distance, duration, pace, and location
          label).
        </Text>

        <Text style={styles.heading}>Where it's stored</Text>
        <Text style={styles.paragraph}>
          All of it stays on your device, in local app storage. Circl'd has
          no backend server and no user accounts, so nothing you enter is
          ever transmitted to or stored by the developer. Deleting the app
          deletes this data.
        </Text>

        <Text style={styles.heading}>Third parties involved in generating a route</Text>
        <Text style={styles.paragraph}>
          Building a route sends only raw coordinates (never your name or
          any other identifying information) to: OpenRouteService, to
          calculate the loop itself; OpenStreetMap/Nominatim, to turn your
          coordinates into a readable address; and, where you're in
          England, Wales, or Northern Ireland, data.police.uk, to fetch
          recent public crime reports near you. None of these services
          receive your name, device identifiers, or activity history.
        </Text>

        <Text style={styles.heading}>What Circl'd does not do</Text>
        <Text style={styles.paragraph}>
          No analytics, no advertising, no tracking across other apps or
          websites, no selling or sharing of your data, no account sign-up.
        </Text>

        <Text style={styles.heading}>Your choices</Text>
        <Text style={styles.paragraph}>
          You can delete individual activities from the Activity Log, clear
          your profile name at any time, or remove all data at once by
          uninstalling the app.
        </Text>

        <Text style={styles.heading}>Contact</Text>
        <Text style={styles.paragraph}>
          Questions about this policy can be sent to marta.carli@massimocarli.it.
        </Text>
      </ScrollView>

      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backBtnText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 16, paddingBottom: 16 },
  title: { fontSize: 24, fontFamily: fonts.extraBold, marginBottom: 16, color: colors.text },
  heading: { fontSize: 15, fontFamily: fonts.bold, marginTop: 16, marginBottom: 4, color: colors.text },
  paragraph: { fontSize: 14, fontFamily: fonts.regular, color: colors.textMuted, lineHeight: 20 },
  backBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 32,
    ...shadow,
  },
  backBtnText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
