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
import { router } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { EventListItem } from "@/src/features/events/components/EventListItem";
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

function EventRow({
  event,
  onPress,
  onLayout,
}: {
  event: MyEvent;
  onPress: () => void;
  onLayout: (height: number) => void;
}) {
  const start = new Date(event.start_datetime);
  const dayOfWeek = start.toLocaleDateString(undefined, { weekday: "short" });
  const dateNumber = start.getDate();

  return (
    <View style={styles.row} onLayout={(e) => onLayout(e.nativeEvent.layout.height)}>
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

// DIP Grounding Check: EventRow's height isn't fixed — event.name and
// location_name both wrap unbounded, so a two-line name plus a wrapped
// location can make one row noticeably taller than another. Rather than
// guess a single static row height for getItemLayout (wrong for any row
// that wraps), track real measured heights per row via onLayout and fall
// back to this estimate only for rows that haven't rendered/measured yet —
// self-correcting as more of the list gets measured, with
// onScrollToIndexFailed below as the safety net for jumps that land on a
// still-unmeasured section.
const ESTIMATED_ROW_HEIGHT = 140;
// This is specifically the *labeled* header's estimate (fixed padding, 10
// top + 10 bottom, plus one line of 15px bold text) — the blank header a
// section gets once its month matches the dropdown (see sectionHeaderBlank)
// is genuinely shorter, so headers are no longer assumed uniform (see
// sectionHeaderHeightsRef below). Used only as a fallback before a given
// section has rendered and measured itself once, not a universal height.
const ESTIMATED_SECTION_HEADER_HEIGHT = 41;

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

  // Measured heights, keyed by event id (rows) and by section key (headers).
  // Headers are keyed per-section rather than sharing one ref because a
  // blank header (its month currently matches the dropdown — see
  // sectionHeaderBlank) is genuinely shorter than a labeled one; assuming
  // one uniform height across all sections would throw off getItemLayout's
  // math for whichever sections don't match that assumption. `layoutTick`
  // forces the itemLayouts memo below to recompute after a measurement
  // comes in (refs alone don't trigger a re-render).
  const rowHeightsRef = useRef<Map<string, number>>(new Map());
  const sectionHeaderHeightsRef = useRef<Map<string, number>>(new Map());
  const [layoutTick, setLayoutTick] = useState(0);

  const handleRowLayout = useCallback((eventId: string, height: number) => {
    if (rowHeightsRef.current.get(eventId) === height) return;
    rowHeightsRef.current.set(eventId, height);
    setLayoutTick((t) => t + 1);
  }, []);

  const handleSectionHeaderLayout = useCallback((sectionKey: string, height: number) => {
    if (sectionHeaderHeightsRef.current.get(sectionKey) === height) return;
    sectionHeaderHeightsRef.current.set(sectionKey, height);
    setLayoutTick((t) => t + 1);
  }, []);

  // Flattens sections into the same [header, item, item, ..., header, item,
  // ...] index order SectionList's own internal VirtualizedList uses, so
  // getItemLayout below can just index into it directly.
  const itemLayouts = useMemo(() => {
    const layouts: { length: number; offset: number }[] = [];
    let offset = 0;

    for (const section of sections) {
      const headerHeight = sectionHeaderHeightsRef.current.get(section.key) ?? ESTIMATED_SECTION_HEADER_HEIGHT;
      layouts.push({ length: headerHeight, offset });
      offset += headerHeight;
      for (const item of section.data) {
        const rowHeight = rowHeightsRef.current.get(item.id) ?? ESTIMATED_ROW_HEIGHT;
        layouts.push({ length: rowHeight, offset });
        offset += rowHeight;
      }
    }
    return layouts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, layoutTick]);

  const getItemLayout = useCallback(
    (_data: unknown, index: number) => {
      const layout = itemLayouts[index] ?? { length: ESTIMATED_ROW_HEIGHT, offset: ESTIMATED_ROW_HEIGHT * index };
      return { ...layout, index };
    },
    [itemLayouts]
  );

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

  // Remembers the last requested target so onScrollToIndexFailed (below) can
  // retry the same destination — its failure callback only gets a flattened
  // list index, not the sectionIndex/itemIndex pair scrollToLocation needs.
  const pendingScrollRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);

  const handleSelectMonth = (section: EventSection) => {
    const sectionIndex = sections.findIndex((s) => s.key === section.key);
    if (sectionIndex === -1) return;
    setIsMonthPickerOpen(false);
    setCurrentMonthLabel(section.title);
    pendingScrollRef.current = { sectionIndex, itemIndex: 0 };
    sectionListRef.current?.scrollToLocation({
      sectionIndex,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    });
  };

  // DIP Grounding Check: jumping to a distant month lands on rows that have
  // never rendered, so getItemLayout's answer for them is necessarily still
  // the estimate, not a measured height — accurate enough for VirtualizedList
  // to attempt the scroll, but not always enough for it to land exactly on
  // the target. Retrying after a short delay gives the list a chance to
  // render nearby content (and this same handler fire again if it's still
  // off) rather than leaving the user stranded mid-scroll.
  const handleScrollToIndexFailed = useCallback(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    setTimeout(() => {
      sectionListRef.current?.scrollToLocation({
        sectionIndex: pending.sectionIndex,
        itemIndex: pending.itemIndex,
        animated: true,
        viewPosition: 0,
      });
    }, 150);
  }, []);

  return (
    <View style={styles.container}>
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

      {/* FP-118: relocated from the native header's headerLeft (now that
          headerTitle/headerLeft is no longer used app-wide) into the body,
          directly above the list — same Pressable/Modal/picker state as
          before, just moved. */}
      <View style={styles.monthDropdownRow}>
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
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          getItemLayout={getItemLayout}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadEvents(true)} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No upcoming events</Text>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const isBlank = section.title === currentMonthLabel;
            return (
              <View
                style={[styles.sectionHeader, isBlank && styles.sectionHeaderBlank]}
                onLayout={(e) => handleSectionHeaderLayout(section.key, e.nativeEvent.layout.height)}
              >
                <Text style={styles.sectionHeaderText}>{isBlank ? "" : section.title}</Text>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <EventRow
              event={item}
              onPress={() => handlePressEvent(item)}
              onLayout={(height) => handleRowLayout(item.id, height)}
            />
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
  monthDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4, // was 8
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
    // FP-118 Grounding Check: this was calibrated for the dropdown's old
    // position embedded in the native header; now that it's relocated into
    // the body (below CommunityBanner + the still-present-but-blank-title
    // native header row), it needs to anchor further down. This value is a
    // best-effort estimate, not a measured one — needs on-device
    // confirmation that the card still visually anchors just under the
    // dropdown across device sizes/safe-area insets, same fiddly-pixel
    // caveat as the month-scroll tuning elsewhere in this screen.
    top: 150,
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
  // Applied alongside sectionHeader (not instead of) when this section's
  // month matches the dropdown — collapses the dead whitespace a blank-text
  // header would otherwise still reserve at the labeled header's full
  // padding.
  sectionHeaderBlank: {
    paddingVertical: 0,
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
