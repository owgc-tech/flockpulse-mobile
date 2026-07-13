import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { EventListItem } from "@/src/features/events/components/EventListItem";
import { NavMenu } from "@/src/features/navigation/components/NavMenu";
import { ensureNotificationSetup } from "@/src/features/notifications/services/notifications.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import type { MyEvent } from "@/src/features/events/types";

interface EventSection {
  key: string; // "2026-07" — sort/lookup key, not displayed
  title: string; // "July 2026" — displayed in the section header + dropdown
  data: MyEvent[];
}

// DIP-FP-115-mobile-nav-calendar-edit: GET /api/events/mine orders
// server-side by start_datetime ascending (confirmed against the web
// service function) — events arrive pre-sorted, so grouping into
// consecutive month buckets via a single pass (no re-sort) is safe.
function groupEventsByMonth(events: MyEvent[]): EventSection[] {
  const sections: EventSection[] = [];
  let current: EventSection | null = null;

  for (const event of events) {
    const start = new Date(event.start_datetime);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    if (!current || current.key !== key) {
      current = { key, title: start.toLocaleDateString(undefined, { month: "long", year: "numeric" }), data: [] };
      sections.push(current);
    }
    current.data.push(event);
  }

  return sections;
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
  const [currentMonthLabel, setCurrentMonthLabel] = useState<string | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const sectionListRef = useRef<SectionList<MyEvent, EventSection>>(null);
  const sections = useMemo(() => groupEventsByMonth(events), [events]);

  // Sets the initial dropdown label once data loads, without overriding
  // whatever the scroll-sync callback below has already moved it to on a
  // later reload (pull-to-refresh keeping the user's scroll position).
  useEffect(() => {
    if (sections.length > 0 && currentMonthLabel === null) {
      setCurrentMonthLabel(sections[0].title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // DIP Grounding Check: this is the fiddly piece that needs real on-device
  // scroll tuning, not just a correctness check — itemVisiblePercentThreshold
  // and which viewable item's section "wins" right at a section boundary can
  // both flicker in ways that only show up while actually scrolling a real
  // list on a real device.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ isViewable: boolean; section?: EventSection }> }) => {
      const first = viewableItems.find((v) => v.isViewable && v.section);
      if (first?.section) setCurrentMonthLabel(first.section.title);
    }
  ).current;

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

  const handleSelectMonth = (section: EventSection) => {
    const sectionIndex = sections.findIndex((s) => s.key === section.key);
    if (sectionIndex === -1) return;
    setIsMonthPickerOpen(false);
    setCurrentMonthLabel(section.title);
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    });
  };

  return (
    <View style={styles.container}>
      {/* headerTitle cleared and headerLeft supplies the real hamburger nav
          menu + a tappable, scroll-synced month dropdown — headerRight
          (avatar) stays whatever (tabs)/_layout.tsx's shared screenOptions
          already supplies, untouched here. */}
      <Stack.Screen
        options={{
          headerTitle: () => null,
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <NavMenu />
              <Pressable
                style={styles.monthPressable}
                onPress={() => setIsMonthPickerOpen(true)}
                disabled={sections.length === 0}
                testID="month-dropdown"
              >
                <Text style={styles.monthLabel}>
                  {currentMonthLabel ?? new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </Text>
                {sections.length > 0 ? <Text style={styles.monthChevron}>▾</Text> : null}
              </Pressable>
            </View>
          ),
        }}
      />

      <Modal
        visible={isMonthPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMonthPickerOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsMonthPickerOpen(false)}
          testID="month-dropdown-backdrop"
        />
        <View style={styles.monthCard} testID="month-dropdown-card">
          {sections.map((section) => (
            <Pressable
              key={section.key}
              style={styles.monthOption}
              onPress={() => handleSelectMonth(section)}
              testID={`month-option-${section.key}`}
            >
              <Text
                style={[styles.monthOptionText, section.title === currentMonthLabel && styles.monthOptionTextActive]}
              >
                {section.title}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          contentContainerStyle={styles.listContent}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadEvents(true)} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No upcoming events</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}
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
  monthPressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  monthChevron: {
    fontSize: 12,
    color: "#555",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  monthCard: {
    position: "absolute",
    top: 70,
    left: 16,
    width: "60%",
    maxHeight: "60%",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  monthOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  monthOptionText: {
    fontSize: 15,
    color: "#111",
  },
  monthOptionTextActive: {
    fontWeight: "700",
    color: "#2563eb",
  },
  sectionHeader: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  listContent: {
    paddingBottom: 16,
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 12,
  },
  dateColumn: {
    width: "10%",
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
    width: "90%",
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
