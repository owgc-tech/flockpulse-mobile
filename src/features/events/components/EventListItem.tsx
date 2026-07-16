import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getMapUrl } from "@/src/features/events/utils";
import type { EffectiveEventStatus, MyEvent, RsvpStatus } from "@/src/features/events/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

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

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time. The status-pill/cancelled-tint colors are
// bespoke to this component (not part of the shared token set in
// src/theme/colors.ts) — derived from colors.accent/colors.danger at low
// opacity so they still react to theme instead of hardcoding a second
// light/dark pair here.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.cardBackground },
    cancelled: { backgroundColor: colors.danger + "22" },
    name: { color: colors.text },
    meta: { color: colors.textSecondary },
    locationLink: { color: colors.accent },
    pill: { backgroundColor: colors.accent + "22" },
    pillCancelled: { backgroundColor: colors.danger + "22" },
    pillText: { color: colors.accent },
    pillTextCancelled: { color: colors.danger },
    rsvpText: { color: colors.textSecondary },
  });
}

export function EventListItem({ event, onPress }: EventListItemProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  // FP-66 AC: cancelled events stay in the list, still tappable, still
  // fully visible — just visually distinguished with a red tint.
  const isCancelled = event.effective_status === "CANCELLED";

  return (
    <Pressable
      style={[styles.container, themed.container, isCancelled && [styles.cancelled, themed.cancelled]]}
      onPress={onPress}
      testID={`event-item-${event.id}`}
    >
      <Text style={[styles.name, themed.name]}>{event.name}</Text>
      <Text style={[styles.meta, themed.meta]}>{formatDateTime(event.start_datetime)}</Text>
      {/* Nested Pressable, not a plain Text tap handler: RN's responder
          system gives this its own touch target, so tapping it opens the
          map without also firing the outer card's onPress. alignSelf:
          'flex-start' keeps its tap area sized to the text itself — the
          card (its parent) defaults to alignItems: 'stretch', which would
          otherwise stretch this Pressable to the full row width. */}
      <Pressable
        style={styles.locationPressable}
        onPress={() => Linking.openURL(getMapUrl(event))}
        testID={`event-item-map-${event.id}`}
      >
        <Text style={[styles.meta, themed.meta, styles.locationLink, themed.locationLink]}>{event.location_name}</Text>
      </Pressable>
      <View style={styles.footer}>
        <View style={[styles.pill, themed.pill, isCancelled && [styles.pillCancelled, themed.pillCancelled]]}>
          <Text style={[styles.pillText, themed.pillText, isCancelled && [styles.pillTextCancelled, themed.pillTextCancelled]]}>
            {STATUS_LABELS[event.effective_status]}
          </Text>
        </View>
        {event.rsvp_status ? (
          <Text style={[styles.rsvpText, themed.rsvpText]}>{RSVP_LABELS[event.rsvp_status]}</Text>
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
  locationPressable: {
    alignSelf: "flex-start",
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
