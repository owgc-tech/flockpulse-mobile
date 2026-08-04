// Mirrors eventListRefreshSignal.ts's pattern (DIP-FP-151) — a plain
// module-level singleton for a one-time "check-and-consume on focus"
// handoff, not continuously-reactive state.
//
// DIP-FP-191-mobile addition (not in the DIP's original file list): the
// Check-In tab no longer acknowledges Announcements itself — per Joseph's
// direction, an Announcement row navigates to the event detail screen
// instead, and acknowledging happens there (My Events, the Check-In list,
// and a reminder tap all converge on that one Acknowledge action). Without
// this signal, an acknowledged Announcement would keep showing in the
// Check-In list until the next manual pull-to-refresh, since that screen
// only fetches on mount (no focus-refetch — see DIP-FP-164's grounding
// note on this same screen). The event detail screen hands the just-
// acknowledged event id here; the Check-In tab drops that row locally on
// its next focus, no network call, no loading blink.
let acknowledgedEventIds: Set<string> | null = null;

export function notifyAnnouncementAcknowledged(eventId: string): void {
  acknowledgedEventIds = acknowledgedEventIds ?? new Set();
  acknowledgedEventIds.add(eventId);
}

export function consumePendingAcknowledgements(): Set<string> | null {
  const ids = acknowledgedEventIds;
  acknowledgedEventIds = null;
  return ids;
}
