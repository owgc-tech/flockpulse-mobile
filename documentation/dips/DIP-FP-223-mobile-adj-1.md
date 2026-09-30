### DIP — FP-223-mobile-adj-1 — Respect is_attendee in the RSVP prompt and badge count

### Story Summary
Mobile counterpart to FP-223-web-adj-2. Suppresses the "Please RSVP now" prompt and excludes the event from the Events tab badge count whenever `is_attendee` is `false` — an event the viewer can see (as Admin or owning Leader) but was never actually invited to.

### Repo Target
Mobile (Expo) — two files.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Badge count (`app/(app)/(tabs)/index.tsx`): `e.event_type?.system_key === "ANNOUNCEMENT" ? !e.acknowledged_at : !e.rsvp_status && isRsvpWindowOpen(e)` — needs `&& e.is_attendee` added to the non-Announcement branch.
- "Please RSVP now" text (`src/features/events/components/EventListItem.tsx`): an `isRsvpWindowOpen(event)` check, reached only when `event.rsvp_status` is falsy — needs the same `is_attendee` guard. Confirm at implementation time whether the existing suppression pattern referenced in this file's own comments (line ~73, an existing case already suppressed rather than showing a meaningless prompt) offers a precedent to mirror exactly.

### Implementation Plan
1. In `index.tsx`'s badge-counting logic, add `&& e.is_attendee` to the non-Announcement branch of the existing conditional.
2. In `EventListItem.tsx`, add the same `is_attendee` check to the "Please RSVP now" branch — when `false`, fall through to whatever this file already does for its other suppressed case, rather than inventing new UI.
3. No change to Announcements — `is_attendee` is specifically about RSVP-targeting, not acknowledgment.

### Files to Create/Modify
- `app/(app)/(tabs)/index.tsx` (modify)
- `src/features/events/components/EventListItem.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-223-mobile-adj-1-respect-is-attendee

### Commit Message
FP-223-mobile-adj-1: suppress RSVP prompt and badge for non-attendee events

### Pull Request Description
Mobile counterpart to FP-223-web-adj-2. An Admin or owning Leader seeing an event they weren't invited to no longer gets a false "Please RSVP now" prompt or badge count for it. Confirm in the PR this was tested as both Admin (seeing an untargeted event) and as a genuinely-invited attendee (prompt/badge still work normally).

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-223

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-223-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
