import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANDROID_CHANNEL_ID } from "@/src/features/notifications/services/notifications.service";
import type { MyEvent } from "@/src/features/events/types";
import type { NotificationDataPayload } from "@/src/features/notifications/types";

const SELF_REPORT_PREFIX = "selfreport-";

function selfReportIdentifier(eventId: string): string {
  return `${SELF_REPORT_PREFIX}${eventId}`;
}

// FP-97: fires once, right when the self-report window opens (end_datetime —
// COMPLETED begins exactly there, confirmed against get_event_effective_status).
// Deliberately NOT filtered by rsvp_status, unlike FP-96's reminders — the
// backend's own eligibility check (isExpectedAttendee) only looks at
// event_attendees membership, never RSVP (Grounding Check).
export async function reconcileSelfReportReminders(events: MyEvent[]): Promise<void> {
  const now = Date.now();

  // Only SCHEDULED/ACTIVE events have a meaningful future end_datetime to
  // schedule against. Once an event actually completes it drops out of
  // /api/events/mine entirely, so this has to be scheduled proactively
  // while the event is still visible — there's no later chance to revisit it.
  //
  // DIP-FP-216-mobile: Announcement-type events never get a self-report
  // reminder — the "Did you attend?" prompt is meaningless for them. Same
  // exclusion check announcementReminders.service.ts already uses. Excluding
  // them from `pending` also means the toCancel logic below cancels any
  // stale reminder scheduled for an Announcement before this fix.
  const pending = events.filter(
    (event) =>
      event.event_type?.system_key !== "ANNOUNCEMENT" &&
      (event.effective_status === "SCHEDULED" || event.effective_status === "ACTIVE") &&
      new Date(event.end_datetime).getTime() > now
  );
  const pendingIdentifiers = new Set(pending.map((event) => selfReportIdentifier(event.id)));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIdentifiers = scheduled
    .map((request) => request.identifier)
    .filter((id) => id.startsWith(SELF_REPORT_PREFIX));

  // Naturally covers "cancel if the event becomes CANCELLED" — a cancelled
  // event drops out of `pending` (not SCHEDULED/ACTIVE), so its identifier
  // falls out of pendingIdentifiers and gets cancelled here, no special case.
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));
  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  await Promise.all(
    pending.map(async (event) => {
      const data: NotificationDataPayload = {
        type: "self-report",
        eventId: event.id,
        event: JSON.stringify(event),
      };

      await Notifications.scheduleNotificationAsync({
        identifier: selfReportIdentifier(event.id),
        content: {
          title: event.name,
          body: "Did you attend? Let us know how it went.",
          data: data as unknown as Record<string, unknown>,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(event.end_datetime),
          ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      });
    })
  );
}
