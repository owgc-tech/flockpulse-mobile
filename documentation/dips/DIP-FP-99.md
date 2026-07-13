# DIP-FP-99

### Story Summary

Adds a purely client-side badge system to the mobile app: an OS-level app icon badge (visible even when the app is closed) and an in-app tab badge on the "Confirmations" nav item, both showing the Leader/Admin-tier viewer's pending-confirmation count, both refreshed on app open and app foreground. No backend involved — reuses the existing `GET /api/confirmations/pending` endpoint that's already wired up for FP-98's reminder check and the Confirmations tab itself.

### Repo Target

Mobile (Expo) — `owgc-tech/flockpulse-mobile`. Entirely client-side; no web repo changes.

### Grounding Check

* Fetched FP-99 live from Jira: parent epic is FP-31 (EPIC-8 — Notification System), status To Do, AC scopes this to Leader's pending-confirmation count only (Admin-invitations badge explicitly deferred as future extension, not in scope here).
* Confirmed live on dev: `expo-notifications ~0.32.17` already installed and configured — `ensureNotificationSetup()` already requests notification permissions and sets up the Android channel, so no new permission flow is needed; `setBadgeCountAsync`/`getBadgeCountAsync` are part of this same package, no new dependency.
* Confirmed `GET /api/confirmations/pending` (`listPendingConfirmations()`) already exists and already scopes Leader-vs-Admin correctly server-side (used today by both `confirmationReminders.service.ts` and the Confirmations tab screen) — no backend change needed.
* Confirmed the bottom-tabs `Tabs.Screen` (from FP-115, now merged to dev) supports React Navigation's `tabBarBadge` option — the direct mechanism for the in-app badge requirement.
* Confirmed an existing `AppState` foreground-listener precedent in `src/lib/supabase.ts` — following the same pattern here rather than introducing a new one.
* No Section 4 invariant rules touched (no RSVP/attendance/tenancy logic); no migrations, no atomicity, no cross-tenant concerns — nothing is written to the DB.
* Deliberate addition beyond the literal AC, flagging explicitly per Section 2: the badge is also refreshed immediately after a Leader confirms/rejects an item on the Confirmations screen itself (not just on open/foreground) — cheap, low-risk, and avoids a stale count sitting on the icon until the next foreground event. If you'd rather keep this strictly to the two AC-specified triggers, tell CC to drop that one call site.
* Distinct from FP-98's 6-hour-throttled reminder check: that throttle exists to avoid notification spam; a badge count update is silent (no user-facing interruption), so it's deliberately not throttled — it runs on every open/foreground.

### Implementation Plan

1. Add `syncConfirmationBadge()` to a new file, `src/features/notifications/services/confirmationBadge.service.ts` — calls `listPendingConfirmations()`, treats any failure (including the expected 403 for a Member account, though the tab is already hidden for Members) as zero, then calls `Notifications.setBadgeCountAsync(count)` for the OS icon badge, and returns the count.
2. In `app/(app)/(tabs)/_layout.tsx` (the one component that both knows the role-gate and owns the `Tabs.Screen` options): add local state for the pending count, call `syncConfirmationBadge()` on mount (gated on `showConfirmationsTab`), and subscribe to `AppState`'s `"change"` event to re-sync whenever the app becomes `"active"`.
3. Pass the resolved count into the Confirmations `Tabs.Screen`'s `tabBarBadge` option (`undefined` when zero, so no empty badge dot shows).
4. In `app/(app)/(tabs)/confirmations/index.tsx`'s `handleDecision`, call `syncConfirmationBadge()` again after a successful confirm/reject (see the flagged addition above) — but this needs a way to push the new count back up to `_layout.tsx`. Simplest option given no state library in this codebase: lift the "last synced count" into a small shared module-level store with a subscribe hook (a few lines, no new dependency), rather than prop-drilling through the tab navigator. Confirm with CC this is preferable to skipping the addition entirely.

### Files to Create/Modify

```
src/features/notifications/services/confirmationBadge.service.ts      (new)
src/features/notifications/hooks/useConfirmationBadgeCount.ts         (new, only if item 4 above is kept — small pub-sub hook)
app/(app)/(tabs)/_layout.tsx                                           (modified — AppState listener, badge state, tabBarBadge)
app/(app)/(tabs)/confirmations/index.tsx                               (modified — re-sync call in handleDecision, only if item 4 is kept)
```

### Migration Files

None — no backend/DB changes.

### Branch Name

`feature/FP-99-mobile-badges`

### Commit Message

`FP-99: add app icon and in-app tab badges for pending confirmations`

### Pull Request Description

Maps to FP-99's two ACs: (1) OS-level app icon badge showing the Leader/Admin's pending-confirmation count, refreshed on open/foreground via `AppState`; (2) in-app "Confirmations" tab badge showing the same count via `tabBarBadge`. Both reuse the existing `GET /api/confirmations/pending` endpoint — no backend changes. Notes the one addition beyond the literal AC (badge refresh after confirm/reject) for Atlas/Joseph's awareness during review.

### Jira Linkage

* PDEEpicID: FP-31
* PDEStoryID: FP-99

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-99.md` — no executor notes appended afterward; those go in the PR description only. Open the PR against `dev` and stop. Do not merge — I'll review the diff, then you merge yourself and test on-device via Expo Go (mobile testing doesn't need the merge-before-test web workflow, but merge authority is still yours, not CC's).
