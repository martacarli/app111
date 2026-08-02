import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import DisclaimerScreen from './screens/DisclaimerScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import PlanScreen from './screens/PlanScreen';
import ActiveRunScreen from './screens/ActiveRunScreen';
import RunLogScreen from './screens/RunLogScreen';
import ProfileScreen from './screens/ProfileScreen';
import BottomTabBar from './components/BottomTabBar';
import { isDisclaimerAcknowledged } from './lib/disclaimer';
import { colors } from './lib/theme';

const DEFAULT_HOME_INPUTS = {
  mode: 'duration', // 'distance' | 'duration'
  distanceKm: 3,
  durationMin: 30,
  activity: 'run', // 'run' | 'walk'
};

const TAB_BAR_SCREENS = ['plan', 'log', 'profile'];

export default function App() {
  const [screen, setScreen] = useState('checking');
  const [screenBeforeInfo, setScreenBeforeInfo] = useState('plan');
  const [homeInputs, setHomeInputs] = useState(DEFAULT_HOME_INPUTS);
  const [planState, setPlanState] = useState({ target: null, options: null });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [homeResetToken, setHomeResetToken] = useState(0);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    isDisclaimerAcknowledged().then((acknowledged) => {
      setScreen(acknowledged ? 'plan' : 'disclaimer');
    });
  }, []);

  const handleSelectRoute = (candidate, target) => {
    setSelectedRoute(candidate);
    setSelectedTarget(target);
    setScreen('active');
  };

  const handleRunFinished = () => {
    setSelectedRoute(null);
    setSelectedTarget(null);
    // Clear the previous plan so returning Home shows a fresh target-entry
    // banner instead of the just-completed route's stale cards.
    setPlanState({ target: null, options: null });
    setScreen('log');
  };

  const handleCancelRun = () => {
    setSelectedRoute(null);
    setSelectedTarget(null);
    setScreen('plan');
  };

  const handleViewDisclaimer = () => {
    setScreenBeforeInfo(screen);
    setScreen('disclaimer');
  };

  const handleViewPrivacyPolicy = () => {
    setScreenBeforeInfo(screen);
    setScreen('privacy');
  };

  const handleSelectTab = (tabKey) => {
    if (tabKey === 'plan') {
      // Tapping Home should always land on the duration/distance picker,
      // never resume showing a previously generated route's cards.
      setPlanState({ target: null, options: null });
      setHomeResetToken((n) => n + 1);
    }
    setScreen(tabKey);
  };

  const showTabBar = TAB_BAR_SCREENS.includes(screen);

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {screen === 'checking' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        {screen === 'disclaimer' && (
          <DisclaimerScreen onAcknowledge={() => setScreen(screenBeforeInfo)} />
        )}
        {screen === 'privacy' && (
          <PrivacyPolicyScreen onBack={() => setScreen(screenBeforeInfo)} onGoHome={() => handleSelectTab('plan')} />
        )}
        {screen === 'plan' && (
          <PlanScreen
            key={homeResetToken}
            inputs={homeInputs}
            onChangeInputs={setHomeInputs}
            initialPlan={planState}
            onStateChange={setPlanState}
            onSelectRoute={handleSelectRoute}
          />
        )}
        {screen === 'active' && selectedRoute && selectedTarget && (
          <ActiveRunScreen
            route={selectedRoute}
            activity={selectedTarget.activity}
            paceMinPerKm={selectedTarget.paceMinPerKm}
            startLat={selectedTarget.startLat}
            startLng={selectedTarget.startLng}
            locationLabel={selectedTarget.locationLabel}
            onFinish={handleRunFinished}
            onCancel={handleCancelRun}
          />
        )}
        {screen === 'log' && (
          <RunLogScreen onBack={() => handleSelectTab('plan')} onGoHome={() => handleSelectTab('plan')} />
        )}
        {screen === 'profile' && (
          <ProfileScreen
            onViewDisclaimer={handleViewDisclaimer}
            onViewPrivacyPolicy={handleViewPrivacyPolicy}
            onGoHome={() => handleSelectTab('plan')}
          />
        )}
      </View>
      {showTabBar && <BottomTabBar activeTab={screen} onSelect={handleSelectTab} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
