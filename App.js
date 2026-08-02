import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';

import DisclaimerScreen from './screens/DisclaimerScreen';
import PlanScreen from './screens/PlanScreen';
import ActiveRunScreen from './screens/ActiveRunScreen';
import RunLogScreen from './screens/RunLogScreen';
import ProfileScreen from './screens/ProfileScreen';
import BottomTabBar from './components/BottomTabBar';
import { isDisclaimerAcknowledged } from './lib/disclaimer';

const DEFAULT_HOME_INPUTS = {
  mode: 'duration', // 'distance' | 'duration'
  distanceKm: 3,
  durationMin: 30,
  activity: 'run', // 'run' | 'walk'
};

const TAB_BAR_SCREENS = ['plan', 'log', 'profile'];

export default function App() {
  const [screen, setScreen] = useState('checking');
  const [screenBeforeDisclaimer, setScreenBeforeDisclaimer] = useState('plan');
  const [homeInputs, setHomeInputs] = useState(DEFAULT_HOME_INPUTS);
  const [planState, setPlanState] = useState({ target: null, options: null, candidatePool: [] });
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);

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
    setScreen('log');
  };

  const handleCancelRun = () => {
    setSelectedRoute(null);
    setSelectedTarget(null);
    setScreen('plan');
  };

  const handleViewDisclaimer = () => {
    setScreenBeforeDisclaimer(screen);
    setScreen('disclaimer');
  };

  const showTabBar = TAB_BAR_SCREENS.includes(screen);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        {screen === 'checking' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        )}
        {screen === 'disclaimer' && (
          <DisclaimerScreen onAcknowledge={() => setScreen(screenBeforeDisclaimer)} />
        )}
        {screen === 'plan' && (
          <PlanScreen
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
        {screen === 'log' && <RunLogScreen onBack={() => setScreen('plan')} />}
        {screen === 'profile' && <ProfileScreen onViewDisclaimer={handleViewDisclaimer} />}
      </View>
      {showTabBar && <BottomTabBar activeTab={screen} onSelect={setScreen} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
