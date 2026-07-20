import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { listMyTaskAssignments } from "@/src/features/tasks/services/tasks.service";
import type { MyTaskAssignment } from "@/src/features/tasks/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays, same
// convention as ConfirmationsScreen.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    empty: { color: colors.textSecondary },
    card: { backgroundColor: colors.cardBackground },
    taskName: { color: colors.text },
    eventName: { color: colors.text },
    meta: { color: colors.textSecondary },
    error: { color: colors.danger },
  });
}

function formatEventDateTime(iso: string): string {
  const date = new Date(iso);
  const dateLabel = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel}, ${timeLabel}`;
}

// DIP-FP-161-5-my-tasks-tab: read-only and purely navigational — no
// accept/decline, no reassignment UI (per the DIP's explicit
// simplification; reassignment happens elsewhere, by an Admin/event
// Owner). Tapping a row navigates to that event's detail screen with only
// `id` (no `event` param) — this endpoint's rows aren't MyEvent-shaped, so
// [id].tsx's own fresh-fetch (see its DIP-FP-161-5 comments) populates the
// screen from scratch instead.
export default function MyTasksScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [items, setItems] = useState<MyTaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const data = await listMyTaskAssignments();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your tasks.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePress = (item: MyTaskAssignment) => {
    router.push({
      pathname: "/(app)/events/[id]",
      params: { id: item.event_id },
    });
  };

  return (
    <View style={[styles.container, themed.container]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, themed.error]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={[styles.empty, themed.empty]}>No tasks assigned to you right now</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, themed.card]}
              onPress={() => handlePress(item)}
              testID={`my-task-item-${item.id}`}
            >
              <Text style={[styles.taskName, themed.taskName]}>{item.task_name}</Text>
              <Text style={[styles.eventName, themed.eventName]}>{item.event_name}</Text>
              <Text style={[styles.meta, themed.meta]}>{formatEventDateTime(item.event_start_datetime)}</Text>
              <Text style={[styles.meta, themed.meta]}>{item.event_location_name}</Text>
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
  taskName: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    color: "#555",
  },
  eventName: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
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
