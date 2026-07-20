import * as Notifications from "expo-notifications";

// DIP-FP-119-mobile: Notifications.setBadgeCountAsync() sets the OS app icon
// badge to an absolute number, not additive. Confirmations (FP-99),
// Self-Report (DIP-FP-119-mobile), My Tasks (DIP-FP-164), and My Events
// (DIP-FP-165) are four independent count sources feeding the same single
// OS badge — if each called setBadgeCountAsync directly with only its own
// count, whichever synced last would silently overwrite the others'
// contributions. This module is the sole caller of setBadgeCountAsync: each
// source reports its own latest count in, and every call recomputes the OS
// badge as the sum of the latest known count from all four sources.
let confirmationCount = 0;
let selfReportCount = 0;
let myTasksCount = 0;
let myEventsCount = 0;

export async function reportConfirmationBadgeCount(count: number): Promise<void> {
  confirmationCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount + myEventsCount);
}

export async function reportSelfReportBadgeCount(count: number): Promise<void> {
  selfReportCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount + myEventsCount);
}

export async function reportMyTasksBadgeCount(count: number): Promise<void> {
  myTasksCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount + myEventsCount);
}

export async function reportMyEventsBadgeCount(count: number): Promise<void> {
  myEventsCount = count;
  await Notifications.setBadgeCountAsync(confirmationCount + selfReportCount + myTasksCount + myEventsCount);
}
