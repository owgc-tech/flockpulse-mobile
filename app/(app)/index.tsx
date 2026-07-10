import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { signOut } from "@/src/features/auth/services/auth.service";
import { listMyEvents } from "@/src/features/events/services/events.service";
import { EventListItem } from "@/src/features/events/components/EventListItem";
import type { MyEvent } from "@/src/features/events/types";

export default function MyEventsScreen() {
  const { session } = useSession();
  // Admin isn't covered by FP-94/66/95's ACs — defaults to the Member-style
  // RSVP list rather than the Leader roster view (Grounding Check).
  const isLeader = session?.user.app_metadata?.role === "LEADER";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetches on mount and every time this screen regains focus (e.g.
  // returning from the detail screen after an RSVP submission).
  useFocusEffect(
    useCallback(() => {
      loadEvents(false);
    }, [loadEvents])
  );

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
            <EventListItem
              event={item}
              showRsvpStatus={!isLeader}
              onPress={() => handlePressEvent(item)}
            />
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
