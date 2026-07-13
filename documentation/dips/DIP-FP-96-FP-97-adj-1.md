Mobile repo (`owgc-tech/flockpulse-mobile`) — two fixes together
Branch: `feature/FP-96-FP-97-adj-1-reminder-and-role-refresh`
Fix 1 — self-report reminder never fires for newly created/edited events. Root cause: `index.tsx`'s mount effect (where `reconcileSelfReportReminders` runs) deliberately doesn't refetch on focus, so an event created or edited via `create.tsx`/`edit.tsx` and then `router.back()`'d to My Events never triggers reconciliation again until a cold app relaunch or manual pull-to-refresh.
Fix: in both `app/(app)/events/create.tsx` (after `publishEvent()` succeeds) and `app/(app)/events/[id]/edit.tsx` (after `updateEvent()` succeeds), before `router.back()`, fetch the full events list and reconcile all three:
```ts
const freshEvents = await listMyEvents();
reconcileEventReminders(freshEvents).catch((err) => console.warn("Failed to reconcile event reminders:", err));
reconcileSelfReportReminders(freshEvents).catch((err) => console.warn("Failed to reconcile self-report reminders:", err));
reconcileConfirmationReminders().catch((err) => console.warn("Failed to reconcile confirmation reminders:", err));
router.back();
```
Important: must pass the full fetched list, not just the one event just created/edited — both `reconcileEventReminders` and `reconcileSelfReportReminders` cancel any already-scheduled reminder whose identifier isn't in the list you give them, so a single-event array would wrongly cancel every other event's reminders.
Fix 2 — Profile Card role doesn't reflect a role change made on web. In `src/features/profile/components/Avatar.tsx`, force a session refresh when the card opens, so it doesn't wait for the natural token-refresh cycle:
```ts
import { supabase } from "@/src/lib/supabase";

const handleOpenProfile = () => {
  setIsOpen(true);
  supabase.auth.refreshSession().catch(() => {
    // Best-effort — if this fails, the card still shows whatever role
    // is in the current session; no need to block opening over it.
  });
};
```
Wire this in place of the current inline `onPress={() => setIsOpen(true)}` on the avatar `Pressable`. No other change needed — `useSession()` already listens for `TOKEN_REFRESHED` and will update `session.user.app_metadata.role` reactively once the refresh resolves.
Run `npx tsc --noEmit`, show the full diff for all three files (`create.tsx`, `edit.tsx`, `Avatar.tsx`). Save as `documentation/dips/DIP-FP-96-FP-97-adj-1.md`, commit `FP-96-FP-97-adj-1: fix self-report reminder scheduling on create/edit, force session refresh on Profile Card open`, push, open PR against `dev`. Don't merge — you merge after I review, then test on-device via Expo Go. Note the web PR needs to merge and be live on dev before the mobile role-refresh fix will show anything different — the mobile fix only fetches a fresh JWT faster, it doesn't fix the underlying sync gap by itself.
