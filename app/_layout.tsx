import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import "@/src/lib/supabase";
import type { NotificationDataPayload } from "@/src/features/notifications/types";

function navigateToEventFromNotification(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Partial<NotificationDataPayload> | undefined;
  if (!data?.eventId || !data?.event) return;

  router.push({
    pathname: "/(app)/events/[id]",
    params: { id: data.eventId, event: data.event },
  });
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
    // funnel into the same handler and reuse the events detail screen's
    // existing route-param shape — no changes needed there.
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) {
      navigateToEventFromNotification(lastResponse);
      Notifications.clearLastNotificationResponse();
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      navigateToEventFromNotification
    );
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
