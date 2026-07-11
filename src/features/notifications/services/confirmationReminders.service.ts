import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ANDROID_CHANNEL_ID } from "@/src/features/notifications/services/notifications.service";
import { getEventRoster } from "@/src/features/events/services/events.service";
import { fetchAttendanceWindowHours } from "@/src/features/tenant/services/tenant.service";
import type { MyEvent } from "@/src/features/events/types";
import type { NotificationDataPayload } from "@/src/features/notifications/types";

const CONFIRMATION_PREFIX = "confirmation-";

function confirmationIdentifier(eventId: string): string {
  return `${CONFIRMATION_PREFIX}${eventId}`;
}

// FP-98: scoped to LEADER only (Admins have full tenant-wide confirmation
// access anytime already — Grounding Check). Fires at end_datetime +
// attendance_window_hours, i.e. once the self-report window actually closes
// — not at end_datetime, which would be before any member could have
// self-reported yet. A deliberate correction to the epic's literal wording.
export async function reconcileConfirmationReminders(
  events: MyEvent[],
  role: string | undefined
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIdentifiers = scheduled
    .map((request) => request.identifier)
    .filter((id) => id.startsWith(CONFIRMATION_PREFIX));

  if (role !== "LEADER") {
    // Not a Leader: nothing should be scheduled. Also cancels anything left
    // over from a prior session where this account did hold the Leader role.
    await Promise.all(scheduledIdentifiers.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    return;
  }

  const now = Date.now();
  const attendanceWindowHours = await fetchAttendanceWindowHours();
  const windowMs = attendanceWindowHours * 60 * 60 * 1000;

  const candidates = events.filter(
    (event) => event.effective_status === "SCHEDULED" || event.effective_status === "ACTIVE"
  );

  const pending: { event: MyEvent; fireDate: Date }[] = [];
  for (const event of candidates) {
    const fireMs = new Date(event.end_datetime).getTime() + windowMs;
    if (fireMs <= now) continue;

    // Eligibility reuses the existing FP-95 roster endpoint: called as the
    // Leader, a non-empty result means they have at least one assigned
    // member expected at this event. No new logic, no new endpoint.
    try {
      const roster = await getEventRoster(event.id);
      if (roster.length > 0) {
        pending.push({ event, fireDate: new Date(fireMs) });
      }
    } catch {
      // Skip scheduling for this event rather than failing the whole
      // reconciliation pass over one event's roster fetch failing.
    }
  }

  const pendingIdentifiers = new Set(pending.map((p) => confirmationIdentifier(p.event.id)));
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));
  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));

  await Promise.all(
    pending.map(async ({ event, fireDate }) => {
      // Deliberately generic, not a live count — the same "no OS mechanism
      // to fetch fresh content at delivery time" constraint from FP-96
      // applies here too, doubly so since the true count can only be known
      // by querying confirmations/pending fresh, which the tap-through
      // screen does for real.
      const data: NotificationDataPayload = { type: "confirmation" };

      await Notifications.scheduleNotificationAsync({
        identifier: confirmationIdentifier(event.id),
        content: {
          title: "Confirmations",
          body: "You may have confirmations to review.",
          data: data as unknown as Record<string, unknown>,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
        },
      });
    })
  );
}
