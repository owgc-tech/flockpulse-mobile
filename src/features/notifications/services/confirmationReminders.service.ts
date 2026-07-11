import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { listPendingConfirmations } from "@/src/features/confirmations/services/confirmations.service";
import type { NotificationDataPayload } from "@/src/features/notifications/types";

const LAST_CHECKED_KEY = "confirmations_last_checked_at";
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// FP-98, revised design: local notifications can't run code at the literal
// moment of delivery, so there's no reliable way to precompute "will there
// be confirmations pending" ahead of time per event (the original per-event
// end_datetime + attendance_window_hours scheduling this replaced). Instead:
// on every reconciliation pass (same call site as before — app open / list
// refresh), throttled to once per 6 hours via a timestamp in AsyncStorage
// (non-sensitive, doesn't need SecureStore), actually call
// GET /api/confirmations/pending live. That endpoint already scopes
// Leader-vs-Admin correctly server-side, so no client-side role/roster
// logic is needed here at all — a non-Leader/Admin account gets a 403,
// handled the same as "nothing pending" below. If anything comes back,
// fire an immediate notification right then rather than scheduling one for
// a precomputed future time.
export async function reconcileConfirmationReminders(): Promise<void> {
  const lastCheckedRaw = await AsyncStorage.getItem(LAST_CHECKED_KEY);
  const lastChecked = lastCheckedRaw ? Number(lastCheckedRaw) : 0;
  const now = Date.now();

  if (now - lastChecked < CHECK_INTERVAL_MS) {
    return;
  }

  try {
    const pending = await listPendingConfirmations();
    if (pending.length > 0) {
      const data: NotificationDataPayload = { type: "confirmation" };
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Confirmations",
          body: "You may have confirmations to review.",
          data: data as unknown as Record<string, unknown>,
        },
        trigger: null, // null trigger = present immediately, not scheduled ahead
      });
    }
  } catch {
    // Covers the expected 403 for non-Leader/Admin accounts as well as any
    // transient failure — either way, treated the same as "checked, nothing
    // to report" rather than surfaced as an error from a background pass.
  } finally {
    // Recorded regardless of outcome (pending or not, succeeded or not) —
    // this is what makes the throttle actually throttle rather than
    // hammering the endpoint every app open for accounts that always 403.
    await AsyncStorage.setItem(LAST_CHECKED_KEY, String(now));
  }
}
