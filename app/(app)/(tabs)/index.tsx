import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, Tabs } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { EventListItem } from "@/src/features/events/components/EventListItem";
import { ensureNotificationSetup } from "@/src/features/notifications/services/notifications.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import type { MyEvent } from "@/src/features/events/types";

// DIP-FP-115: "derived from currently-visible events or current date" — the
// simpler of the two options offered. Scroll-position-aware tracking (via
// FlatList's onViewableItemsChanged) would need real device scroll-behavior
// tuning to get right; a static current-date month name doesn't.
function currentMonthLabel(): string {
  return new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function EventRow({ event, onPress }: { event: MyEvent; onPress: () => void }) {
  const start = new Date(event.start_datetime);
  const dayOfWeek = start.toLocaleDateString(undefined, { weekday: "short" });
  const dateNumber = start.getDate();

  return (
    <View style={styles.row}>
      <View style={styles.dateColumn}>
        <Text style={styles.dayOfWeek}>{dayOfWeek}</Text>
        <Text style={styles.dateNumber}>{dateNumber}</Text>
      </View>
      <View style={styles.eventColumn}>
        <EventListItem event={event} onPress={onPress} />
      </View>
    </View>
  );
}

export default function MyEventsScreen() {
  const { session } = useSession();
  // Same inclusive pattern used everywhere else in this app — correct for
  // any current or future role at Leader-tier or Admin-tier, not a
  // hardcoded list of exact role values.
  const canCreateEvent = session?.user.app_metadata?.role !== undefined
    && session.user.app_metadata.role !== "MEMBER";

  const [events, setEvents] = useState<MyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      reconcileConfirmationReminders().catch((err) => {
        console.warn("Failed to reconcile confirmation reminders:", err);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetches once on mount only — no refetch-on-focus (that caused a
  // full-screen loading blink on every return to this screen). Pull-to-
  // refresh (loadEvents(true) below) is the only other way to refresh.
  useEffect(() => {
    ensureNotificationSetup();
    loadEvents(false);
  }, [loadEvents]);

  const handlePressEvent = (event: MyEvent) => {
    router.push({
      pathname: "/(app)/events/[id]",
      params: { id: event.id, event: JSON.stringify(event) },
    });
  };

  return (
    <View style={styles.container}>
      {/* headerTitle cleared and headerLeft supplies the month name +
          (currently non-functional, flagged) hamburger icon — headerRight
          (avatar) stays whatever (tabs)/_layout.tsx's shared screenOptions
          already supplies, untouched here. */}
      <Tabs.Screen
        options={{
          headerTitle: () => null,
          headerLeft: () => (
            <View style={styles.headerLeft}>
              {/* No drawer/menu content specified anywhere — placeholder
                  tap target only, flagged as incomplete rather than
                  silently wired to nothing or faking a working menu. */}
              <Pressable
                style={styles.menuButton}
                onPress={() => console.warn("Menu not yet implemented")}
                testID="menu-button"
              >
                <Text style={styles.menuIcon}>☰</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{currentMonthLabel()}</Text>
            </View>
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
            <EventRow event={item} onPress={() => handlePressEvent(item)} />
          )}
        />
      )}

      {canCreateEvent ? (
        <Pressable
          style={styles.fab}
          onPress={() => router.push("/(app)/events/create")}
          testID="create-event-fab"
        >
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 10,
  },
  menuButton: {
    padding: 4,
  },
  menuIcon: {
    fontSize: 20,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    marginBottom: 12,
  },
  dateColumn: {
    width: "15%",
    alignItems: "center",
    paddingTop: 16,
  },
  dayOfWeek: {
    fontSize: 12,
    color: "#777",
    textTransform: "uppercase",
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  eventColumn: {
    width: "85%",
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 30,
  },
});
