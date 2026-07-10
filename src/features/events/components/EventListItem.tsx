import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getMapUrl } from "@/src/features/events/utils";
import type { EffectiveEventStatus, MyEvent, RsvpStatus } from "@/src/features/events/types";

interface EventListItemProps {
  event: MyEvent;
  onPress: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<EffectiveEventStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  ACTIVE: "In Progress",
  COMPLETED: "Completed",
  LOCKED: "Locked",
  CANCELLED: "Cancelled",
};

const RSVP_LABELS: Record<RsvpStatus, string> = {
  YES: "You're going",
  NO: "You declined",
};

export function EventListItem({ event, onPress }: EventListItemProps) {
  // FP-66 AC: cancelled events stay in the list, still tappable, still
  // fully visible — just visually distinguished with a red tint.
  const isCancelled = event.effective_status === "CANCELLED";

  return (
    <Pressable
      style={[styles.container, isCancelled && styles.cancelled]}
      onPress={onPress}
      testID={`event-item-${event.id}`}
    >
      <Text style={styles.name}>{event.name}</Text>
      <Text style={styles.meta}>{formatDateTime(event.start_datetime)}</Text>
      {/* Nested Pressable, not a plain Text tap handler: RN's responder
          system gives this its own touch target, so tapping it opens the
          map without also firing the outer card's onPress. */}
      <Pressable onPress={() => Linking.openURL(getMapUrl(event))} testID={`event-item-map-${event.id}`}>
        <Text style={[styles.meta, styles.locationLink]}>{event.location_name}</Text>
      </Pressable>
      <View style={styles.footer}>
        <View style={[styles.pill, isCancelled && styles.pillCancelled]}>
          <Text style={[styles.pillText, isCancelled && styles.pillTextCancelled]}>
            {STATUS_LABELS[event.effective_status]}
          </Text>
        </View>
        {event.rsvp_status ? (
          <Text style={styles.rsvpText}>{RSVP_LABELS[event.rsvp_status]}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 12,
  },
  cancelled: {
    backgroundColor: "#fdecea",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  locationLink: {
    color: "#2563eb",
    textDecorationLine: "underline",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#e0e7ff",
  },
  pillCancelled: {
    backgroundColor: "#f5c6c2",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3730a3",
  },
  pillTextCancelled: {
    color: "#7f1d1d",
  },
  rsvpText: {
    fontSize: 13,
    color: "#555",
  },
});
