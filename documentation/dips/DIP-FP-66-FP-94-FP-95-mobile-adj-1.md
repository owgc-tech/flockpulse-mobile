# DIP-FP-66-FP-94-FP-95-mobile-adj-1

### Story Summary

Live testing surfaced a real gap in the merged mobile events screen: RSVP and roster visibility were built as a role-exclusive either/or (`isLeader ? roster : RSVP`), but a person's actual relationship to an event doesn't work that way — a Leader can be personally invited to an event they don't lead, and an Admin (who may also be a Coordinator/Sr. Coordinator acting as a pastoral leader) should see both their own RSVP and full oversight regardless. This adjustment makes RSVP and roster independent: everyone gets RSVP controls, and anyone who isn't a plain Member additionally gets a roster — Leaders scoped to their own assigned members, Admins seeing everyone, matching what the backend was already correctly providing. Also folds in a small, unrelated UX fix found during the same testing pass: the events list blinks to a full loading spinner every time it regains focus, when it should just rely on pull-to-refresh.

### Repo Target

Mobile only. Confirmed live against `dev`: the backend (`GET /api/events/:id/roster`) already does the right thing for both roles — its scoping is `ctx.role === 'LEADER' ? ctx.memberId : undefined`, and for an Admin that's already `undefined`, giving the same full, unscoped roster FP-67's web screen has always gotten. Nothing on the web side needs to change; this was a UI gap, not a backend one.

### Grounding Check

* Confirmed live (`dev` branch, post-PR-#2-merge): `app/(app)/index.tsx` still has the role-gated `showRsvpStatus={!isLeader}` and a `useFocusEffect` that calls `loadEvents(false)` (full loading state, not the lighter refresh state) on every focus. `app/(app)/events/[id].tsx` still has the exclusive `isLeader ? <RosterSection /> : <RsvpSection />` ternary.
* RSVP has no role restriction server-side — `POST /api/rsvps` was already open to any authenticated member (confirmed in the original web DIP's grounding). The screen was the only thing hiding it from non-Members.
* Every event reachable on this screen is one the viewer is personally an attendee of — `/api/events/mine` is self-scoped by definition — so RSVP is always meaningful here regardless of role; there's no case where showing it would be nonsensical.
* "Admin" here means Community Servant, Coordinator, or Sr. Coordinator — per direct clarification, only Coordinators/Sr. Coordinators are ever realistically pastoral leaders, but the fix doesn't need to distinguish sub-roles: any account with `role !== 'MEMBER'` gets the roster section, matching "Admin sees everyone, Leader sees their own" exactly as the backend already enforces.
* Blink fix, confirmed as the right call rather than a "smarter" loading-state split: removing the `useFocusEffect` refetch-on-focus entirely and relying solely on the existing pull-to-refresh gesture is simpler than trying to distinguish "first load" from "return visit" loading states, and was the explicitly preferred direction over building that distinction.

### Implementation Plan

1. In `app/(app)/index.tsx`:
   * Remove the `useFocusEffect` block entirely (the `loadEvents(false)` call on every screen focus). Keep the initial `loadEvents(false)` on mount and the existing pull-to-refresh (`loadEvents(true)`) — those two are enough; nothing else should trigger the full-screen loading state.
   * Remove the `showRsvpStatus={!isLeader}` conditional passed to `EventListItem` — RSVP status is relevant to everyone now.
2. In `src/features/events/components/EventListItem.tsx`: remove the now-meaningless `showRsvpStatus` prop; render the RSVP status text whenever `event.rsvp_status` is present, unconditionally.
3. In `app/(app)/events/[id].tsx`:
   * Replace the exclusive ternary with independent rendering: always render `<RsvpSection event={event} onEventChange={setEvent} />`, and additionally render `<RosterSection eventId={event.id} />` whenever `session?.user.app_metadata?.role !== 'MEMBER'`.
   * No changes needed to `RsvpSection` or `RosterSection` themselves — both already work correctly in isolation; this only changes which combination of them renders.

### Files to Create/Modify

```
app/(app)/index.tsx                                (modified)
app/(app)/events/[id].tsx                           (modified)
src/features/events/components/EventListItem.tsx    (modified)

```

### Migration Files (if applicable)

None.

### Branch Name

`feature/FP-66-94-95-mobile-adj-1-role-relationship-fix`

### Commit Message

`FP-66-FP-94-FP-95-mobile-adj-1: show RSVP to everyone, roster to non-Members, remove focus-refetch blink`

### Pull Request Description

* Fixes a real gap found in testing: a Leader personally invited to an event previously had no way to RSVP for themselves (roster-only view regardless of their own invitation), and an Admin who is also someone's pastoral leader had no roster view at all (RSVP-only, since Admin fell through the `isLeader` check as false).
* RSVP is now shown to every role on every event reached from this screen (all are self-invited by definition). Roster is now shown additionally to anyone who isn't a plain Member — Leaders scoped to their own assigned members, Admins seeing the full roster — reusing the existing, unchanged backend scoping logic.
* Removes the events list's full-screen loading blink on every return to the screen; pull-to-refresh remains the way to manually refresh.

### Jira Linkage

* PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
* PDEStoryID: FP-94, FP-95 (adjustment to already-Done stories, per the DIP adjustment-file convention — no new story needed)

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-66-FP-94-FP-95-mobile-adj-1.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge — test via `expo start` + Expo Go against the branch, then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
