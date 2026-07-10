import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { MfaVerifyForm } from "@/src/features/auth/components/MfaVerifyForm";
import { getTotpFactorId, verifyTotpChallenge } from "@/src/features/auth/services/auth.service";
import {
  isBiometricHardwareAvailable,
  markDeviceTrusted,
} from "@/src/features/auth/services/biometricTrust.service";
import { supabase } from "@/src/lib/supabase";

export default function MfaVerifyScreen() {
  const handleVerify = async (code: string) => {
    const factorId = await getTotpFactorId();
    if (!factorId) {
      throw new Error("No verified authenticator found for this account.");
    }

    // Session is not established at aal2 — and the app shell is not
    // reachable — until this challengeAndVerify call succeeds (FP-91 AC).
    await verifyTotpChallenge(factorId, code);

    // FP-91 item 14 / FP-92 item 15: mark the device trusted for future
    // biometric-gated reopens once aal2 is established.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const hardwareAvailable = await isBiometricHardwareAvailable();
      if (hardwareAvailable) {
        await markDeviceTrusted(session.user.id);
      }
    }

    router.replace("/(app)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify It&apos;s You</Text>
      <MfaVerifyForm onSubmit={handleVerify} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
});
