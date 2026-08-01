import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, ActivityIndicator } from 'react-native';

import DisclaimerScreen from './screens/DisclaimerScreen';
import HomeScreen from './screens/HomeScreen';
import RouteOptionsScreen from './screens/RouteOptionsScreen';
import ActiveRunScreen from './screens/ActiveRunScreen';
import RunLogScreen from './screens/RunLogScreen';
import { DEFAULT_PACE_MIN_PER_KM } from './lib/pace';
import { isDisclaimerAcknowledged } from './lib/disclaimer';

const DEFAULT_HOME_INPUTS = {
  mode: 'duration', // 'distance' | 'duration'
  distanceKm: '5',
  durationMin: '30',
  activity: 'run', // 'run' | 'walk'
  paceMinPerKm: String(DEFAULT_PACE_MIN_PER_KM.run),
};

export default function App() {
  const [screen, setScreen] = useState('checking');
  const [homeInputs, setHomeInputs] = useState(DEFAULT_HOME_INPUTS);
  const [target, setTarget] = useState(null);
  const [routeOptions, setRouteOptions] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  useEffect(() => {
    isDisclaimerAcknowledged().then((acknowledged) => {
      setScreen(acknowledged ? 'home' : 'disclaimer');
    });
  }, []);

  const handleTargetReady = (nextTarget) => {
    setTarget(nextTarget);
    setRouteOptions(null);
    setScreen('options');
  };

  const handleOptionsReady = (options, candidatePool) => {
    setRouteOptions({ options, candidatePool });
  };

  const handleSelectRoute = (candidate) => {
    setSelectedRoute(candidate);
    setScreen('active');
  };

  const handleRunFinished = () => {
    setSelectedRoute(null);
    setScreen('log');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {screen === 'checking' && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}
      {screen === 'disclaimer' && <DisclaimerScreen onAcknowledge={() => setScreen('home')} />}
      {screen === 'home' && (
        <HomeScreen
          inputs={homeInputs}
          onChangeInputs={setHomeInputs}
          onTargetReady={handleTargetReady}
          onViewLog={() => setScreen('log')}
        />
      )}
      {screen === 'options' && target && (
        <RouteOptionsScreen
          target={target}
          cachedOptions={routeOptions?.options ?? null}
          cachedPool={routeOptions?.candidatePool ?? null}
          onOptionsReady={handleOptionsReady}
          onSelectRoute={handleSelectRoute}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'active' && selectedRoute && target && (
        <ActiveRunScreen
          route={selectedRoute}
          activity={target.activity}
          paceMinPerKm={target.paceMinPerKm}
          startLat={target.startLat}
          startLng={target.startLng}
          locationLabel={target.locationLabel}
          onFinish={handleRunFinished}
        />
      )}
      {screen === 'log' && (
        <RunLogScreen onBack={() => setScreen(target ? 'options' : 'home')} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
