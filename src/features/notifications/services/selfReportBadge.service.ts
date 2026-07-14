import { listPendingSelfReports } from "@/src/features/self-reports/services/selfReports.service";
import { setSelfReportBadgeCount } from "@/src/features/notifications/hooks/useSelfReportBadgeCount";
import { reportSelfReportBadgeCount } from "@/src/features/notifications/services/appIconBadge.service";

// DIP-FP-119-mobile: mirrors confirmationBadge.service.ts's
// syncConfirmationBadge() pattern exactly — pending-self-report count,
// synced to both the in-app Self-Report tab badge (via the module-level
// store in useSelfReportBadgeCount) and, through appIconBadge.service.ts's
// combining layer, the OS app icon badge. Any failure is treated as zero,
// same defensive pattern as syncConfirmationBadge(). Not throttled, for the
// same reason: a badge update is silent, so there's no spam risk running it
// on every app open/foreground.
export async function syncSelfReportBadge(): Promise<number> {
  let count = 0;
  try {
    const pending = await listPendingSelfReports();
    count = pending.length;
  } catch {
    count = 0;
  }

  setSelfReportBadgeCount(count);
  await reportSelfReportBadgeCount(count);
  return count;
}
