# DIP-FP-115-mobile

### Story Summary

Redesigns "My Events" to the reference layout (month/menu header, avatar-only right side, day/date + event-info two-column rows) for all users, and adds mobile event creation for Leader-tier and Admin-tier via a floating "+" button — full parity with web's creation form.

### Repo Target

Mobile only. Depends on FP-114 (web) for Leader-tier's actual `POST`/`publish` calls to succeed — Admin-tier can be used to test this DIP's UI immediately, since Admin already has access today regardless of FP-114.

### Grounding Check

* Confirmed exact `POST /api/events` contract: required `eventTypeId, name, startDatetime, endDatetime, locationName, locationAddress, target`; optional `locationUrl, talkId, prayerLeaderMemberId, foodAssignment`. `target` and `foodAssignment` share the identical shape (`{ group_ids?: string[], member_ids?: string[] }`) — one shared picker component covers both, not two separate ones.
* Confirmed real, important gap: a created event starts in `DRAFT` and is invisible everywhere (including the creator's own list) until published — `POST /api/events/:id/publish` is a separate call, currently `requireRole('ADMIN')`-gated, not included in FP-114's file list. This DIP's creation flow calls `POST /api/events` then immediately `POST /api/events/:id/publish` in sequence (create-and-publish as one user action) rather than exposing a separate draft-review step — reasonable for a mobile, on-the-go creation flow, flagged as a UX default rather than silently assumed. Flag to FP-114's implementation that the publish route needs the same role/ownership widening as create/edit/cancel, or this DIP's second call will fail for Leader-tier.
* Confirmed all supporting picker data sources are open to any authenticated member (not Admin-gated): `GET /api/event-types`, `GET /api/groups`, `GET /api/members`, `GET /api/courses` (and by the same established pattern, modules/talks) — no new backend needed for any picker.
* `+` button visibility: `role !== 'MEMBER'` (Leader-tier and Admin-tier both), same inclusive pattern used everywhere else in this app — automatically correct for any future role at either tier, not a hardcoded list.

### Implementation Plan

Layout redesign (`(tabs)/index.tsx`):

1. Header: month name (derived from currently-visible events or current date) + hamburger menu icon, left-aligned, replacing the centered title. Menu icon can be non-functional for now (no drawer/menu content specified) — placeholder tap target only, flagged as incomplete rather than silently wired to nothing.
2. Row layout: `FlatList` item becomes a `flexDirection: row` container — left column (~15% width) shows day-of-week + date number; right column (~85%) keeps all current `EventListItem` content (name, time, location, status pill, RSVP) unchanged, just re-flowed into the narrower right column.
3. Floating "+" button, bottom-right, absolute positioned, visible only for `role !== 'MEMBER'`.

Event creation (`app/(app)/events/create.tsx`, new): 4. Form fields: name (text), event type (picker from `GET /api/event-types`), start/end datetime (native pickers, reusing the already-installed `@react-native-community/datetimepicker`), location name + address (text), optional location URL, target audience (new shared `MemberGroupPicker` component — multi-select members and/or groups), optional Formation Talk link (Course → Module → Talk drill-down, using the three existing list endpoints), optional prayer leader (single-member variant of the same picker), optional food assignment (reuses `MemberGroupPicker`, identical shape to target). 5. Submit: `POST /api/events` → on success, `POST /api/events/:id/publish` immediately → navigate back to My Events, which should now show the new event (assuming the creator is also a targeted attendee — if not, it simply won't appear in their own list, which is correct given `/api/events/mine`'s existing scoping). 6. Surface `MISSING_FIELD`/`VALIDATION_ERROR`/`INVALID_DATETIME`/`INVALID_FORMATION_LINK` errors from the API distinctly where reasonable, generic fallback otherwise.

### Files to Create/Modify

```
app/(app)/(tabs)/index.tsx                                  (modified — layout redesign)
app/(app)/events/create.tsx                                 (new)
src/features/events/services/events.service.ts              (modified — createEvent, publishEvent)
src/features/events/types.ts                                (modified — CreateEventInput)
src/features/event-types/services/eventTypes.service.ts      (new)
src/features/event-types/types.ts                            (new)
src/features/formation/services/formation.service.ts         (new — courses/modules/talks listing)
src/features/formation/types.ts                              (new)
src/features/shared/components/MemberGroupPicker.tsx         (new)

```

### Migration Files (if applicable)

None — no schema change on mobile; the `created_by_member_id` column is FP-114's (web-side).

### Branch Name

`feature/FP-115-mobile-events-redesign-creation`

### Commit Message

`FP-115-mobile: redesign My Events layout, add event creation for Leader/Admin-tier`

### Pull Request Description

* "My Events" now matches the reference layout: month/menu header, avatar-only right side, day/date + event-info two-column rows.
* New floating "+" button (Leader-tier and Admin-tier only) opens event creation, full field parity with web's form, including optional Formation Talk linking.
* Creation flow creates then immediately publishes — flagged as a UX default, not a spec requirement.
* Depends on FP-114 (web) for Leader-tier's actual calls to succeed — test with Admin-tier in the meantime.

### Jira Linkage

* PDEEpicID: FP-11 (EPIC-3 — Event Lifecycle Management)
* PDEStoryID: FP-115

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-115-mobile.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge — test via `expo start` + Expo Go (Admin-tier account works today; Leader-tier needs FP-114 merged first), then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
