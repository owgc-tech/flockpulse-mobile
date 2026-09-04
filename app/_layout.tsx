import { useEffect } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import "@/src/lib/supabase";
import { setPendingNotificationResponse } from "@/src/features/notifications/pendingNotificationSignal";
import { ThemePreferenceProvider, useThemePreference } from "@/src/theme/ThemePreferenceContext";

// DIP-FP-217-mobile: this root layout only *detects* a notification tap — it
// no longer routes from here. Every screen a tap can open lives in the (app)
// group, which has its own async gate (session load + MFA check) that must
// reach "ready" first; a router.push() fired from here before that resolves
// races the gate's own redirect logic and the intended destination can be
// swallowed (most visibly on a cold launch). The response is parked in
// pendingNotificationSignal and drained by app/(app)/_layout.tsx once its
// gate is ready.
function navigateFromNotification(response: Notifications.NotificationResponse) {
  setPendingNotificationResponse(response);
}

// DIP-FP-145: StatusBar previously used style="auto", which follows the OS
// scheme directly — independent of the theme override above. That left the
// status bar visibly wrong whenever a member's override disagreed with their
// device's OS setting (e.g. overriding to Light while the OS is in Dark).
// Computing it from the same effective (override-or-system) theme as
// useThemeColors() keeps it consistent. This needs to be a child of
// ThemePreferenceProvider (to call useThemePreference()), so it can't live
// directly in RootLayout, which renders the provider itself.
function RootLayoutContent() {
  const { preference } = useThemePreference();
  const systemScheme = useColorScheme();
  const effectiveScheme = preference === "system" ? systemScheme : preference;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style={effectiveScheme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function RootLayout() {
  // Root layout, not (app)'s — active regardless of auth state, so a tap
  // is never silently dropped just because the user isn't signed in yet.
  // The (app) layout's own auth/MFA/biometric gate still runs first if
  // needed, exactly as it does for any other navigation into that group.
  useEffect(() => {
    // iOS: a live JS listener does not run if the app was fully terminated
    // (not just backgrounded) when the notification was tapped — the app
    // cold-launches instead. getLastNotificationResponse() catches that
    // case; the live listener below catches the already-running case. Both
    // funnel into the same handler, which branches on the payload's `type`
    // to reach the right screen (event detail / self-report / confirmations).
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      navigateFromNotification(lastResponse);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromNotification);
    return () => subscription.remove();
  }, []);

  return (
    // DIP-FP-194-mobile: required one-time setup for
    // react-native-gesture-handler to function at all — must wrap the whole
    // app, outermost, per the library's own setup docs. Needs a real native
    // rebuild (new native module), not deliverable via the existing OTA
    // update workflow.
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <ThemePreferenceProvider>
          <RootLayoutContent />
        </ThemePreferenceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
});
