import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

// SecureStore keys are restricted to alphanumeric, ".", "-", "_" — a colon
// separator throws at call time (only caught by real-device testing, not
// tsc/expo export), so use an underscore instead.
const trustKey = (userId: string) => `biometric_trusted_${userId}`;

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

// In-memory only (module-level, not persisted) — deliberately does not
// survive an app kill. Set right after a fresh password + TOTP login marks
// the device trusted, so the (app) layout's gate effect — which re-mounts
// and re-checks trust status immediately on the router.replace() that
// follows — doesn't turn around and fire a redundant biometric prompt for
// a session that just finished full MFA. A genuine reopen (force-quit or
// backgrounded-long-enough) runs in a fresh JS instance where this is
// always false, so biometric still gates normally there.
let justAuthenticatedInSession = false;

export function markJustAuthenticated(): void {
  justAuthenticatedInSession = true;
}

// One-time skip, not a standing bypass: reading it clears it immediately.
export function consumeJustAuthenticated(): boolean {
  const value = justAuthenticatedInSession;
  justAuthenticatedInSession = false;
  return value;
}
