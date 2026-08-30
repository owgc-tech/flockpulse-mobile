### Story Summary
Fixes the Events tab not refreshing after acknowledging an Announcement. Confirmed root cause via direct code trace: the Announcement acknowledge handler only calls a signal (`notifyAnnouncementAcknowledged`) that the Events tab doesn't listen for — it was never wired into the tab's actual, already-working refresh mechanism (`notifyEventsRefreshed`, the same one RSVP and Edit Event already use successfully).

### Repo Target
Mobile (Expo) — single file.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- `eventListRefreshSignal.ts`'s `notifyEventsRefreshed(events: MyEvent[])` is the real, working mechanism — a plain module-level singleton, consumed once via `consumePendingEventsRefresh()` inside the Events tab's `useFocusEffect`, with no loading indicator touched (DIP-FP-151's own documented design).
- `events/[id].tsx`'s `handleAcknowledge()` currently calls `notifyAnnouncementAcknowledged(event.id)` only — confirmed via grep that the Events tab has zero references to this signal at all; it's consumed elsewhere (self-report screen), unrelated to this bug.
- `justAcknowledged`/`isAcknowledged` local state on the detail screen itself already updates correctly and immediately (confirmed via its own extensive inline documentation) — this bug is specifically about the *separate* Events tab screen, not the detail screen where the button was tapped.

### Implementation Plan
1. **`events/[id].tsx`**: in `handleAcknowledge()`, after `acknowledgeAnnouncement(event.id)` succeeds, also fetch the current Events list (same call the Events tab's own `loadEvents()` uses) and call `notifyEventsRefreshed()` with the result — mirroring exactly how RSVP/Edit Event's success paths already do this. Keep the existing `notifyAnnouncementAcknowledged()` call as-is; this is additive.

### Files to Create/Modify
- `app/(app)/events/[id].tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-204-mobile-announcement-ack-list-refresh

### Commit Message
FP-204-mobile: refresh Events tab after acknowledging an Announcement

### Pull Request Description
Maps to FP-204's acceptance criteria: acknowledging an Announcement now hands the Events tab a fresh list via the existing `notifyEventsRefreshed()` signal, same pattern already proven for RSVP/Edit Event — no new mechanism introduced, no change to the unrelated self-report signal. Confirm in the PR this was tested on a real device: acknowledge an Announcement, return to the Events tab, confirm the Acknowledged state shows immediately with no flicker.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-204

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-204-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
