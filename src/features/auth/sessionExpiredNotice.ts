// FP-230: a plain module-level singleton (same pattern as
// eventListRefreshSignal.ts / pendingNotificationSignal.ts) — a one-time
// "check-and-consume" read. expireSession() sets it just before signing the
// user out; the login screen consumes it on mount so the message shows once.
let pending = false;

export const SESSION_EXPIRED_MESSAGE = "Your session has ended. Please sign in again.";

export function setSessionExpiredNotice(): void {
  pending = true;
}

export function consumeSessionExpiredNotice(): boolean {
  const wasPending = pending;
  pending = false;
  return wasPending;
}
