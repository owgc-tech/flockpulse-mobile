### DIP — FP-216 (Mobile)

### Story Summary
Fixes Announcement-type events incorrectly receiving a self-report reminder notification ("Did you attend? Let us know how it went."). Confirmed via direct code trace: `reconcileSelfReportReminders()` schedules a reminder for any event that's `SCHEDULED`/`ACTIVE` with a future `end_datetime` — it never checks whether the event is an Announcement, unlike the sibling `announcementReminders.service.ts`, which already correctly makes this exact check.

### Repo Target
Mobile (Expo) — single file.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`, this session:
- `reconcileSelfReportReminders()` (`src/features/notifications/services/selfReportReminders.service.ts`)'s `pending` filter checks only `effective_status` and `end_datetime` — no event-type check anywhere in the function.
- The correct, already-proven exclusion pattern exists in the sibling file `announcementReminders.service.ts`: `event.event_type?.system_key !== "ANNOUNCEMENT"` — confirmed by reading its actual current usage, not assumed from naming convention alone.
- This is purely additive to the existing filter condition — no other part of the function's logic (cancellation of stale reminders, the actual `scheduleNotificationAsync` call) needs to change.

### Implementation Plan
1. In `selfReportReminders.service.ts`, add `event.event_type?.system_key !== "ANNOUNCEMENT"` as an additional condition in the `pending` filter (alongside the existing `effective_status`/`end_datetime` checks) — an Announcement event should never enter the `pending` set at all, so it's naturally excluded from scheduling and, on a subsequent reconciliation pass, correctly cancelled if a stale reminder was scheduled for it before this fix (via the existing `toCancel` logic, unchanged).

### Files to Create/Modify
- `src/features/notifications/services/selfReportReminders.service.ts` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-216-mobile-exclude-announcements-self-report-reminder

### Commit Message
FP-216-mobile: exclude Announcement events from self-report reminders

### Pull Request Description
Maps to FP-216's acceptance criteria: Announcement events no longer receive self-report reminder notifications, using the same exclusion check already proven correct in `announcementReminders.service.ts`. No change to self-report reminders for regular events, and no change to the existing, separate Announcement acknowledgement reminder. Confirm in the PR that any previously-scheduled self-report reminder for an existing Announcement gets correctly cancelled on the next reconciliation pass, not just that new ones stop being created.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-216

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-216-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
