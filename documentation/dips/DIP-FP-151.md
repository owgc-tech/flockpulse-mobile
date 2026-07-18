DIP-FP-151.md
Story Summary
Fixes two related staleness gaps, both scoped precisely per Joseph's explicit direction: no blanket refetch-on-focus, no loading blink, only the specific record that actually changed updates, silently. (1) The My Events list doesn't reflect the member's own event edits or RSVP changes until a manual pull. (2) Event Detail's Roster/Invitees section doesn't reflect the member's own just-submitted RSVP either, even though the refresh mechanism for it already exists and works for pull-to-refresh — it's just never triggered by the RSVP submission itself.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

My Events list ((tabs)/index.tsx) fetches only on mount, by deliberate design (documented: avoids a full-screen loading blink on casual tab switches). Confirmed this is the right behavior to preserve, not remove — Joseph explicitly does not want it reintroduced.
[id].tsx already has its own useFocusEffect silently refetching via getEventById() on every focus, specifically to catch "returned here after editing elsewhere" — this already works correctly for most fields. But its own comment confirms getEventById() cannot return rsvp_status/rsvp_reason at all — which is exactly why handleSubmit updates those two fields via a separate, direct local state update (onEventChange) instead of relying on that refetch. This is also why a naive "refetch each visible event on list focus" approach wouldn't even solve Joseph's RSVP complaint — the field simply isn't returned by that endpoint. Confirms the list needs a different mechanism specifically for RSVP-originated changes, not just a generic per-event refetch.
A genuinely useful discovery: the Edit screen (events/[id]/edit.tsx) already calls listMyEvents() immediately after a successful save — today, purely to feed reminder reconciliation (reconcileEventReminders, etc.), then the result is discarded. This is the exact same data shape (MyEvent[]) the My Events list itself needs — reusing it means the list-refresh fix adds zero new network cost for the Edit path, since that fetch was already happening.
Design decision: rather than building a field-level "patch just this one card" mechanism (which would need different shapes for the Edit case vs. the RSVP case), this DIP uses one simple, consistent mechanism for both: a small in-memory module-level signal (not a React Context — this is a one-time "check-and-consume on focus" read, not continuously-reactive shared state like FP-145's theme preference, so a plain module singleton is the better, simpler fit) that holds a pending fresh MyEvent[] list. Whoever successfully changes an event calls listMyEvents() (already happening for Edit; a new fire-and-forget call for RSVP, not blocking the submit's own immediate UI feedback) and hands the result to this signal. The list consumes it via useFocusEffect, replacing its own events state directly — no loading indicator touched at all, since the data's already in hand by the time focus fires.
Roster fix: rosterRefreshTrigger/setRosterRefreshTrigger (in [id].tsx) already exists and is correctly wired to pull-to-refresh (handleRefresh) — simply never called from handleSubmit. One additional call closes this gap, reusing the exact same mechanism.
Stale comment: handleSubmit's existing comment ("the list screen re-fetches on focus... only needs to stay correct for the current mount of this screen") is factually wrong today and becomes accurate only once this DIP's fix lands — corrected to describe the actual mechanism.
Domain rules: no conflict — client-side data-freshness fix only, no new data or write paths.

Implementation Plan

New file src/features/events/eventListRefreshSignal.ts: a plain module-level variable holding MyEvent[] | null, with notifyEventsRefreshed(events: MyEvent[]) (setter) and consumePendingEventsRefresh(): MyEvent[] | null (get-and-clear).
app/(app)/events/[id]/edit.tsx: immediately after the existing const freshEvents = await listMyEvents(); line, add notifyEventsRefreshed(freshEvents) — reuses data already being fetched, no new network call.
app/(app)/events/[id].tsx:

Import listMyEvents (not currently imported) and notifyEventsRefreshed.
In handleSubmit (RSVP submit), after the existing onEventChange(...) call: fire-and-forget listMyEvents().then(notifyEventsRefreshed).catch((err) => console.warn(...)) — a new network call, but non-blocking and after the member's own screen already has immediate local feedback via onEventChange.
Also in handleSubmit: add setRosterRefreshTrigger((t) => t + 1), reusing the existing trigger already wired to handleRefresh.
Correct the now-stale comment explaining why the list wasn't updated beyond the local screen — update it to describe the actual signal-based fix instead.


app/(app)/(tabs)/index.tsx: import useFocusEffect (from expo-router, matching [id].tsx's existing import source) and consumePendingEventsRefresh. Add a useFocusEffect that calls consumePendingEventsRefresh() and, if non-null, calls setEvents(fresh) directly — no loading state touched, no loadEvents() call, purely a background state swap.

Files to Create/Modify

src/features/events/eventListRefreshSignal.ts (new)
app/(app)/events/[id]/edit.tsx
app/(app)/events/[id].tsx
app/(app)/(tabs)/index.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-151-targeted-event-refresh-on-return
Commit Message
FP-151: My Events list and Event Detail roster reflect the member's own changes without pull-to-refresh
Pull Request Description
Maps to acceptance criteria:

"Only the modified record updates, no full-list refetch, no blink" → signal-based adoption of an already-fetched fresh list, no loading indicator touched.
"Casual tab-switching causes no visible update, no unnecessary network call" → the signal is empty (null) unless something actually changed; consuming it is a cheap in-memory check, not a fetch.
"Roster reflects the member's own new RSVP without pulling" → setRosterRefreshTrigger now also called from handleSubmit.
"Stale cross-file comment corrected" → handleSubmit's comment updated to match the actual fix.

Jira Linkage

PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
PDEStoryID: FP-151

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-151.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for every file in the completion report.
