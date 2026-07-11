import type { MyEvent } from "@/src/features/events/types";
import type { ReminderOffset } from "@/src/features/notifications/types";
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

const OFFSET_MS: Record<ReminderOffset, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
};

interface PendingReminder {
  event: MyEvent;
  offset: ReminderOffset;
  fireDate: Date;
}

function computePendingReminders(events: MyEvent[]): PendingReminder[] {
  const now = Date.now();
  const pending: PendingReminder[] = [];

  for (const event of events) {
    // Declined events are excluded; not-responded and accepted are both
    // still reminded, per direct clarification. Only SCHEDULED events have
    // a meaningful "before it starts" reminder window.
    if (event.effective_status !== "SCHEDULED" || event.rsvp_status === "NO") {
      continue;
    }

    const startMs = new Date(event.start_datetime).getTime();
    (Object.keys(OFFSET_MS) as ReminderOffset[]).forEach((offset) => {
      const fireMs = startMs - OFFSET_MS[offset];
      if (fireMs > now) {
        pending.push({ event, offset, fireDate: new Date(fireMs) });
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
  const pending = computePendingReminders(events);
  const pendingIdentifiers = new Set(pending.map((p) => reminderIdentifier(p.event.id, p.offset)));

  const scheduledIdentifiers = await getAllScheduledReminderIdentifiers();
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));

  await Promise.all(toCancel.map((identifier) => cancelReminderByIdentifier(identifier)));

  await Promise.all(
    pending.map(async ({ event, offset, fireDate }) => {
      const context = await fetchReminderContext(event.id);
      const { title, body } = buildReminderContent(context);
      await scheduleReminder(event, offset, fireDate, title, body);
    })
  );
}
