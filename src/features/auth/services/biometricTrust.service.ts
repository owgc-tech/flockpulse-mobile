import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const trustKey = (userId: string) => `biometric_trusted:${userId}`;

export async function isBiometricHardwareAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

// SecureStore (Keychain/Keystore-backed) rather than AsyncStorage: this flag
// gates the biometric-unlock convenience path, so it needs the stronger store.
export async function markDeviceTrusted(userId: string): Promise<void> {
  await SecureStore.setItemAsync(trustKey(userId), "true");
}

export async function isDeviceTrusted(userId: string): Promise<boolean> {
  const value = await SecureStore.getItemAsync(trustKey(userId));
  return value === "true";
}

export async function clearDeviceTrust(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(trustKey(userId));
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock FlockPulse",
    disableDeviceFallback: false,
  });
  return result.success;
}
