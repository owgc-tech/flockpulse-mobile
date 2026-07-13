import { useEffect, useRef, useState } from "react";
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
import { CommunityBanner } from "@/src/features/tenant/components/CommunityBanner";

type Gate =
  | { phase: "loading" }
  | { phase: "redirect"; href: "/(auth)/login" | "/(auth)/mfa-verify" | "/(auth)/mfa-enroll" }
  | { phase: "biometric-lock" }
  | { phase: "ready" };

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const [gate, setGate] = useState<Gate>({ phase: "loading" });
  // FP-96-FP-97-adj-1: session?.access_token is a dependency below (needed
  // to notice an aal-level change after mfa-verify/mfa-enroll), but
  // access_token also changes on every routine token refresh — including
  // the one Avatar.tsx's Profile Card now force-triggers on open. Without
  // this, every one of those refreshes re-ran the full gate from scratch and
  // re-prompted Face ID/passcode for a user who was already sitting in the
  // app. Tracks which user id the gate last reached "ready" for so a token
  // refresh for that same user can skip straight back to ready instead of
  // re-running the trust/hardware/biometric checks; cleared on sign-out so
  // a genuine new sign-in always re-checks.
  const readyUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      setGate({ phase: "loading" });
      return;
    }

    if (!session) {
      readyUserIdRef.current = null;
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

      // Already gated to "ready" for this exact user earlier in this app
      // session — a token refresh (routine auto-refresh, or Avatar.tsx's
      // forced refreshSession()) isn't a new app open, so it shouldn't
      // re-trigger Face ID/passcode every time one fires.
      if (readyUserIdRef.current === session.user.id) {
        setGate({ phase: "ready" });
        return;
      }

      const trusted = await isDeviceTrusted(session.user.id);
      if (cancelled) return;
      if (!trusted) {
        readyUserIdRef.current = session.user.id;
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
        readyUserIdRef.current = session.user.id;
        setGate({ phase: "ready" });
        return;
      }

      const hardwareAvailable = await isBiometricHardwareAvailable();
      if (cancelled) return;
      if (!hardwareAvailable) {
        readyUserIdRef.current = session.user.id;
        setGate({ phase: "ready" });
        return;
      }

      setGate({ phase: "biometric-lock" });
      const success = await authenticateWithBiometrics();
      if (cancelled) return;
      if (success) readyUserIdRef.current = session.user.id;
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
          if (success) {
            if (session) readyUserIdRef.current = session.user.id;
            setGate({ phase: "ready" });
          }
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

  // A Stack wrapping the (tabs) group (My Events / Confirmations, each with
  // its own header + avatar) plus every screen that should push over the
  // tab bar and hide it: event detail, self-report, and the profile edit
  // form. The Profile Card itself is no longer a route — Avatar.tsx now
  // renders it as a positioned popover (a Modal) owned by the avatar
  // component, not something registered here. Not a change to the gate
  // above — only what renders once it says "ready".
  //
  // FP-118: CommunityBanner renders once here, above the Stack, so it's
  // present on every (app)-group screen without any individual screen
  // having to render it itself. None of these Stack.Screen entries set a
  // `title` anymore — native header titles are redundant now that the
  // banner plus each screen's own body content (which already shows the
  // relevant name/heading) covers that. (tabs)'s own _layout.tsx handles
  // its two screens' headers separately, including preserving their bottom
  // tab bar labels via tabBarLabel.
  //
  // FP-118 Grounding Check: omitting `title` isn't the same as guaranteeing
  // a blank header — React Navigation falls back to the raw route segment
  // name (the exact "(tabs)"-as-literal-text bug from the FP-115 round,
  // fixed there with headerBackButtonDisplayMode: "minimal" on just that
  // one screen) when no title is available anywhere in the chain. Two
  // explicit defaults close that off for all five pushed screens at once,
  // rather than leaving it to omission: screenOptions' headerTitle forces
  // every header's title area genuinely blank regardless of segment-name
  // fallback, and headerBackButtonDisplayMode forces every back button
  // icon-only regardless of what the previous screen's (now also blank)
  // title would otherwise resolve to for the back label. Centralized here
  // rather than repeated per-screen since none of these five screens need a
  // different value — Event Detail's own Stack.Screen below only adds
  // headerRight, which is genuinely screen-owned (depends on canEdit).
  return (
    <View style={styles.appShell}>
      <CommunityBanner />
      <Stack screenOptions={{ headerTitle: () => null, headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]" />
        <Stack.Screen name="events/[id]/self-report" />
        <Stack.Screen name="events/[id]/edit" />
        <Stack.Screen name="events/create" />
        <Stack.Screen name="profile/edit" />
      </Stack>
    </View>
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
  appShell: {
    flex: 1,
  },
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
