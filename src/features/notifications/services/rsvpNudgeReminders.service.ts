import type { MyEvent } from "@/src/features/events/types";
import { fetchTenantSettings } from "@/src/features/tenant/services/tenant.service";
import {
  cancelReminderByIdentifier,
  getAllScheduledNudgeIdentifiers,
  nudgeIdentifier,
  scheduleNudge,
} from "@/src/features/notifications/services/notifications.service";

const DAY_MS = 24 * 60 * 60 * 1000;

interface PendingNudge {
  event: MyEvent;
  offsetDays: number;
  fireDate: Date;
}

// FP-134: up to 3 nudges per event, anchored to rsvp_closure_at (not
// start_datetime — see reminders.service.ts for the analogous "before it
// starts" anchor those use instead) at the tenant's configured day-offsets.
// Only members who still haven't responded to a still-open, SCHEDULED event
// get nudges — mirrors reconcileEventReminders' rsvp_status filtering, but
// on rsvp_status === null specifically (not "not NO") since a nudge to
// respond is meaningless once any response, YES or NO, is already in.
function computePendingNudges(events: MyEvent[], offsetsDays: number[]): PendingNudge[] {
  const now = Date.now();
  const pending: PendingNudge[] = [];

  for (const event of events) {
    if (event.effective_status !== "SCHEDULED" || event.rsvp_status !== null) {
      continue;
    }

    const closureMs = new Date(event.rsvp_closure_at).getTime();
    if (closureMs <= now) {
      continue;
    }

    for (const offsetDays of offsetsDays) {
      const fireMs = closureMs - offsetDays * DAY_MS;
      if (fireMs > now) {
        pending.push({ event, offsetDays, fireDate: new Date(fireMs) });
      }
    }
  }

  return pending;
}

// Called alongside reconcileEventReminders/reconcileSelfReportReminders at
// every existing reconciliation call site (events list load, create,
// edit) — same recompute-full-set-then-diff-against-on-device shape, so an
// RSVP submitted elsewhere or an event edited into/out of window naturally
// cancels or reschedules the right nudges on the next pass.
export async function reconcileRsvpNudges(events: MyEvent[]): Promise<void> {
  const settings = await fetchTenantSettings();
  const offsetsDays = [settings.rsvp_nudge_days_1, settings.rsvp_nudge_days_2, settings.rsvp_nudge_days_3];

  const pending = computePendingNudges(events, offsetsDays);
  const pendingIdentifiers = new Set(pending.map((p) => nudgeIdentifier(p.event.id, p.offsetDays)));

  const scheduledIdentifiers = await getAllScheduledNudgeIdentifiers();
  const toCancel = scheduledIdentifiers.filter((id) => !pendingIdentifiers.has(id));

  await Promise.all(toCancel.map((identifier) => cancelReminderByIdentifier(identifier)));

  await Promise.all(pending.map(({ event, offsetDays, fireDate }) => scheduleNudge(event, offsetDays, fireDate)));
}
