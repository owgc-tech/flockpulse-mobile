import { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Megaphone } from "lucide-react-native";
import { getMapUrl, getRsvpStatusColor, isRsvpWindowOpen } from "@/src/features/events/utils";
import type { EffectiveEventStatus, MeetingResource, MyEvent, RsvpStatus } from "@/src/features/events/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

interface EventListItemProps {
  event: MyEvent;
  onPress: () => void;
  meetingResources: MeetingResource[];
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
  YES: "Accepted",
  NO: "Declined",
  TENTATIVE: "Tentative",
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
    rsvpPromptText: { color: colors.accent, fontWeight: "700" },
  });
}

export function EventListItem({ event, onPress, meetingResources }: EventListItemProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  // FP-66 AC: cancelled events stay in the list, still tappable, still
  // fully visible — just visually distinguished with a red tint.
  const isCancelled = event.effective_status === "CANCELLED";

  // DIP-FP-191-mobile: system_key === 'ANNOUNCEMENT' confirmed against
  // web's merged event-type.types.ts (PR #151) — the one system-managed
  // event type every tenant has. Announcements have no RSVP concept at all
  // (they're acknowledged, not attended), so the prompt/pill below is
  // suppressed entirely rather than showing a meaningless "Please RSVP now."
  const isAnnouncement = event.event_type?.system_key === "ANNOUNCEMENT";

  // Mirrors app/(app)/events/[id].tsx exactly: resource-booked meetings
  // resolve their join link/label from the tracked resource (matched by id
  // out of the full list passed down from the list screen); freeform-
  // platform meetings already carry both directly on the event.
  const meetingResource = event.online_meeting_resource_id
    ? meetingResources.find((r) => r.id === event.online_meeting_resource_id) ?? null
    : null;
  const onlineMeetingLink = event.online_meeting_resource_id
    ? (meetingResource?.join_url ?? null)
    : event.online_meeting_url;
  const onlineMeetingLabel = event.online_meeting_resource_id
    ? `Zoom: ${meetingResource?.name ?? "Join Meeting"}`
    : event.online_meeting_platform_label || "Join Meeting";

  return (
    <Pressable
      style={[styles.container, themed.container, isCancelled && [styles.cancelled, themed.cancelled]]}
      onPress={onPress}
      testID={`event-item-${event.id}`}
    >
      {isAnnouncement ? (
        // DIP-FP-191-mobile-adj-4: full revert of adj-3's custom two-tone
        // SVG back to lucide's stock icon, at 2x the original 16 (32) —
        // not the attempted 3x (48).
        <View style={styles.announcementMarker} testID={`event-item-announcement-marker-${event.id}`}>
          <Megaphone size={32} color={colors.accent} />
        </View>
      ) : null}
      <Text style={[styles.name, themed.name]}>{event.name}</Text>
      <Text style={[styles.meta, themed.meta]}>{formatDateTime(event.start_datetime)}</Text>
      {isAnnouncement ? (
        // DIP-FP-191-mobile-adj-1: Announcement events carry placeholder
        // location_name/location_address values ("Announcement"/"N/A",
        // still forced server-side to satisfy a NOT NULL constraint) — a
        // confusing, non-functional "open maps" link. Show who posted it
        // instead, plain text (no link), nothing at all if created_by_member
        // is null (predates the column, or an anonymized/deleted creator).
        event.created_by_member ? (
          <Text style={[styles.meta, themed.meta]} testID={`event-item-creator-${event.id}`}>
            From: {event.created_by_member.first_name} {event.created_by_member.last_name}
          </Text>
        ) : null
      ) : (
        // Nested Pressable, not a plain Text tap handler: RN's responder
        // system gives this its own touch target, so tapping it opens the
        // map without also firing the outer card's onPress. alignSelf:
        // 'flex-start' keeps its tap area sized to the text itself — the
        // card (its parent) defaults to alignItems: 'stretch', which would
        // otherwise stretch this Pressable to the full row width.
        <Pressable
          style={styles.locationPressable}
          onPress={async () => Linking.openURL(await getMapUrl(event))}
          testID={`event-item-map-${event.id}`}
        >
          <Text style={[styles.meta, themed.meta, styles.locationLink, themed.locationLink]}>{event.location_name}</Text>
        </Pressable>
      )}
      {onlineMeetingLink ? (
        <Pressable
          style={styles.locationPressable}
          onPress={() => Linking.openURL(onlineMeetingLink)}
          testID={`event-item-online-meeting-${event.id}`}
        >
          <Text style={[styles.meta, themed.meta, styles.locationLink, themed.locationLink]}>{onlineMeetingLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.footer}>
        <View style={[styles.pill, themed.pill, isCancelled && [styles.pillCancelled, themed.pillCancelled]]}>
          <Text style={[styles.pillText, themed.pillText, isCancelled && [styles.pillTextCancelled, themed.pillTextCancelled]]}>
            {STATUS_LABELS[event.effective_status]}
          </Text>
        </View>
        {isAnnouncement ? (
          event.acknowledged_at ? (
            // DIP-FP-191-mobile-adj-2: unchanged — the green pill stays as
            // the acknowledged state, matching how a responded regular
            // event keeps its colored status pill.
            <View style={[styles.pill, { backgroundColor: colors.success + "22" }]}>
              <Text style={[styles.pillText, { color: colors.success }]}>Acknowledged</Text>
            </View>
          ) : (
            // DIP-FP-191-mobile-adj-3: replaces the amber "Unacknowledged"
            // pill with text, matching exactly how a not-yet-RSVP'd regular
            // event shows "Please RSVP now." text rather than a pill —
            // reuses the same style. DIP-FP-191-mobile-adj-4: shortened.
            <Text style={[styles.rsvpText, themed.rsvpPromptText]}>Please acknowledge.</Text>
          )
        ) : event.rsvp_status ? (
          <View style={[styles.pill, { backgroundColor: getRsvpStatusColor(colors, event.rsvp_status) + "22" }]}>
            <Text style={[styles.pillText, { color: getRsvpStatusColor(colors, event.rsvp_status) }]}>
              {RSVP_LABELS[event.rsvp_status]}
            </Text>
          </View>
        ) : isRsvpWindowOpen(event) ? (
          // isRsvpWindowOpen already requires effective_status === "SCHEDULED",
          // so CANCELLED events (isCancelled above) never reach this branch —
          // they keep their existing red-tint treatment untouched instead.
          <Text style={[styles.rsvpText, themed.rsvpPromptText]}>Please RSVP now.</Text>
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
  announcementMarker: {
    position: "absolute",
    top: 12,
    right: 12,
  },
});
