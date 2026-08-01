import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@safe_loop_run/disclaimer_ack_v1';

export async function isDisclaimerAcknowledged() {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    return value === 'true';
  } catch (err) {
    return false;
  }
}

export async function acknowledgeDisclaimer() {
  await AsyncStorage.setItem(STORAGE_KEY, 'true');
}
