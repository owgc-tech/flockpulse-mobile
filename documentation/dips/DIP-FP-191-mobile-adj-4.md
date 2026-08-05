# DIP-FP-191-mobile-adj-4

## Story Summary

Three small mobile-only fixes based on real-device testing. Text: "Please Acknowledge now." becomes "Please acknowledge." Badge: reverses the adj-3 exclusion — the Events tab badge should count unacknowledged Announcements alongside events awaiting RSVP, combined into one number, not exclude them. Icon: reverts the custom two-tone SVG entirely back to lucide's stock Megaphone icon, at 2x the original size (32 instead of 16) rather than the attempted 3x custom version.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Fresh branch off current dev (PR #80 already merged).

## Grounding Check

- Confirmed live: pendingRsvpCount's filter currently excludes Announcements entirely (adj-3's fix). This DIP deliberately reverses that — not a bug this time, a genuine change of direction. Flagging plainly rather than treating it as another silent correction.
- Announcements' contribution to the count uses acknowledged_at only, with no isRsvpWindowOpen-style time gating — consistent with the already-established "acknowledging is never gated by time" design from the original FP-191 story. Regular events keep their exact existing logic (rsvp_status + isRsvpWindowOpen) completely untouched.
- AnnouncementMarkerIcon.tsx (the custom SVG from adj-3) becomes fully unused once EventListItem.tsx reverts — deleting it rather than leaving dead code behind, since it has exactly one consumer and that consumer is being reverted.
- The reverted icon keeps its original color (colors.accent) — "bring back the old megaphone" is read as a full revert to exactly what existed before the two-tone attempt, just larger, not a partial/modified version.

## Implementation Plan

1. EventListItem.tsx:
   - Text: "Please Acknowledge now." → "Please acknowledge."
   - Icon: remove the AnnouncementMarkerIcon import and usage, restore import { Megaphone } from "lucide-react-native" and <Megaphone size={32} color={colors.accent} /> (2x the original 16, not the attempted 48).
2. AnnouncementMarkerIcon.tsx: delete — no remaining consumers after the icon revert.
3. app/(app)/(tabs)/index.tsx: pendingRsvpCount's filter restructured to a combined condition — for Announcement-type events, count based on !event.acknowledged_at alone; for every other event, keep the exact existing !e.rsvp_status && isRsvpWindowOpen(e) logic unchanged. Both contribute to one combined total, not two separate counts.

## Files to Create/Modify

- src/features/events/components/EventListItem.tsx (modify — text, icon revert)
- src/features/events/components/AnnouncementMarkerIcon.tsx (delete)
- app/(app)/(tabs)/index.tsx (modify — badge count restructured)

## Migration Files

None.

## Branch Name

feature/FP-191-mobile-adj-4-badge-and-icon-revert

## Commit Message

FP-191-mobile-adj-4: shorten acknowledge text, count unacknowledged Announcements in Events badge, revert to stock megaphone icon at 2x

## Pull Request Description

- Confirm the badge now correctly sums both regular pending-RSVP events and unacknowledged Announcements into one number — test with the exact scenario from earlier (2 Announcements, 1 acked 1 not, 1 regular event unRSVP'd) and confirm it now shows 2, not 1.
- Screenshot: the reverted icon at 32px, confirm AnnouncementMarkerIcon.tsx is genuinely gone, not just unused.
- Confirm the text change reads correctly against the existing "Please RSVP now." sibling, same style, just different wording pattern this time (no "now").

## Jira Linkage

- PDEEpicID: FP-188
- PDEStoryID: FP-191

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile-adj-4.md. Branch off current dev. Open a new PR against dev and stop. Do not merge.

Include full diffs for every file in the completion report, no elisions.
