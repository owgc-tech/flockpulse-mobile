# DIP-FP-97-FP-98-mobile

### Story Summary

FP-97 (Post-Event Self-Report Reminder) and FP-98 (Leader Confirmation Reminder) combine cleanly: both are local notifications tied to an event's completion, both reuse FP-96's existing scheduling/permission infrastructure, and both need a real screen built for their tap-target — a Self-Report screen (FP-97) and a Confirmations list screen (FP-98) — since neither exists yet.

### Repo Target

Mobile only. Confirmed live: every backend call this needs already exists — `POST /api/self-reports`, `GET /api/confirmations/pending`, `POST /api/confirmations/:selfReportId`, `GET /api/events/:id/roster`, `GET /api/tenant/settings`. No new endpoint, no schema change.

### Grounding Check

* Self-report is only accepted when `effective_status === 'COMPLETED'` — confirmed directly in `submitSelfReport()`. `COMPLETED` begins exactly at `end_datetime` (per the existing status-derivation function) and lasts until `end_datetime + attendance_window_hours` (a real, per-tenant setting, fetched via `GET /api/tenant/settings`), after which it becomes `LOCKED` and self-report closes. FP-97's reminder firing at `end_datetime` is therefore correctly timed — that's the exact moment the window opens.
* A real, deliberate timing correction to FP-98, not the literal "fires at end_datetime too": firing a Leader's confirmation reminder at `end_datetime` would be before any member has had a chance to self-report at all — there'd be nothing to confirm yet. The confirmation queue only becomes meaningful once the self-report window has had time to fill, so this DIP schedules FP-98's reminder at `end_datetime + attendance_window_hours` (when the window actually closes) instead. Flagging this explicitly as a reasoned change, not the original wording.
* `/api/events/mine` already excludes `COMPLETED`/`LOCKED` events (from the earlier FP-66/94/95 web DIP) — meaning by the time an event is actually completed, it's silently dropped from the list mobile fetches. This has a real consequence: reconciliation can never re-examine an event once it's completed, since it becomes invisible. Resolution: both FP-97 and FP-98 schedule their reminder proactively while the event is still `SCHEDULED`/`ACTIVE` (the only two states where a future `end_datetime` even makes sense), using the same "schedule now with what's known, don't try to touch it again after firing" approach FP-96 already established. Once scheduled, this DIP does not attempt to reconcile against a since-completed event — there's no way to see it anymore, and by construction nothing else could have created a competing self-report before the member ever opens the reminder (there's no other self-report entry point yet).
* FP-97 is deliberately NOT filtered by `rsvp_status`, unlike FP-96 — real, reasoned difference, not an oversight. `isExpectedAttendee()` (the actual backend gate for self-report eligibility) checks `event_attendees` membership only, never RSVP. Attendance and stated intent are explicitly separate concepts per the product's own invariants — someone who declined could still have shown up. Every event in `/api/events/mine` (which is itself `event_attendees`-scoped) qualifies for a self-report reminder regardless of RSVP answer.
* FP-98 is scoped to `LEADER` role only, not Admin — Admins have full tenant-wide access to confirmations anytime already; a personal "confirm your assigned member" reminder reads as a Leader-specific nudge, not a general admin task. Flagged as a scoping decision, open to reconsideration.
* Per-event scheduling eligibility for FP-98 reuses the existing FP-95 roster endpoint — `GET /api/events/:id/roster`, called as the Leader, non-empty result means they have at least one assigned member expected at this event. No new logic, no new endpoint.
* Reminder content for FP-98 is deliberately generic ("You may have confirmations to review"), not a live count — the same "no OS mechanism to fetch fresh content at the literal instant of delivery" constraint from FP-96 applies here too, and doubly so here since the true count can only be known by actually querying `confirmations/pending` fresh, which the tap-through screen does for real.
* No proactive "have I already self-reported" check — the Self-Report screen simply attempts submission; if a report already exists, the existing `SELF_REPORT_ALREADY_SUBMITTED` error code is handled gracefully as an "already responded" state. Avoids adding a new GET endpoint purely for this, since the reactive path is simple and the error code already exists for exactly this case.
* `decision` for confirmations is `CONFIRM`/`REJECT` (not "attended"/"did not attend" literally) — the screen's buttons read "Attended"/"Did Not Attend" per your description, mapping to those two values.

### Implementation Plan

1. New `src/features/self-reports/types.ts`: `SelfReportStatus`, `SelfReportResponse` (mirrors web's shape exactly).
2. New `src/features/self-reports/services/selfReports.service.ts`: `submitSelfReport(eventId, status, { reason?, feedback?, starRating? })` wrapping `POST /api/self-reports`, surfacing `SELF_REPORT_ALREADY_SUBMITTED`/`SELF_REPORT_REASON_REQUIRED`/`SELF_REPORT_NOT_OPEN`/`VALIDATION_ERROR` via the existing `ApiError`.
3. New `app/(app)/events/[id]/self-report.tsx`: event info (name/time/location), current RSVP status shown read-only, "Did you attend?" Yes/No. No → required reason field. Yes → 1–5 star rating + optional feedback (≤1000 chars, matching the server's own limit). On `SELF_REPORT_ALREADY_SUBMITTED`, show an "already responded" state instead of the form.
4. New `src/features/confirmations/types.ts`: `PendingConfirmationRow`, `ConfirmationDecision`, `ConfirmationResult` (mirrors web exactly).
5. New `src/features/confirmations/services/confirmations.service.ts`: `listPendingConfirmations()` (`GET /api/confirmations/pending`), `submitConfirmation(selfReportId, decision, leaderNote?)` (`POST /api/confirmations/:selfReportId`).
6. New `app/(app)/confirmations/index.tsx`: list of pending items — member name, event context, their self-report (feedback/rating if Yes, reason if No), "Attended"/"Did Not Attend" buttons mapping to `CONFIRM`/`REJECT`. Only reachable for `LEADER`/`ADMIN` — but since it's only ever linked to from the FP-98 notification (Leader-only) or a future nav entry, no explicit role gate needed on the screen itself yet.
7. New `src/features/tenant/services/tenant.service.ts`: `fetchAttendanceWindowHours()` wrapping `GET /api/tenant/settings`, cached in-memory per app session (doesn't change often, avoids refetching every reconciliation).
8. New `src/features/notifications/services/selfReportReminders.service.ts` — `reconcileSelfReportReminders(events: MyEvent[])`: pending set = events where `effective_status` in `('SCHEDULED','ACTIVE')` and `end_datetime` still future (no RSVP filter); fire at `end_datetime`; identifier `selfreport-${eventId}`; cancel if event's `effective_status` becomes `CANCELLED`. Content: event name/time/location, "Did you attend?" — tapping opens the new self-report screen for that event.
9. New `src/features/notifications/services/confirmationReminders.service.ts` — `reconcileConfirmationReminders(events: MyEvent[], role)`: no-ops unless `role === 'LEADER'`. For each qualifying event, calls the roster endpoint to check eligibility, fire at `end_datetime + attendance_window_hours`; identifier `confirmation-${eventId}`; generic content; tapping opens the confirmations list screen (no event-specific data needed in the payload).
10. Extend `NotificationDataPayload` (`src/features/notifications/types.ts`) with a `type: 'reminder' | 'self-report' | 'confirmation'` discriminator, so the root layout's tap handler routes to the right screen.
11. Wire into `app/(app)/index.tsx`: call both new reconcile functions alongside the existing `reconcileEventReminders(data)`, passing the session's role to `reconcileConfirmationReminders`.
12. Extend `app/_layout.tsx`'s `navigateToEventFromNotification` to branch on `data.type` — `reminder` → existing event detail route (unchanged), `self-report` → new self-report route, `confirmation` → new confirmations list route.
13. Register the two new routes in `(app)/_layout.tsx`'s `<Stack>`.

### Files to Create/Modify

```
app/_layout.tsx                                                        (modified)
app/(app)/_layout.tsx                                                  (modified)
app/(app)/index.tsx                                                    (modified)
app/(app)/events/[id]/self-report.tsx                                  (new)
app/(app)/confirmations/index.tsx                                      (new)
src/features/self-reports/types.ts                                    (new)
src/features/self-reports/services/selfReports.service.ts             (new)
src/features/confirmations/types.ts                                    (new)
src/features/confirmations/services/confirmations.service.ts           (new)
src/features/tenant/services/tenant.service.ts                         (new)
src/features/notifications/types.ts                                    (modified)
src/features/notifications/services/selfReportReminders.service.ts    (new)
src/features/notifications/services/confirmationReminders.service.ts  (new)
```

### Migration Files (if applicable)

None.

### Branch Name

`feature/FP-97-98-mobile-self-report-confirmation-reminders`

### Commit Message

`FP-97-FP-98-mobile: self-report reminder + leader confirmation reminder, with real screens for both`

### Pull Request Description

* FP-97: local reminder fires at `end_datetime`, opens a new Self-Report screen (Yes → rating + feedback, No → required reason), regardless of RSVP answer.
* FP-98: local reminder for Leaders with assigned members at an event, fires once the self-report window actually closes (`end_datetime + attendance_window_hours`, corrected from firing at `end_datetime`), opens a new Confirmations list screen backed by the existing `GET /api/confirmations/pending`.
* No new backend — confirmed everything needed already exists.

### Jira Linkage

* PDEEpicID: FP-31 (EPIC-8 — Notification System)
* PDEStoryID: FP-97, FP-98

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-97-FP-98-mobile.md` and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against `dev` and stop. Do not merge — test via `expo start` + Expo Go, then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
