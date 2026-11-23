import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import {
  startEnrollment,
  startOverEnrollment,
  type EnrollFlowDeps,
} from "@/src/features/auth/services/mfaEnrollFlow";
import { clearPendingEnrollment, realPendingStore } from "@/src/features/auth/services/pendingEnrollment";
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
    button: { backgroundColor: colors.accent },
  });
}

// FP-218: never show Supabase's raw error text.
const START_FAILED_MESSAGE = "We could not start two-step setup. Please try again.";

// Real dependencies for the start-up flow (the logic lives in mfaEnrollFlow.ts).
const enrollDeps: EnrollFlowDeps = {
  getUserId: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  },
  listAllTotp: listAllTotpFactors,
  unenroll: unenrollFactor,
  enroll: enrollTotpFactor,
  pending: realPendingStore,
};

export default function MfaEnrollScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  // FP-218: starts (or restores) the setup. A reload or a return from the
  // authenticator app shows the same key; leftover unfinished factors are
  // cleaned up; two copies of this screen starting at once share one run.
  const start = useCallback(async () => {
    setFailed(false);
    setEnrollment(null);
    try {
      const result = await startEnrollment(enrollDeps);
      if (mountedRef.current) setEnrollment(result);
    } catch {
      if (mountedRef.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    start();
    return () => {
      mountedRef.current = false;
    };
  }, [start]);

  const handleStartOver = async () => {
    const result = await startOverEnrollment(enrollDeps);
    if (mountedRef.current) setEnrollment(result);
  };

  const handleVerify = async (code: string) => {
    if (!enrollment) return;
    await verifyTotpEnrollment(enrollment.factorId, code);
    // The setup is finished: the remembered key is no longer needed.
    await clearPendingEnrollment();

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

  if (failed) {
    return (
      <View style={[styles.center, themed.center]}>
        <Text style={[styles.error, themed.error]} testID="mfa-enroll-start-error">
          {START_FAILED_MESSAGE}
        </Text>
        <Pressable
          style={[styles.retryButton, themed.button]}
          onPress={start}
          accessibilityRole="button"
          accessibilityLabel="Try again to start two-step setup"
          testID="mfa-enroll-retry"
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </Pressable>
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Text style={[styles.title, themed.title]}>Set Up Two-Factor Authentication</Text>
      <MfaEnrollForm
        key={enrollment.factorId}
        enrollment={enrollment}
        onVerify={handleVerify}
        onStartOver={handleStartOver}
      />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  retryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    minHeight: 44,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
