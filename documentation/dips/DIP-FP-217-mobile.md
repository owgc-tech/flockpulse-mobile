### DIP — FP-217 (Mobile)

### Story Summary
Fixes notification taps intermittently failing to open the correct screen. Confirmed via code trace (not yet on-device, given the inherent difficulty of proving a timing race statically — real-device confirmation is required as part of this DIP's own testing, not optional): `navigateFromNotification()` fires `router.push()` targeting routes inside the `(app)` group unconditionally from the root layout — but `(app)` has its own async gate (session load, then a separate MFA check) that must reach `"ready"` before those routes can correctly render. If the push fires before that gate resolves, its own redirect logic can override or swallow the notification's intended destination — most likely on a cold launch, where the gate genuinely takes real async time.

### Repo Target
Mobile (Expo) — root layout, app-group layout, and a new small shared store.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Zero uses anywhere in this codebase of `useRootNavigationState()` or any navigator-readiness check — confirmed via full-repo search, not assumed absent.
- All three of `navigateFromNotification()`'s `router.push()` targets (`/(app)/confirmations`, `/(app)/(tabs)/self-report`, `/(app)/events/[id]`) are confirmed to live inside the `(app)` group specifically.
- `(app)/_layout.tsx`'s `Gate` type is confirmed exactly: `{ phase: "loading" | "redirect" | "ready" | "biometric-lock", ... }` — `"ready"` is the one, unambiguous signal that this group is actually safe to navigate into.
- `eventListRefreshSignal.ts`'s `notifyEventsRefreshed`/`consumePendingEventsRefresh` is the existing, proven module-level pending-signal pattern in this codebase — reused here rather than inventing a new mechanism for "store something now, consume it once a condition is met later."

### Implementation Plan
1. **New `src/features/notifications/pendingNotificationSignal.ts`**: mirroring `eventListRefreshSignal.ts`'s exact shape — a module-level singleton holding the last unconsumed `Notifications.NotificationResponse`, with `setPendingNotificationResponse()` and `consumePendingNotificationResponse()` (get-and-clear, same as the existing pattern).
2. **`app/_layout.tsx`**: `navigateFromNotification()` no longer calls `router.push()` directly. Instead, it calls the new store's setter with the response, deferring the actual routing decision. The existing `getLastNotificationResponse()` (cold-launch) and `addNotificationResponseReceivedListener()` (already-running) registrations stay exactly as they are — only what they *do* with a response changes, not how they're detected.
3. **`app/(app)/_layout.tsx`**: add a `useEffect` keyed on `gate.phase`. When (and only when) `gate.phase === "ready"`, consume the pending notification response (if any) and perform the actual routing dispatch — same type-based logic (`confirmation`/`self-report`/event-detail) that currently lives in `navigateFromNotification()`, moved here so it only ever fires once the group is genuinely ready to receive it.
4. No change to which route each notification type targets, or the type-dispatch logic itself — only *when* it's allowed to fire.

### Files to Create/Modify
- `src/features/notifications/pendingNotificationSignal.ts` (new)
- `app/_layout.tsx` (modify)
- `app/(app)/_layout.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-217-mobile-defer-notification-nav-until-gate-ready

### Commit Message
FP-217-mobile: defer notification-tap navigation until app gate is ready

### Pull Request Description
Maps to FP-217's acceptance criteria: notification-tap navigation now waits for `(app)`'s own gate to reach `"ready"` before firing, using a module-level pending-signal store mirroring the existing `eventListRefreshSignal.ts` pattern. No change to route targets or type-dispatch logic. **This cannot be confirmed by typecheck alone — report explicitly whether real-device testing was done**: force-quit the app fully, tap a notification to cold-launch it, repeat at least 5-10 times across varied conditions (fast reopen, slow network), looking for zero failures. A single successful attempt doesn't confirm a timing-race fix.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-217

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-217-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build with the repeated cold-launch protocol above, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
