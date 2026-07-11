import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { getAssuranceLevel, hasEnrolledTotpFactor, signOut } from "@/src/features/auth/services/auth.service";
import {
  authenticateWithBiometrics,
  clearDeviceTrust,
  consumeJustAuthenticated,
  isBiometricHardwareAvailable,
  isDeviceTrusted,
} from "@/src/features/auth/services/biometricTrust.service";

type Gate =
  | { phase: "loading" }
  | { phase: "redirect"; href: "/(auth)/login" | "/(auth)/mfa-verify" | "/(auth)/mfa-enroll" }
  | { phase: "biometric-lock" }
  | { phase: "ready" };

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const [gate, setGate] = useState<Gate>({ phase: "loading" });

  useEffect(() => {
    if (isLoading) {
      setGate({ phase: "loading" });
      return;
    }

    if (!session) {
      setGate({ phase: "redirect", href: "/(auth)/login" });
      return;
    }

    let cancelled = false;

    (async () => {
      // The access token's aal claim reflects whether MFA was completed,
      // even after an app restart restores a persisted session — so this
      // check alone is enough to keep an aal1-only session out of the app
      // shell (FP-91 AC), without needing a fresh network round trip beyond
      // reading the current session.
      const { currentLevel, nextLevel } = await getAssuranceLevel();
      if (cancelled) return;

      if (currentLevel !== "aal2") {
        if (nextLevel === "aal2") {
          setGate({ phase: "redirect", href: "/(auth)/mfa-verify" });
        } else {
          const hasFactor = await hasEnrolledTotpFactor();
          if (cancelled) return;
          setGate({ phase: "redirect", href: hasFactor ? "/(auth)/mfa-verify" : "/(auth)/mfa-enroll" });
        }
        return;
      }

      const trusted = await isDeviceTrusted(session.user.id);
      if (cancelled) return;
      if (!trusted) {
        setGate({ phase: "ready" });
        return;
      }

      // This layout re-mounts and this effect re-runs on the router.replace()
      // that follows mfa-verify/mfa-enroll marking the device trusted — the
      // trust flag it just wrote is already there, which would otherwise
      // fire a redundant biometric prompt one breath after the user finished
      // password + TOTP. Skip once for that specific transition; a genuine
      // reopen runs in a fresh JS instance where this is never set.
      if (consumeJustAuthenticated()) {
        setGate({ phase: "ready" });
        return;
      }

      const hardwareAvailable = await isBiometricHardwareAvailable();
      if (cancelled) return;
      if (!hardwareAvailable) {
        setGate({ phase: "ready" });
        return;
      }

      setGate({ phase: "biometric-lock" });
      const success = await authenticateWithBiometrics();
      if (cancelled) return;
      setGate(success ? { phase: "ready" } : { phase: "biometric-lock" });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, session?.access_token, session?.user.id]);

  if (gate.phase === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (gate.phase === "redirect") {
    return <Redirect href={gate.href} />;
  }

  if (gate.phase === "biometric-lock") {
    return (
      <BiometricLockScreen
        onRetry={async () => {
          const success = await authenticateWithBiometrics();
          if (success) setGate({ phase: "ready" });
        }}
        onUsePasswordInstead={async () => {
          // FP-92 guard: never let a failed/declined biometric prompt fall
          // back into the app shell on its own — force a full password +
          // MFA re-authentication instead.
          if (session) await clearDeviceTrust(session.user.id);
          await signOut();
        }}
      />
    );
  }

  // A real Stack (not just Slot) so the list → detail navigation (this
  // DIP's app/(app)/events/[id].tsx) gets native back-navigation and a
  // header — index.tsx supplies its own title/headerRight via a local
  // <Stack.Screen options={...} />. Not a change to the gate above.
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen name="events/[id]" options={{ title: "Event" }} />
      <Stack.Screen name="events/[id]/self-report" options={{ title: "Self-Report" }} />
      <Stack.Screen name="confirmations/index" options={{ title: "Confirmations" }} />
    </Stack>
  );
}

function BiometricLockScreen({
  onRetry,
  onUsePasswordInstead,
}: {
  onRetry: () => void;
  onUsePasswordInstead: () => void;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Unlock FlockPulse</Text>
      <Pressable style={styles.button} onPress={onRetry} testID="biometric-retry">
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={onUsePasswordInstead} testID="biometric-use-password">
        <Text style={styles.linkText}>Use password instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    color: "#2563eb",
    fontSize: 14,
  },
});
