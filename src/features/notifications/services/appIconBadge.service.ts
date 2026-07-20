import * as Notifications from "expo-notifications";

// DIP-FP-119-mobile: Notifications.setBadgeCountAsync() sets the OS app icon
// badge to an absolute number, not additive. Confirmations (FP-99),
// Self-Report (DIP-FP-119-mobile), and My Tasks (DIP-FP-164) are three
// independent count sources feeding the same single OS badge — if each
// called setBadgeCountAsync directly with only its own count, whichever
// synced last would silently overwrite the others' contributions. This
// module is the sole caller of setBadgeCountAsync: each source reports its
// own latest count in, and every call recomputes the OS badge as the sum
// of the latest known count from all three sources.
let confirmationCount = 0;
let selfReportCount = 0;
let myTasksCount = 0;

export async function reportConfirmationBadgeCount(count: number): Promise<void> {
  confirmationCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount);
}

export async function reportSelfReportBadgeCount(count: number): Promise<void> {
  selfReportCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount);
}

export async function reportMyTasksBadgeCount(count: number): Promise<void> {
  myTasksCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount);
}
