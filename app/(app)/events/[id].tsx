import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSession } from "@/src/features/auth/hooks/useSession";
import { getEventRoster, submitRsvp } from "@/src/features/events/services/events.service";
import { RsvpControls } from "@/src/features/events/components/RsvpControls";
import { RosterList } from "@/src/features/events/components/RosterList";
import { getMapUrl } from "@/src/features/events/utils";
import type { MyEvent, RosterEntry, RsvpStatus } from "@/src/features/events/types";

function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startTime} – ${endTime}`;
}

// Member-branch read-only copy when RSVP controls aren't editable
// (effective_status !== 'SCHEDULED'): distinguishes "hasn't opened yet" from
// "already closed" rather than showing one generic message either way.
function readOnlyRsvpLabel(event: MyEvent): string {
  if (event.rsvp_status === "YES") return "You responded: Going";
  if (event.rsvp_status === "NO") {
    return event.rsvp_reason ? `You responded: Not going — ${event.rsvp_reason}` : "You responded: Not going";
  }
  return event.effective_status === "DRAFT" ? "Not yet responded" : "RSVP closed";
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const { session } = useSession();
  // Every event here is one the viewer is personally an attendee of, so
  // RSVP is always shown; roster is additionally shown to anyone who isn't
  // a plain Member (Leader scoped to their own assigned members, Admin
  // seeing everyone — both already enforced server-side). Guarded on role
  // being known yet (not just "!== MEMBER") so it defaults to hidden while
  // this screen's own useSession() call is still resolving, rather than
  // briefly flashing true for a Member on first render.
  const role = session?.user.app_metadata?.role;
  const showRoster = role !== undefined && role !== "MEMBER";

  const [event, setEvent] = useState<MyEvent | null>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    if (!params.event) {
      setParseError(true);
      return;
    }
    try {
      setEvent(JSON.parse(params.event) as MyEvent);
    } catch {
      setParseError(true);
    }
  }, [params.event]);

  if (parseError || !event) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Event" }} />
        <Text style={styles.error}>
          {parseError ? "Couldn't open this event — please go back and try again." : "Loading…"}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: event.name }} />

      <Text style={styles.name}>{event.name}</Text>
      <Text style={styles.meta}>{formatDateTimeRange(event.start_datetime, event.end_datetime)}</Text>
      {/* alignSelf: 'flex-start' keeps the tap area sized to the two text
          lines — the ScrollView's contentContainerStyle (this Pressable's
          parent) defaults to alignItems: 'stretch', which would otherwise
          stretch it to the full screen width. */}
      <Pressable
        style={styles.locationPressable}
        onPress={() => Linking.openURL(getMapUrl(event))}
        testID="event-detail-map"
      >
        <Text style={[styles.meta, styles.locationLink]}>{event.location_name}</Text>
        <Text style={[styles.metaSecondary, styles.locationLink]}>{event.location_address}</Text>
      </Pressable>

      <View style={styles.divider} />

      <RsvpSection event={event} onEventChange={setEvent} />

      {showRoster ? (
        <>
          <View style={styles.divider} />
          <RosterSection eventId={event.id} />
        </>
      ) : null}
    </ScrollView>
  );
}

function RsvpSection({
  event,
  onEventChange,
}: {
  event: MyEvent;
  onEventChange: (event: MyEvent) => void;
}) {
  const editable = event.effective_status === "SCHEDULED";

  const handleSubmit = async (status: RsvpStatus, reason?: string) => {
    const response = await submitRsvp(event.id, status, reason);
    // Update local state so the screen reflects the new response
    // immediately without a re-fetch (Grounding Check tradeoff: the list
    // screen re-fetches on focus, so this only needs to stay correct for
    // the current mount of this screen).
    onEventChange({
      ...event,
      rsvp_status: response.rsvp_status,
      rsvp_reason: response.rsvp_reason,
    });
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Your RSVP</Text>
      <RsvpControls
        currentStatus={event.rsvp_status}
        editable={editable}
        readOnlyLabel={readOnlyRsvpLabel(event)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function RosterSection({ eventId }: { eventId: string }) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setError(null);
    try {
      const data = await getEventRoster(eventId);
      setRoster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster.");
    }
  }, [eventId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  return (
    <View>
      <Text style={styles.sectionTitle}>Roster</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !roster ? (
        <ActivityIndicator />
      ) : (
        <RosterList entries={roster} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  meta: {
    fontSize: 15,
    color: "#333",
    marginTop: 8,
  },
  metaSecondary: {
    fontSize: 14,
    color: "#777",
    marginTop: 2,
  },
  locationPressable: {
    alignSelf: "flex-start",
  },
  locationLink: {
    color: "#2563eb",
    textDecorationLine: "underline",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ddd",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  error: {
    color: "#c0392b",
    fontSize: 15,
    textAlign: "center",
  },
});
