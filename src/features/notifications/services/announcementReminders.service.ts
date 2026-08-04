import type { MyEvent } from "@/src/features/events/types";
import {
  cancelReminderByIdentifier,
  announcementReminderIdentifier,
  getAllScheduledAnnouncementReminderIdentifiers,
  scheduleAnnouncementReminder,
} from "@/src/features/notifications/services/notifications.service";
import {
  getAnnouncementReminderOffsetHours,
  type ReminderOffsetHours,
} from "@/src/features/notifications/services/reminderSettings.service";

const HOURS_MS = 60 * 60 * 1000;

interface PendingAnnouncementReminder {
  event: MyEvent;
  hours: number;
  fireDate: Date;
}

// DIP-FP-191-mobile: two reminders per Announcement, anchored to
// end_datetime (the acknowledgement deadline) — same "N reminders at
// configurable offsets before a datetime" shape as reminders.service.ts's
// computePendingReminders (there: start_datetime), not
// selfReportReminders.service.ts's single fixed-time notification. Only
// SCHEDULED/ACTIVE events have a meaningful future end_datetime to schedule
// against — once an Announcement actually completes it may still be
// pending acknowledgement (getPendingSelfReports includes COMPLETED/LOCKED
// for the badge), but there's no further reminder to schedule for a
// deadline that's already passed.
function computePendingAnnouncementReminders(
  events: MyEvent[],
  offsetHours: ReminderOffsetHours
): PendingAnnouncementReminder[] {
  const now = Date.now();
  const pending: PendingAnnouncementReminder[] = [];
  const hoursList = [offsetHours.slot1Hours, offsetHours.slot2Hours];

  for (const event of events) {
    if (
      event.event_type?.system_key !== "ANNOUNCEMENT" ||
      (event.effective_status !== "SCHEDULED" && event.effective_status !== "ACTIVE")
    ) {
      continue;
    }

    const endMs = new Date(event.end_datetime).getTime();
    hoursList.forEach((hours) => {
      const fireMs = endMs - hours * HOURS_MS;
      if (fireMs > now) {
        pending.push({ event, hours, fireDate: new Date(fireMs) });
      }
    });
  }

  return pending;
}

// Called alongside reconcileEventReminders/reconcileSelfReportReminders at
// the same reconciliation call site (My Events list load/pull-to-refresh) —
// same recompute-full-set-then-diff-against-on-device shape, so an
// Announcement edited into/out of window, or acknowledged early, naturally
// reschedules or cancels the right reminders on the next pass.
export async function reconcileAnnouncementReminders(events: MyEvent[]): Promise<void> {
  const offsetHours = await getAnnouncementReminderOffsetHours();
  const pending = computePendingAnnouncementReminders(events, offsetHours);
  const pendingIdentifiers = new Set(
    pending.map((p) => announcementReminderIdentifier(p.event.id, p.hours))
  );

  const scheduledIdentifiers = await getAllScheduledAnnouncementReminderIdentifiers();
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));

  await Promise.all(toCancel.map((identifier) => cancelReminderByIdentifier(identifier)));

  await Promise.all(
    pending.map(({ event, hours, fireDate }) => scheduleAnnouncementReminder(event, hours, fireDate))
  );
}
