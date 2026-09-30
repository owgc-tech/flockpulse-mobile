### DIP — FP-223-mobile-adj-2 — Hide RsvpSection on the detail screen for non-attendees

### Story Summary
Hides the RSVP section (status text + Accept/Tentative/Decline buttons) on the event detail screen when `is_attendee` is `false` — the same "you weren't actually invited" case already fixed on the list screen, now fixed on the detail screen too, reading the newly-added server value directly rather than relying on an inherited one.

### Repo Target
Mobile (Expo) — one screen.

### Grounding Check
Confirmed live: `RsvpSection` (in `app/(app)/events/[id].tsx`) renders completely unconditionally whenever `!isAnnouncement` — no `is_attendee` check exists anywhere in its render logic.
Depends on FP-223-web-adj-3 shipping first — confirm at implementation time that `EventDetail`'s type now includes `is_attendee` for real (not just via the `MyEvent`-merge fallback), and remove the now-unnecessary `is_attendee: false` fallback default added in FP-223-mobile-adj-1's `[id].tsx` change if the server value supersedes it.

### Implementation Plan
1. Wrap the `RsvpSection` render in a check: only render when `event.is_attendee` is `true`. When `false`, render nothing in its place (same "suppress rather than show something broken" pattern used on the list screen).
2. Confirm the Announcement branch is unaffected — this only touches the non-Announcement `RsvpSection` path.

### Files to Create/Modify
- `app/(app)/events/[id].tsx` (modify)

### Branch Name
feature/FP-223-mobile-adj-2-hide-rsvp-section

### Commit Message
FP-223-mobile-adj-2: hide RSVP section on detail screen for non-attendees

### Pull Request Description
An Admin or owning Leader viewing an event they're not invited to no longer sees the RSVP section at all on the detail screen — matching the list screen's existing behavior. Confirm in the PR this was tested on a real device, both as a non-invited viewer and as a genuine attendee (RSVP section still works normally).

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-223

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-223-mobile-adj-2.md and do not append executor notes, observations, or any other content to that file after the initial save. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
