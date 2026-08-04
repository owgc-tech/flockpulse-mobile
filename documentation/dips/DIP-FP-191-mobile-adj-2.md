# DIP-FP-191-mobile-adj-2

## Story Summary

Adds an Acknowledged/Unacknowledged pill to Announcement cards in My Events,
positioned beside the existing status pill, using the newly-list-level
acknowledged_at from DIP-FP-191-web-adj-2. As a direct consequence of that
same field now being present on the route-param event object, the event
detail screen's flicker (briefly showing "Acknowledge" before correcting to
"✓ Acknowledged") should resolve on its own — verify this rather than assume it.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Continues on the
existing feature/FP-191-mobile-announcements branch (PR #78, still open) —
push as additional commits, same as the last two rounds.

## Grounding Check

- Written against DIP-FP-191-web-adj-2's documented contract — confirm the
  real field against web's actual merged PR before implementing, same
  discipline as every prior round.
- The flicker fix is explicitly a predicted side effect, not a separately
  implemented fix — AnnouncementSection's isAcknowledged derivation
  (justAcknowledged || !!event.acknowledged_at, from the prior adj-1 round)
  does not need to change at all; it already does the right thing once the
  value it reads is correct from first render. Confirm this holds true on a
  real device rather than assuming the reasoning is sufficient on its own.

## Implementation Plan

1. src/features/events/types.ts: move acknowledged_at from EventDetail up
   to MyEvent (inherited by EventDetail already).
2. EventListItem.tsx: for isAnnouncement cards, add a new pill beside the
   existing status pill — "Acknowledged" / "Unacknowledged" based on
   !!event.acknowledged_at, color-coded (success-tint for Acknowledged,
   a muted/pending tint for Unacknowledged), following the same pill
   styling convention already used for the RSVP status pill on regular
   event cards.
3. No changes needed to AnnouncementSection or the detail screen's
   isAcknowledged logic — confirm the flicker is actually gone on a real
   device now that the list-level data feeds the initial route param
   correctly, rather than assuming it without checking.

## Files to Create/Modify

- src/features/events/types.ts (modify — acknowledged_at moves to MyEvent)
- src/features/events/components/EventListItem.tsx (modify — new pill)

## Migration Files

None.

## Branch Name

Continue on the existing feature/FP-191-mobile-announcements (no new branch).

## Commit Message

FP-191-mobile-adj-2: add Acknowledged/Unacknowledged pill to My Events cards

## Pull Request Description

- Screenshot: My Events card showing the new pill for both an acknowledged
  and a not-yet-acknowledged Announcement.
- Explicitly confirm (not just assume) whether the event detail flicker is
  actually resolved now — report back either way, since this DIP predicts
  it but doesn't implement a direct fix for it.

## Jira Linkage

- PDEEpicID: FP-188
- PDEStoryID: FP-191

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile-adj-2.md.
Push as additional commits on the existing feature/FP-191-mobile-announcements
branch (PR #78) — do not open a new PR. Stop once pushed.

Include full diffs for every changed file, no elisions.
