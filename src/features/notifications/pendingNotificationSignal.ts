import type { NotificationResponse } from "expo-notifications";

// DIP-FP-217-mobile: mirrors eventListRefreshSignal.ts's module-level
// singleton pattern — a one-time "stash it now, consume it once a condition
// is met later" hand-off, not continuously-reactive shared state. A
// notification tap is detected in the root layout (app/_layout.tsx), but the
// screens it wants to open all live inside the (app) group, which isn't safe
// to navigate into until its own async gate (session load + MFA check)
// reaches "ready". So the tap's response is parked here and drained by
// app/(app)/_layout.tsx once that gate is ready.
//
// One addition over eventListRefreshSignal.ts's shape: an optional
// single-subscriber callback, invoked by the setter. It covers a live tap
// that arrives while the (app) gate is *already* "ready" — gate.phase never
// changes in that case, so a phase-keyed effect alone would leave the
// response sitting unconsumed until the next gate transition.
let pendingResponse: NotificationResponse | null = null;
let listener: (() => void) | null = null;

export function setPendingNotificationResponse(response: NotificationResponse): void {
  pendingResponse = response;
  listener?.();
}

export function consumePendingNotificationResponse(): NotificationResponse | null {
  const response = pendingResponse;
  pendingResponse = null;
  return response;
}

// Single-subscriber by design — there is exactly one consumer, (app)/_layout.
// Returns an unsubscribe function, same contract as expo-notifications' own
// addNotificationResponseReceivedListener().
export function subscribeToPendingNotification(fn: () => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}
