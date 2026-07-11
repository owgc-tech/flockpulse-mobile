import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signOut } from "@/src/features/auth/services/auth.service";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { EventListItem } from "@/src/features/events/components/EventListItem";
import { ensureNotificationSetup } from "@/src/features/notifications/services/notifications.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import type { MyEvent } from "@/src/features/events/types";

export default function MyEventsScreen() {
  const { session, isLoading: isSessionLoading } = useSession();
  const [events, setEvents] = useState<MyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read via ref rather than a loadEvents dependency, so loadEvents' own
  // identity stays stable across role resolving/changing — putting role
  // directly in its deps would re-trigger the mount effect below and
  // re-fetch a second time right after session resolves, reintroducing a
  // loading blink similar to the one already fixed for focus-refetching.
  const roleRef = useRef<string | undefined>(undefined);
  roleRef.current = session?.user.app_metadata?.role;

  const loadEvents = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await listMyEvents();
      setEvents(data);
      // Reminder scheduling is a background enhancement, not core to
      // rendering the list — a failure here (e.g. one event's
      // reminder-context fetch failing) shouldn't surface as a blocking
      // list-load error the way listMyEvents() failing does.
      reconcileEventReminders(data).catch((err) => {
        console.warn("Failed to reconcile event reminders:", err);
      });
      reconcileSelfReportReminders(data).catch((err) => {
        console.warn("Failed to reconcile self-report reminders:", err);
      });
      reconcileConfirmationReminders(data, roleRef.current).catch((err) => {
        console.warn("Failed to reconcile confirmation reminders:", err);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetches once on mount only (after the session — and so role — has
  // resolved, so reconcileConfirmationReminders sees a real role rather
  // than treating "not loaded yet" as "not a Leader" and wrongly cancelling
  // an existing Leader's confirmation reminders) — no refetch-on-focus
  // (that caused a full-screen loading blink on every return to this
  // screen). Pull-to-refresh (loadEvents(true) below) is the only other
  // way to refresh.
  useEffect(() => {
    if (isSessionLoading) return;
    ensureNotificationSetup();
    loadEvents(false);
  }, [isSessionLoading, loadEvents]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const handlePressEvent = (event: MyEvent) => {
    router.push({
      pathname: "/(app)/events/[id]",
      params: { id: event.id, event: JSON.stringify(event) },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "My Events",
          headerRight: () => (
            <Pressable onPress={handleSignOut} testID="sign-out">
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={events}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadEvents(true)} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No upcoming events</Text>
            </View>
          }
          renderItem={({ item }) => (
            <EventListItem event={item} onPress={() => handlePressEvent(item)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 48,
  },
  error: {
    color: "#c0392b",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  empty: {
    fontSize: 15,
    color: "#555",
  },
  signOutText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
  },
});
