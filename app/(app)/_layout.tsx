import { useEffect, useMemo, useRef, useState } from "react";
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
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays. `center` is
// shared by the loading spinner and the biometric-lock screen, both of which
// are the first thing a user sees on a cold app open — worth getting right.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { backgroundColor: colors.background },
    title: { color: colors.text },
    button: { backgroundColor: colors.accent },
    linkText: { color: colors.accent },
  });
}

type Gate =
  | { phase: "loading" }
  | { phase: "redirect"; href: "/(auth)/login" | "/(auth)/mfa-verify" | "/(auth)/mfa-enroll" }
  | { phase: "biometric-lock" }
  | { phase: "ready" };

export default function AppLayout() {
  const { session, isLoading } = useSession();
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
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
      <View style={[styles.center, themed.center]}>
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
        themed={themed}
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

  // A Stack wrapping the (tabs) group (My Events / Confirmations) plus
  // every screen that should push over the tab bar and hide it: event
  // detail, self-report, edit event, create event, and the profile edit
  // form. The Profile Card itself is no longer a route — Avatar.tsx now
  // renders it as a positioned popover (a Modal) owned by the avatar
  // component, not something registered here. Not a change to the gate
  // above — only what renders once it says "ready".
  //
  // FP-118: CommunityBanner renders once here, above the Stack, so it's
  // present on every (app)-group screen without any individual screen
  // having to render it itself — Avatar now lives inside the banner too
  // (a global control, not tied to any one screen's subject matter),
  // rather than per-screen headerRight.
  //
  // FP-118 round 2 Grounding Check: an earlier version of this DIP blanked
  // `title`/`headerBackButtonDisplayMode` instead of hiding the header
  // outright, but omitting `title` isn't the same as guaranteeing React
  // Navigation won't fall back to the raw route segment name for it — the
  // exact "(tabs)"-as-literal-text bug from the FP-115 round resurfaced on
  // these five screens despite that fix. headerShown: false removes the
  // whole category of that bug rather than chasing it screen by screen:
  // there's no header left for React Navigation to fall back to a route
  // name for. Each of the five pushed screens now renders its own "‹ Back"
  // link in its own body instead (Event Detail also relocates its Edit
  // button there, in the same row) — matching the same "subject matter
  // owns its own controls" convention web's MemberEditForm already uses
  // for its own "← Back to Members" link.
  return (
    <View style={styles.appShell}>
      <CommunityBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events/[id]" />
        <Stack.Screen name="events/[id]/self-report" />
        <Stack.Screen name="events/[id]/edit" />
        <Stack.Screen name="events/create" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="preferences" />
      </Stack>
    </View>
  );
}

function BiometricLockScreen({
  onRetry,
  onUsePasswordInstead,
  themed,
}: {
  onRetry: () => void;
  onUsePasswordInstead: () => void;
  themed: ReturnType<typeof getThemedStyles>;
}) {
  return (
    <View style={[styles.center, themed.center]}>
      <Text style={[styles.title, themed.title]}>Unlock FlockPulse</Text>
      <Pressable style={[styles.button, themed.button]} onPress={onRetry} testID="biometric-retry">
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={onUsePasswordInstead} testID="biometric-use-password">
        <Text style={[styles.linkText, themed.linkText]}>Use password instead</Text>
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
