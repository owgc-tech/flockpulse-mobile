DIP-FP-148-FP-149-adj-1.md
Story Summary
Revision to the not-yet-merged PR #28 (feature/FP-148-FP-149-mobile-rsvp-display-polish). The RSVP pill's background currently reuses themed.pill, hardcoded to a light-blue tint (colors.accent + "22") — it doesn't follow the RSVP status like the text color already does. This fixes the background to use the same light-tint technique as the existing status pill, but derived from getRsvpStatusColor() instead of always blue — so an Accepted pill is light-green-on-green, Declined is light-red-on-red, Tentative is light-amber-on-amber, matching the status pill's own established visual pattern exactly.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check

PR #28 is unmerged — this work continues on the existing feature/FP-148-FP-149-mobile-rsvp-display-polish branch, not a new branch off dev.
Confirmed live on that branch: the status pill's light-tint technique is backgroundColor: colors.accent + "22" (hex alpha suffix for ~13% opacity) paired with full-opacity color: colors.accent for its text — a simple, reusable pattern.
The RSVP pill (added in this same PR) reuses themed.pill for its background — which is that same hardcoded colors.accent + "22", never varying by RSVP status — while its text color already correctly calls getRsvpStatusColor(colors, event.rsvp_status). The fix is to compute the background the same way: getRsvpStatusColor(colors, event.rsvp_status) + "22", inline, since (unlike the status pill's fixed accent/danger duality) this needs to vary across three colors dynamically, not two fixed themed keys.

Implementation Plan

Check out the existing feature/FP-148-FP-149-mobile-rsvp-display-polish branch (do not create a new branch).
EventListItem.tsx: change the RSVP pill's <View> style from [styles.pill, themed.pill] to [styles.pill, { backgroundColor: getRsvpStatusColor(colors, event.rsvp_status) + "22" }]. Text color stays as its current inline getRsvpStatusColor(colors, event.rsvp_status) call, unchanged.

Files to Create/Modify

src/features/events/components/EventListItem.tsx

Migration Files
Not applicable.
Branch Name
Continue on the existing feature/FP-148-FP-149-mobile-rsvp-display-polish branch — do not create a new one.
Commit Message
FP-149: RSVP pill background should tint with the RSVP color, not always blue (pre-merge revision)
Pull Request Description
Amend PR #28's description or add a comment: the RSVP pill's background was reusing the status pill's fixed blue tint regardless of RSVP status — fixed to derive the tint from the same color as the text, matching the status pill's established light-background/solid-text pattern per-status instead of always blue.
Jira Linkage

PDEEpicID: FP-15 (EPIC-4)
PDEStoryID: FP-149

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-148-FP-149-adj-1.md on the same branch, frozen after save. Push as additional commits to the same PR #28 — do not open a new PR. Do not merge. No migration, no remote step.
Include full diff in the completion report.
