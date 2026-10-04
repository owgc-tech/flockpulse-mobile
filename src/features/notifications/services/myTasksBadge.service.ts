import { listMyTaskAssignments } from "@/src/features/tasks/services/tasks.service";
import { setMyTasksBadgeCount } from "@/src/features/notifications/hooks/useMyTasksBadgeCount";
import { reportMyTasksBadgeCount } from "@/src/features/notifications/services/appIconBadge.service";

// DIP-FP-164: mirrors syncSelfReportBadge()'s pattern exactly — every
// currently-assigned My Task counts toward the badge (FP-221 narrowed this:
// only tasks with no Commit/Refuse response yet count). Synced to both the in-app My Tasks tab
// badge (via the module-level store in useMyTasksBadgeCount) and, through
// appIconBadge.service.ts's combining layer, the OS app icon badge. Any
// failure is treated as zero, same defensive pattern as the other two
// sync functions. Not throttled, for the same reason: a badge update is
// silent, so there's no spam risk running it on every app open/foreground.
export async function syncMyTasksBadge(): Promise<number> {
  let count = 0;
  try {
    const assignments = await listMyTaskAssignments();
    // FP-221: only tasks the person has not yet committed to or refused.
    // Loose == null on purpose: a row without the field counts as unanswered.
    count = assignments.filter((a) => a.my_response == null).length;
  } catch {
    count = 0;
  }

  setMyTasksBadgeCount(count);
  await reportMyTasksBadgeCount(count);
  return count;
}
