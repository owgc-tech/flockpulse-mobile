import type { MyEvent } from "@/src/features/events/types";

// DIP-FP-151: a plain module-level singleton, not a React Context — this is
// a one-time "check-and-consume on focus" read, not continuously-reactive
// shared state like FP-145's theme preference. Whoever successfully changes
// an event (Edit save, RSVP submit) hands its freshly-fetched list here; the
// My Events list consumes it on its next focus and swaps its state directly,
// with no loading indicator touched.
let pendingEvents: MyEvent[] | null = null;

export function notifyEventsRefreshed(events: MyEvent[]): void {
  pendingEvents = events;
}

export function consumePendingEventsRefresh(): MyEvent[] | null {
  const events = pendingEvents;
  pendingEvents = null;
  return events;
}
