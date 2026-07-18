DIP-FP-148-FP-149.md
Story Summary
Two independent, non-overlapping mobile polish fixes, bundled into one DIP for delivery convenience — they touch different files with no shared lines or data path, so each is implemented as its own clearly separated section rather than a unified change.

FP-148: removes the "Your RSVP: ..." line from the Self-Report detail screen entirely. Confirmed deterministic, not a recycled-event quirk: any event reached via the Self-Report tab always shows "No response" regardless of actual RSVP, since that tab's backend query never selects rsvp_status at all (the field is null-hardcoded on the mobile side specifically because of this). Rather than fix the data source for one label that isn't even used by submission logic, the label is removed.
FP-149: on the My Events list, replaces the conversational RSVP text ("You're going"/"You declined"/"You might attend") with "Accepted"/"Declined"/"Tentative" in a colored pill — matching the vocabulary already used by the admin/leader roster and the RSVP buttons themselves. "Please RSVP now." stays as plain bold text, just recolored from black to blue.

Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
FP-148: Confirmed event.rsvp_status is used in exactly one place on this screen — rsvpLabel() and its render call. The separate staleness-correction useEffect (re-fetching via getEventById() on open, merging over the baked-in event from navigation params) serves a broader purpose — keeping name/dates/location fresh — and must not be removed; only its comment's trailing sentence ("getEventById() lacks rsvp_status/rsvp_reason, so this can't clobber those fields") becomes stale once the label is gone and should be trimmed, since the reasoning it explains no longer applies to anything displayed.
FP-149: RSVP_LABELS (EventListItem.tsx) currently maps to the conversational phrases from FP-143. getRsvpStatusColor() (from FP-143's src/features/events/utils.ts) already provides the exact Accept=green/Decline=red/Tentative=amber mapping needed — reused directly, not reimplemented. The existing styles.pill/themed.pill pattern (status pill, and briefly the since-reverted Online pill) is the established way to render a colored badge in this component — reused for consistency. "Please RSVP now." keeps its existing fontWeight: '700' and Text element unchanged — only its color source changes from colors.text to colors.accent.
Domain rules: no conflict on either story — both are display-only, no data or submission-logic changes.
Implementation Plan
FP-148:

Remove the rsvpLabel() function and its <Text> render call from app/(app)/events/[id]/self-report.tsx.
Trim the now-stale trailing sentence from the staleness-correction useEffect's comment; leave the effect itself and the rest of the comment (explaining why the fresh-fetch/merge happens at all) untouched.

FP-149:

src/features/events/components/EventListItem.tsx: change RSVP_LABELS values to "Accepted" / "Declined" / "Tentative".
Wrap the RSVP label <Text> in a pill <View> (reusing styles.pill/themed.pill), with the text color set via the existing getRsvpStatusColor(colors, event.rsvp_status) call (already present from FP-143 — just move it from the bare <Text> onto the pill's contents, no new color logic).
Change rsvpPromptText's color from colors.text to colors.accent; fontWeight: '700' stays as-is.

Files to Create/Modify

app/(app)/events/[id]/self-report.tsx
src/features/events/components/EventListItem.tsx

Migration Files
Not applicable.
Branch Name
feature/FP-148-FP-149-mobile-rsvp-display-polish
Commit Message
FP-148, FP-149: remove unreliable RSVP line from self-report; pill-style RSVP status in My Events
Pull Request Description
Maps to acceptance criteria:

FP-148: "Your RSVP" line removed regardless of entry path → function and render call deleted, not hidden. "Other content unaffected" → form/submission logic untouched, confirmed rsvp_status had no other usage on this screen.
FP-149: "Accepted/Declined/Tentative matching RosterList" → exact wording match. "Colored pill using FP-143's scheme" → getRsvpStatusColor() reused. "Please RSVP now unchanged except color" → same bold weight, only color source changed to colors.accent.

Jira Linkage

PDEEpicID: FP-18 (EPIC-5) / FP-15 (EPIC-4)
PDEStoryID: FP-148, FP-149

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-148-FP-149.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for both files in the completion report.
