import * as Notifications from "expo-notifications";
import { listPendingConfirmations } from "@/src/features/confirmations/services/confirmations.service";
import { setConfirmationBadgeCount } from "@/src/features/notifications/hooks/useConfirmationBadgeCount";

// FP-99: Leader/Admin-tier pending-confirmation count, synced to both the
// OS app icon badge (setBadgeCountAsync — visible even with the app closed)
// and, via the module-level store in useConfirmationBadgeCount, the in-app
// Confirmations tab badge. Any failure — including the expected 403 for a
// Member account (the Confirmations tab is already hidden for Members, but
// this is called unconditionally by anything that doesn't know that) — is
// treated as zero, same defensive pattern as
// confirmationReminders.service.ts's reconcile pass. Unlike that 6-hour-
// throttled reminder check, this is deliberately not throttled: a badge
// update is silent (no user-facing interruption), so there's no spam risk
// running it on every app open/foreground.
export async function syncConfirmationBadge(): Promise<number> {
  let count = 0;
  try {
    const pending = await listPendingConfirmations();
    count = pending.length;
  } catch {
    count = 0;
  }

  await Notifications.setBadgeCountAsync(count);
  setConfirmationBadgeCount(count);
  return count;
}
