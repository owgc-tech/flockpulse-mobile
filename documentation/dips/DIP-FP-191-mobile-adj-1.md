# DIP-FP-191-mobile-adj-1

## Story Summary

Two fixes matching DIP-FP-191-web-adj-1. First: replaces the Announcement card/detail's current display of placeholder location values (a confusing, non-functional "open maps" link showing "Announcement"/"N/A") with a plain "From: {creator name}" line — no link, no N/A. Second: initializes the Acknowledge button's state from the server's real acknowledged_at value instead of always starting false, so a genuinely-already-acknowledged announcement correctly shows "✓ Acknowledged" immediately on every visit, not just within the same screen session.

## Repo Target

Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Fresh branch off current dev (PR #78 already merged, once merged).

## Grounding Check

- Written against DIP-FP-191-web-adj-1's documented contract — same field names, cross-checked, not independently guessed. Confirm both against web's actual merged PR before considering this done, same discipline as every prior round today.
- Confirmed by re-reading the actual merged AnnouncementSection (PR #78): isAcknowledged is useState(false) with no initialization from any prop/fetch — this DIP changes that single line, not the surrounding structure.
- EventListItem.tsx's card currently renders event.location_name/location_address via the same location-link component used for real events (confirmed by direct code read) — for Announcement-type events specifically, this needs to be swapped for the new created_by_member display instead, not just hidden.

## Implementation Plan

1. Extend MyEvent and the event-detail type with created_by_member: { id: string; first_name: string; last_name: string } | null and acknowledged_at: string | null (detail type only for the latter, matching web's endpoint-specific placement).
2. EventListItem.tsx: for isAnnouncement cards, replace the existing location-link rendering entirely with a plain (non-tappable) "From: {first_name} {last_name}" line; render nothing in that slot if created_by_member is null.
3. Event detail screen's equivalent location display block: same replacement — "From: {name}" plain text, no N/A line, nothing at all if created_by_member is null.
4. AnnouncementSection: change const [isAcknowledged, setIsAcknowledged] = useState(false) to useState(!!event.acknowledged_at) — the button now correctly reflects true prior state on mount, not just after a same-session tap.

## Files to Create/Modify

- src/features/events/types.ts (modify — created_by_member, acknowledged_at)
- src/features/events/components/EventListItem.tsx (modify — From: display replacing location link)
- app/(app)/events/[id].tsx (modify — same replacement in detail view, isAcknowledged initialization)

## Migration Files

None.

## Branch Name

feature/FP-191-mobile-adj-1-announcement-creator-and-ack-state

## Commit Message

FP-191-mobile-adj-1: show announcement creator instead of placeholder location, fix Acknowledge persistence across visits

## Pull Request Description

- Confirm both fields checked against web's actual merged response, not just this DIP's text.
- Screenshot: My Events card no longer shows a maps link, shows "From: {name}" instead.
- Screenshot: event detail — acknowledge once, navigate away, come back — button should show "✓ Acknowledged" immediately, not reset to the tappable state.

## Jira Linkage

- PDEEpicID: FP-188
- PDEStoryID: FP-191

## Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-191-mobile-adj-1.md. Push as a new branch off current dev (not the old FP-191-mobile-announcements branch, since that one's already merged) — do not open a new PR until DIP-FP-191-web-adj-1 is actually merged and confirmed. Do not merge.

Include full diffs for every file in the completion report, no elisions.
