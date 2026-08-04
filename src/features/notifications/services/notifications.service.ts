import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { MyEvent } from "@/src/features/events/types";
import type { NotificationDataPayload } from "@/src/features/notifications/types";

const REMINDER_PREFIX = "reminder-";
// DIP-FP-132-FP-133-FP-134
const NUDGE_PREFIX = "nudge-";
// DIP-FP-191-mobile
const ANNOUNCEMENT_REMINDER_PREFIX = "announcement-reminder-";
// Exported so FP-97/98's selfReportReminders/confirmationReminders services
// schedule on the same Android channel this module's ensureNotificationSetup()
// already creates once, rather than duplicating the literal string.
export const ANDROID_CHANNEL_ID = "event-reminders";

let handlerConfigured = false;

// Exported so reminders.service.ts can compute the "should be scheduled"
// identifier set with the exact same format used when actually scheduling —
// one source of truth for the identifier shape.
export function reminderIdentifier(eventId: string, hours: number): string {
  return `${REMINDER_PREFIX}${eventId}-${hours}h`;
}

// Called once (events list screen mount). Requests permission if not already
// granted/denied, creates the Android 8+ channel notifications silently fail
// without, and configures foreground display — all one-time setup that has
// to happen before any scheduleNotificationAsync call.
export async function ensureNotificationSetup(): Promise<void> {
  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Event Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function scheduleReminder(
  event: MyEvent,
  hours: number,
  fireDate: Date,
  title: string,
  body: string
): Promise<void> {
  const data: NotificationDataPayload = { type: "reminder", eventId: event.id, event: JSON.stringify(event) };

  await Notifications.scheduleNotificationAsync({
    // Deterministic identifier: re-scheduling with the same identifier
    // replaces the existing request rather than duplicating it (standard
    // expo-notifications behavior) — this is what keeps reconciliation
    // idempotent across repeated app opens.
    identifier: reminderIdentifier(event.id, hours),
    content: { title, body, data: data as unknown as Record<string, unknown> },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function cancelReminder(eventId: string, hours: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(eventId, hours));
}

export async function cancelReminderByIdentifier(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function getAllScheduledReminderIdentifiers(): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((request) => request.identifier).filter((id) => id.startsWith(REMINDER_PREFIX));
}

// DIP-FP-132-FP-133-FP-134: FP-134's RSVP nudges — up to 3 per event at
// tenant-configured day-offsets before rsvp_closure_at. Same deterministic-
// identifier/reconciliation model as reminders above, kept as separate
// prefixed functions (rather than generalizing reminderIdentifier/
// scheduleReminder) since nudges key off days before rsvp_closure_at, a
// different anchor point than reminders' hours-before-start_datetime.
export function nudgeIdentifier(eventId: string, offsetDays: number): string {
  return `${NUDGE_PREFIX}${eventId}-${offsetDays}`;
}

export async function scheduleNudge(event: MyEvent, offsetDays: number, fireDate: Date): Promise<void> {
  const data: NotificationDataPayload = { type: "rsvp-nudge", eventId: event.id, event: JSON.stringify(event) };

  await Notifications.scheduleNotificationAsync({
    identifier: nudgeIdentifier(event.id, offsetDays),
    content: {
      title: "Please RSVP",
      body: `Please respond to your RSVP for ${event.name}.`,
      data: data as unknown as Record<string, unknown>,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function getAllScheduledNudgeIdentifiers(): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((request) => request.identifier).filter((id) => id.startsWith(NUDGE_PREFIX));
}

// DIP-FP-191-mobile: two reminders per Announcement at user-configurable
// hour offsets before end_datetime — structurally the same "N reminders at
// configurable offsets before a datetime" shape as reminderIdentifier/
// scheduleReminder above (reminders.service.ts's RSVP pre-event reminders),
// not selfReportReminders.service.ts's single fixed-time notification (that
// file has no offset/preference concept at all). Kept as separate prefixed
// functions rather than generalizing the existing ones, same reasoning as
// nudgeIdentifier/scheduleNudge above — a different anchor point
// (end_datetime, not start_datetime) and a different, independently
// user-configurable preference (see reminderSettings.service.ts).
export function announcementReminderIdentifier(eventId: string, hours: number): string {
  return `${ANNOUNCEMENT_REMINDER_PREFIX}${eventId}-${hours}h`;
}

export async function scheduleAnnouncementReminder(
  event: MyEvent,
  hours: number,
  fireDate: Date
): Promise<void> {
  const data: NotificationDataPayload = { type: "announcement", eventId: event.id, event: JSON.stringify(event) };

  await Notifications.scheduleNotificationAsync({
    identifier: announcementReminderIdentifier(event.id, hours),
    content: {
      // Notification banners show only the title (OS-level limit, not a
      // product choice) — tapping deep-links into the event detail screen
      // where the full announcement_body is rendered.
      title: event.name,
      body: "Tap to read and acknowledge this announcement.",
      data: data as unknown as Record<string, unknown>,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function getAllScheduledAnnouncementReminderIdentifiers(): Promise<string[]> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((request) => request.identifier).filter((id) => id.startsWith(ANNOUNCEMENT_REMINDER_PREFIX));
}
