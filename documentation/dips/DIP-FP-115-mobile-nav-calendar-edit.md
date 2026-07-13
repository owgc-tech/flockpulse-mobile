# DIP-FP-115-mobile-nav-calendar-edit

## Story Summary
Four related refinements to FP-115's still-open work, landing on the same branch before merge: (1) the hamburger icon becomes a real dropdown menu holding My Events/Confirmations, replacing the bottom tab bar entirely; (2) the month label becomes a tappable dropdown, and the event list becomes a sectioned, sticky-header calendar view that keeps the dropdown in sync with scroll position; (3) an ownership-gated Edit button on the event detail screen, backed by a new edit screen; (4) the day/date column narrows from 15% to 10%.

## Repo Target
Mobile only, same branch as FP-115 (`feature/FP-115-mobile-events-redesign-creation`) — this is a continuation of that still-open PR, not a new story or a post-merge adjustment.

## Grounding Check

* Confirmed live: `GET /api/events/:id` already returns `created_by_member_id` (verified directly against `dev`, post-FP-114-merge). Mobile's `EventDetail` type just needs this field added — no backend work needed.
* "Can I edit this event" doesn't need any new JWT claim or endpoint — `fetchMyProfile()` (already built, FP-116/117) already returns the caller's own member `id`. Client-side gating is simply `isAdminTier(role) || event.created_by_member_id === myProfile.id`. Real enforcement still happens server-side on `PATCH` regardless (FP-114) — this is purely a UI convenience to show/hide the button correctly, not a security boundary itself.
* The tab bar removal is a real architecture reversal, not a bug — `(app)/(tabs)/_layout.tsx` currently renders a `Tabs` navigator specifically so FP-113/117 could hide the Confirmations tab per-role via `href: null`. Converting to a plain `Stack` (My Events as the initial screen, Confirmations reached via `router.push` from the new dropdown) means that per-role hiding logic moves from "hide the tab" to "don't render the menu item" — same underlying role check, different UI surface.
* The sticky-header + scroll-synced dropdown is the genuinely fiddly piece of this DIP — `SectionList` with `stickySectionHeadersEnabled` is the correct native building block (not a custom-built approximation), and `onViewableItemsChanged` is the correct mechanism to detect which section is currently pinned at the top and sync the separate month-dropdown label to it. Flagging plainly: the actual feel of this (viewability threshold tuning, avoiding flicker right at section boundaries) cannot be verified statically or via `tsc`/`expo export` — this needs real on-device scrolling and iteration, more so than almost anything built so far tonight.
* Month dropdown's own job, clarified from the ask: tapping it lets you jump the list to a specific month's section (Google-Calendar-style); scrolling separately keeps it in sync by updating to whatever month is currently pinned. Two-way binding, not just a passive label.

## Implementation Plan
Navigation (hamburger dropdown):

1. `(app)/(tabs)/_layout.tsx`: `Tabs` → `Stack`. Remove the `Confirmations` tab's `href: null` role logic entirely (moves to the new menu component).
2. New `src/features/navigation/components/NavMenu.tsx`: same popover pattern as the profile Avatar (transparent `Modal`, opaque positioned card) — "My Events" and "Confirmations" (Confirmations hidden for `role === 'MEMBER'`, same check as before, just relocated).
3. Hamburger icon in the header (`headerLeft`) opens this menu; tapping either item navigates and closes the menu.

Calendar view (month dropdown + sticky dividers):

4. Restructure `(tabs)/index.tsx`'s data from a flat `MyEvent[]` into `{ title: string; data: MyEvent[] }[]` grouped by month, feeding a `SectionList` instead of `FlatList`.
5. Section header renders the prominent month bar (no graphic, per the ask — a solid bar with the month/year text).
6. `stickySectionHeadersEnabled` on; `onViewableItemsChanged` + `viewabilityConfig` drives which section is "current," updating the month-dropdown label to match.
7. Month dropdown (replacing the current static label): opens a picker of months actually present in the data; selecting one calls `scrollToLocation` on the `SectionList` to jump there.
8. Day/date column width: 15% → 10%.

Edit event:

9. `EventDetail` type (mobile): add `created_by_member_id: string | null`.
10. `events/[id].tsx`: compute `canEdit` per the Grounding Check's formula; conditionally render an "Edit" link/button top-right via `Stack.Screen`'s `headerRight`, navigating to the new edit route.
11. New `app/(app)/events/[id]/edit.tsx`: reuses `create.tsx`'s form structure and the same shared pickers, pre-filled from the fetched event, submitting via a new `updateEvent(id, patch)` mobile service call (`PATCH /api/events/:id`) instead of `createEvent`.

## Files to Create/Modify
```
app/(app)/(tabs)/_layout.tsx                        (modified — Tabs → Stack)
app/(app)/(tabs)/index.tsx                           (modified — SectionList, month dropdown, 10% column)
app/(app)/events/[id].tsx                            (modified — Edit button)
app/(app)/events/[id]/edit.tsx                       (new)
src/features/navigation/components/NavMenu.tsx       (new)
src/features/events/types.ts                         (modified — created_by_member_id on EventDetail)
src/features/events/services/events.service.ts       (modified — updateEvent)
```

## Migration Files (if applicable)
None.

## Branch Name
Same branch — `feature/FP-115-mobile-events-redesign-creation` (no new branch, per Grounding Check).

## Commit Message
`FP-115-mobile: hamburger nav menu, sticky-header calendar view, event editing`

## Pull Request Description
Append to the existing PR #9 description (don't replace it) — note these four additions build on the same still-open work: dropdown nav menu replacing the tab bar, sectioned/sticky-header calendar view with a scroll-synced month picker, ownership-gated event editing, and the 10% column width tweak. Flag plainly that the scroll-sync behavior needs real on-device tuning, not just a correctness check.

## Jira Linkage
* PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
* PDEStoryID: FP-115 (continuation)

## Stop Point
Save this DIP verbatim to `documentation/dips/DIP-FP-115-mobile-nav-calendar-edit.md` (a new file, separate from the frozen `DIP-FP-115-mobile.md`) and do not append executor notes after the initial save. Add commits to the existing PR #9, updating its description per above — do not open a new PR. Do not merge. Test via `expo start` + Expo Go once done.
