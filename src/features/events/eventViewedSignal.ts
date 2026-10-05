// FP-222-mobile: same module-level singleton pattern as eventListRefreshSignal.ts
// (a one-time "check-and-consume on focus" read, not reactive shared state).
//
// The event detail screen records a view for the member (POST /api/events/:id/view)
// and, once that succeeds, tells the My Events list which events were just seen.
// The list consumes these ids when it regains focus and drops each card's
// Recently Modified strip and "Changed:" labels in memory — no network call and
// no pull-to-refresh needed. Needs Attention is unaffected by viewing.
const viewedEventIds = new Set<string>();

export function notifyEventViewed(eventId: string): void {
  viewedEventIds.add(eventId);
}

export function consumeViewedEventIds(): string[] {
  const ids = [...viewedEventIds];
  viewedEventIds.clear();
  return ids;
}
