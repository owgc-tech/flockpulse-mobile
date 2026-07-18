import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import "@/src/lib/supabase";
import type { NotificationDataPayload, NotificationType } from "@/src/features/notifications/types";
import { ThemePreferenceProvider, useThemePreference } from "@/src/theme/ThemePreferenceContext";

function navigateFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Partial<NotificationDataPayload> | undefined;
  if (!data) return;

  // Backward compat: notifications scheduled by pre-FP-97/98 code never had
  // a `type` field at all — treat a missing type as the original "reminder"
  // behavior rather than dropping an already-scheduled notification's tap
  // silently once this update lands.
  const type: NotificationType = data.type ?? "reminder";

  if (type === "confirmation") {
    // No event-specific data in this payload by design (Grounding Check) —
    // the confirmations list screen queries GET /api/confirmations/pending
    // fresh itself.
    router.push("/(app)/confirmations");
    return;
  }

  if (!data.eventId || !data.event) return;

  if (type === "self-report") {
    router.push({
      pathname: "/(app)/events/[id]/self-report",
      params: { id: data.eventId, event: data.event },
    });
    return;
  }

  router.push({
    pathname: "/(app)/events/[id]",
    params: { id: data.eventId, event: data.event },
  });
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
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <RootLayoutContent />
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}
