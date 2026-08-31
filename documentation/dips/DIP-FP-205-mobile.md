### Story Summary
Fixes the Events tab not showing a newly-created event until manual pull-to-refresh — the same root pattern as FP-204, a different screen. `create.tsx` already fetches a fresh events list on success for reminder reconciliation purposes; it just never hands that same data to the Events tab's refresh signal.

### Repo Target
Mobile (Expo) — single file.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- `create.tsx`'s success path already does `const freshEvents = await listMyEvents();`, then passes it to four reminder-reconciliation calls (`reconcileEventReminders`, `reconcileSelfReportReminders`, `reconcileRsvpNudges`) plus a fifth reconciliation call with no argument — confirmed this data is already fetched and available, no new network call needed.
- `notifyEventsRefreshed` is not imported or called anywhere in this file — confirmed via grep, not assumed.
- Same target mechanism as FP-204: `notifyEventsRefreshed()` (`eventListRefreshSignal.ts`), consumed by the Events tab's `useFocusEffect` with no loading indicator touched.

### Implementation Plan
1. **`create.tsx`**: import `notifyEventsRefreshed` from `@/src/features/events/eventListRefreshSignal`. Immediately after `const freshEvents = await listMyEvents();`, add `notifyEventsRefreshed(freshEvents);` — reusing the already-fetched variable, before or alongside the existing reconciliation calls (order doesn't matter, they're independent of each other).

### Files to Create/Modify
- `app/(app)/events/create.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-205-mobile-create-event-list-refresh

### Commit Message
FP-205-mobile: refresh Events tab after creating a new event

### Pull Request Description
Maps to FP-205's acceptance criteria: event creation now hands the Events tab a fresh list via the existing `notifyEventsRefreshed()` signal, reusing the `freshEvents` variable already fetched for reminder reconciliation — no new network call. Confirm in the PR this was tested on a real device: create a new event, return to the Events tab, confirm it appears immediately with no flicker and no manual refresh needed.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-205

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-205-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
