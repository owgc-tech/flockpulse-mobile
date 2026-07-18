import type { MyEvent } from "@/src/features/events/types";
import {
  cancelReminderByIdentifier,
  getAllScheduledReminderIdentifiers,
  reminderIdentifier,
  scheduleReminder,
} from "@/src/features/notifications/services/notifications.service";
import {
  buildReminderContent,
  fetchReminderContext,
} from "@/src/features/notifications/services/reminderContent.service";
import {
  getReminderOffsetHours,
  type ReminderOffsetHours,
} from "@/src/features/notifications/services/reminderSettings.service";

const HOURS_MS = 60 * 60 * 1000;

interface PendingReminder {
  event: MyEvent;
  hours: number;
  fireDate: Date;
}

function computePendingReminders(events: MyEvent[], offsetHours: ReminderOffsetHours): PendingReminder[] {
  const now = Date.now();
  const pending: PendingReminder[] = [];
  const hoursList = [offsetHours.slot1Hours, offsetHours.slot2Hours];

  for (const event of events) {
    // Declined events are excluded; not-responded and accepted are both
    // still reminded, per direct clarification. Only SCHEDULED events have
    // a meaningful "before it starts" reminder window.
    if (event.effective_status !== "SCHEDULED" || event.rsvp_status === "NO") {
      continue;
    }

    const startMs = new Date(event.start_datetime).getTime();
    hoursList.forEach((hours) => {
      const fireMs = startMs - hours * HOURS_MS;
      if (fireMs > now) {
        pending.push({ event, hours, fireDate: new Date(fireMs) });
      }
    });
  }

  return pending;
}

// Called every time the events list loads or refreshes (initial mount + pull-
// to-refresh). Re-derives the full "should be scheduled" set from scratch and
// reconciles against whatever's currently scheduled on-device — this is what
// keeps content "fresh as of the last app open," since there's no OS
// mechanism to rewrite already-scheduled local notification content at the
// literal instant of delivery (see DIP Grounding Check).
export async function reconcileEventReminders(events: MyEvent[]): Promise<void> {
  const offsetHours = await getReminderOffsetHours();
  const pending = computePendingReminders(events, offsetHours);
  const pendingIdentifiers = new Set(pending.map((p) => reminderIdentifier(p.event.id, p.hours)));

  const scheduledIdentifiers = await getAllScheduledReminderIdentifiers();
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));

  await Promise.all(toCancel.map((identifier) => cancelReminderByIdentifier(identifier)));

  await Promise.all(
    pending.map(async ({ event, hours, fireDate }) => {
      const context = await fetchReminderContext(event.id);
      const { title, body } = buildReminderContent(context);
      await scheduleReminder(event, hours, fireDate, title, body);
    })
  );
}
