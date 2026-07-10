# DIP-FP-66-FP-94-FP-95-mobile

### Story Summary

This is the follow-up to `DIP-FP-66-FP-94-FP-95-web` — it builds the actual mobile screens that consume the backend work already merged and verified: the "My Events" list (FP-94), cancelled-event styling on that same list (FP-66), and the Leader roster view reached from tapping an event (FP-95). One screen plus one detail view, since all three stories are the same UI surface with role-conditional behavior layered on top.

### Repo Target

Mobile (Expo + React Native + TypeScript) — `owgc-tech/flockpulse-mobile`. Branching from `dev`, which now has the merged auth foundation (confirmed live — `app/(app)/index.tsx` currently holds the placeholder "You're signed in" screen from the auth DIP, exactly where this DIP's real content goes).

### Grounding Check

* The placeholder being replaced is confirmed: `app/(app)/index.tsx` on `dev` is still the bare "You're signed in" + Sign Out placeholder from the auth foundation DIP. This DIP replaces its content; `(app)/_layout.tsx`'s auth/biometric gate is untouched — nothing here changes how the user got here.
* `/api/events/mine`'s real response shape is already proven, not assumed — confirmed via live testing against the deployed backend: `id, name, status, start_datetime, end_datetime, location_name, location_address, location_url, target, event_type_id, prayer_leader_member_id, food_assignment, created_at, effective_status, rsvp_status, rsvp_reason`.
* RSVP submission has a real, enforced window that the AC text doesn't spell out: verified against `submitRsvp()` directly — it throws `RSVP_CLOSED` unless `effective_status === 'SCHEDULED'` exactly. Not "before start_datetime," not "SCHEDULED or ACTIVE" — only `SCHEDULED`. So RSVP controls must be editable only in that state; anything else (`ACTIVE`, `COMPLETED`, `LOCKED`, `CANCELLED`) shows the existing response read-only, with no way to trigger a doomed API call.
* RSVP is an upsert (`upsertRsvp` in the repository layer, backed by the unique `(tenant_id, event_id, member_id)` index) — submitting twice with a different status just overwrites, no separate update path needed. `rsvp_status: 'NO'` requires a non-empty `rsvp_reason`; `'YES'` must never send one (server nulls it regardless).
* Role is already available client-side with no new call: `session.user.app_metadata?.role` is the same field `flockpulse-web`'s own `withAuth` middleware reads server-side — confirmed present on the Supabase session object already held by `useSession()`. No new claim, no new fetch.
* `GET /api/events/:id` does not include `rsvp_status`/`rsvp_reason` — only `/api/events/mine`'s list response does. Rather than adding a new backend endpoint (out of scope for a mobile-only DIP) or double-fetching the list, the detail screen receives the already-fetched event object (including RSVP fields) via navigation params from the list screen. Tradeoff, flagged rather than silent: if the user submits an RSVP and revisits the same event without returning to the list first, the detail screen's copy could be stale — acceptable, since the list re-fetches on focus and the detail screen also re-reads its own local state after a successful submit.
* Roster scoping needs zero new logic on the mobile side — `GET /api/events/:id/roster` already returns the correctly-scoped result based on the caller's role (Admin unrestricted, Leader filtered, Member rejected), verified live in the previous session's testing. Mobile just calls it and renders what comes back; a Member navigating to a roster view isn't a real path in this UI (only Leader role branches there), so the 403 case shouldn't normally surface, but the fetch is still wrapped in error handling rather than assumed to always succeed.
* Deliberately not built here: tap-to-navigate on `location_url`/`location_address` — that's FP-96's scope (pre-event reminder notification content), not FP-94/66/95's. This screen displays location as plain text only.
* Assumption, flagged rather than decided silently: Admin role isn't mentioned in any of the three ACs (they're written for Member/Leader). If an Admin account opens this screen on mobile, it defaults to the Member-style RSVP view rather than the Leader roster view — Admins have their own member record and could theoretically RSVP too, and there's no stated reason to block it. Worth a real product decision later if Admin mobile usage becomes a real use case; not blocking here.

### Implementation Plan

1. `src/features/events/types.ts` — shared types: `MyEvent` (the `/api/events/mine` shape), `RosterEntry` (matches web's `RosterEntry` shape exactly, confirmed live).
2. `src/features/events/services/events.service.ts`:
   * `listMyEvents()` → `GET /api/events/mine`
   * `submitRsvp(eventId, rsvpStatus, rsvpReason?)` → `POST /api/rsvps`, surfaces `RSVP_CLOSED`/`RSVP_REASON_REQUIRED`/`NOT_AN_ATTENDEE`/`INVALID_STATE` as distinguishable errors rather than a generic failure
   * `getEventRoster(eventId)` → `GET /api/events/:id/roster`
3. Rewrite `app/(app)/index.tsx` as the "My Events" list:
   * Fetches `listMyEvents()` on mount and on screen focus (pull-to-refresh also wired).
   * Each row: name, date/time, location (text only), a status pill (`effective_status`), and — for Members — the existing `rsvp_status` if any.
   * `effective_status === 'CANCELLED'` rows get a red-tinted background (FP-66's AC), still tappable, still fully visible.
   * Empty state: "No upcoming events" when the list is empty — not stated in any AC, reasonable default, flagged here rather than left undocumented.
   * Tapping a row navigates to `/(app)/events/[id]`, passing the full event object as a serialized route param (per the Grounding Check's tradeoff above).
   * Sign Out affordance moves to a small header button, preserving what the placeholder had.
4. New `app/(app)/events/[id].tsx` — detail screen, branches on `session.user.app_metadata?.role`:
   * Member (default) branch: shows event details, then RSVP controls. If `effective_status === 'SCHEDULED'`: editable Yes/No buttons, No requires a reason (mirrors the DB's own constraint), submits via `submitRsvp()`, updates local state on success. Otherwise: read-only display of the existing `rsvp_status` (or "Not yet responded" / "RSVP closed" as appropriate), no editable controls.
   * Leader branch: shows event details, then fetches and renders `getEventRoster(eventId)` — each entry's `response` (`ACCEPTED`/`DECLINED`/`NOT_RESPONDED`) and `rsvp_reason` if declined.
5. New components: `src/features/events/components/EventListItem.tsx`, `RsvpControls.tsx`, `RosterList.tsx` — kept small and presentational, consistent with the existing `LoginForm`/`MfaVerifyForm` component style from the auth DIP.

### Files to Create/Modify

```
app/(app)/index.tsx                                (rewritten — was the placeholder)
app/(app)/events/[id].tsx                           (new)
src/features/events/types.ts                        (new)
src/features/events/services/events.service.ts      (new)
src/features/events/components/EventListItem.tsx    (new)
src/features/events/components/RsvpControls.tsx     (new)
src/features/events/components/RosterList.tsx        (new)
```

### Migration Files (if applicable)

None — this is UI only, consuming already-merged backend endpoints.

### Branch Name

`feature/FP-66-94-95-mobile-events-screen`

### Commit Message

`FP-66-FP-94-FP-95-mobile: build My Events screen with RSVP, cancelled styling, and leader roster view`

### Pull Request Description

* FP-94: `app/(app)/index.tsx` is now the default post-login landing screen for both Members and Leaders — event list with RSVP status, tapping an event opens RSVP submission (Member) via the existing `/api/rsvps` endpoint, no new backend.
* FP-66: Cancelled events remain in the list with a red-tinted row background, never filtered out.
* FP-95: Leaders tapping an event see a roster scoped to their own assigned members (server-enforced, confirmed via the already-merged backend DIP), not the full attendee list.

### Jira Linkage

* PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
* PDEStoryID: FP-66, FP-94, FP-95

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-66-FP-94-FP-95-mobile.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge — test via `expo start` + Expo Go against the branch (same as the auth foundation DIP), then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
