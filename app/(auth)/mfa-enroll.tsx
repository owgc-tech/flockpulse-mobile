import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { MfaEnrollForm } from "@/src/features/auth/components/MfaEnrollForm";
import {
  enrollTotpFactor,
  listAllTotpFactors,
  unenrollFactor,
  verifyTotpEnrollment,
} from "@/src/features/auth/services/auth.service";
import {
  isBiometricHardwareAvailable,
  markDeviceTrusted,
  markJustAuthenticated,
} from "@/src/features/auth/services/biometricTrust.service";
import { supabase } from "@/src/lib/supabase";
import type { TotpEnrollment } from "@/src/features/auth/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    center: { backgroundColor: colors.background },
    title: { color: colors.text },
    error: { color: colors.danger },
  });
}

export default function MfaEnrollScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // A previous enrollment attempt may have been abandoned (app closed
        // before verifying) — Supabase creates an unverified factor
        // server-side the moment enroll() is first called, and a fresh
        // enroll() call fails once one already exists. Reopening this
        // screen must always be able to start clean, so clear out any
        // unverified leftovers before enrolling.
        const existingFactors = await listAllTotpFactors();
        const unverifiedFactors = existingFactors.filter((factor) => factor.status === "unverified");
        for (const factor of unverifiedFactors) {
          await unenrollFactor(factor.id);
        }

        const enrollment = await enrollTotpFactor();
        setEnrollment(enrollment);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start enrollment.");
      }
    })();
  }, []);

  const handleVerify = async (code: string) => {
    if (!enrollment) return;
    await verifyTotpEnrollment(enrollment.factorId, code);

    // FP-92 item 15: on first successful aal2 login, offer trusted-device
    // biometric unlock if the hardware supports it.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const hardwareAvailable = await isBiometricHardwareAvailable();
      if (hardwareAvailable) {
        await markDeviceTrusted(session.user.id);
        markJustAuthenticated();
      }
    }

    router.replace("/(app)");
  };

  if (error) {
    return (
      <View style={[styles.center, themed.center]}>
        <Text style={[styles.error, themed.error]}>{error}</Text>
      </View>
    );
  }

  if (!enrollment) {
    return (
      <View style={[styles.center, themed.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Text style={[styles.title, themed.title]}>Set Up Two-Factor Authentication</Text>
      <MfaEnrollForm enrollment={enrollment} onVerify={handleVerify} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  error: {
    color: "#c0392b",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
