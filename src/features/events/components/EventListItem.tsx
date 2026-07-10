import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EffectiveEventStatus, MyEvent, RsvpStatus } from "@/src/features/events/types";

interface EventListItemProps {
  event: MyEvent;
  showRsvpStatus: boolean;
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

export function EventListItem({ event, showRsvpStatus, onPress }: EventListItemProps) {
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
      <Text style={styles.meta}>{event.location_name}</Text>
      <View style={styles.footer}>
        <View style={[styles.pill, isCancelled && styles.pillCancelled]}>
          <Text style={[styles.pillText, isCancelled && styles.pillTextCancelled]}>
            {STATUS_LABELS[event.effective_status]}
          </Text>
        </View>
        {showRsvpStatus && event.rsvp_status ? (
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
