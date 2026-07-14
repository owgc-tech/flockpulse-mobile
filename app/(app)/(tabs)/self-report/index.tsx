import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { listPendingSelfReports } from "@/src/features/self-reports/services/selfReports.service";
import type { PendingSelfReportRow } from "@/src/features/self-reports/types";
import { syncSelfReportBadge } from "@/src/features/notifications/services/selfReportBadge.service";
import type { MyEvent } from "@/src/features/events/types";

function formatEventRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel}, ${startTime} – ${endTime}`;
}

// DIP-FP-119-mobile: events/[id]/self-report.tsx (reused as-is) expects a
// full MyEvent-shaped `event` route param — event.id specifically drives
// the actual submitSelfReport(event.id, ...) call, so that mapping is load-
// bearing. The fields below beyond id/name/start_datetime/end_datetime/
// location_name are display-only placeholders: by the time an event is
// COMPLETED it has already dropped out of /api/events/mine (which is where
// rsvp_status/status/etc. would normally come from), so there is no live
// source for them here. rsvp_status: null just shows "No response" on that
// screen's RSVP label — cosmetic only, not used by submission logic.
function toRouteEvent(item: PendingSelfReportRow): MyEvent {
  return {
    id: item.event_id,
    name: item.event_name,
    status: "SCHEDULED",
    start_datetime: item.event_start_datetime,
    end_datetime: item.event_end_datetime,
    location_name: item.event_location_name,
    location_address: "",
    location_url: null,
    target: {},
    event_type_id: "",
    prayer_leader_member_id: null,
    food_assignment: null,
    created_at: "",
    effective_status: "COMPLETED",
    rsvp_status: null,
    rsvp_reason: null,
  };
}

export default function SelfReportTabScreen() {
  const [items, setItems] = useState<PendingSelfReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const data = await listPendingSelfReports();
      setItems(data);
      // Gated on isRefresh, not the initial mount load — the tab layout's
      // own useEffect already syncs the badge on mount, same precedent as
      // Confirmations (see confirmations/index.tsx).
      if (isRefresh) {
        syncSelfReportBadge().catch((err) => {
          console.warn("Failed to sync self-report badge:", err);
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pending self-reports.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = (item: PendingSelfReportRow) => {
    router.push({
      pathname: "/(app)/events/[id]/self-report",
      params: { id: item.event_id, event: JSON.stringify(toRouteEvent(item)) },
    });
  };

  return (
    <View style={styles.container}>
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
          data={items}
          keyExtractor={(item) => item.event_id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.empty}>No pending self-reports</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => handlePress(item)}
              testID={`self-report-item-${item.event_id}`}
            >
              <Text style={styles.eventName}>{item.event_name}</Text>
              <Text style={styles.meta}>{formatEventRange(item.event_start_datetime, item.event_end_datetime)}</Text>
              <Text style={styles.meta}>{item.event_location_name}</Text>
            </Pressable>
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
  empty: {
    fontSize: 15,
    color: "#555",
  },
  card: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 12,
  },
  eventName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  meta: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 8,
  },
});
