DIP-FP-152.md
Story Summary
Redesigns the Self-Report tab to match the Confirmation tab's existing UX exactly: no separate detail screen, decision buttons live directly on each record's card, and submitting immediately, optimistically removes the card and resyncs the badge — no re-fetch needed. Unlike Confirmation's single-tap decision, Self-Report's "Did Not Attend" needs a required reason and "Attended" accepts an optional rating/feedback, so the card uses the same select-then-reveal-then-submit two-step flow the current standalone screen already has, just embedded inline instead of on a separate screen. The standalone screen (events/[id]/self-report.tsx) is fully retired — including its second entry point via push notifications, which is redirected to the tab itself, mirroring how the "confirmation" notification type already routes to its list screen with no event-specific params.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

Confirmation tab's exact pattern (confirmations/index.tsx): handleDecision calls the submit API, then setItems((prev) => prev.filter((i) => i.self_report_id !== item.self_report_id)) for instant local removal, then syncConfirmationBadge() immediately — no re-fetch. ConfirmationItem is its own component with per-item submitting/error state. This is the structure to mirror.
The standalone self-report form's exact logic (events/[id]/self-report.tsx, to be retired): attended: boolean | null selection state → conditional reveal (Rating via STAR_VALUES = [1,2,3,4,5] + optional Feedback for true; required Reason for false) → a separate Submit button gated on attended !== null → submitSelfReport(eventId, status, options) → on ApiError with code SELF_REPORT_ALREADY_SUBMITTED, treated as a soft-success path (shown as "already responded"), not a hard error.
A second entry point beyond the tab, confirmed via grep: app/_layout.tsx's push-notification deep-link handler routes type === "self-report" notifications directly to events/[id]/self-report. Joseph's explicit decision (Option B): redirect this to the tab instead — mirroring the adjacent type === "confirmation" handler, which already does exactly this (router.push("/(app)/confirmations"), no event-specific params, since that list re-queries itself fresh on mount). Self-report's notification routing changes identically: router.push("/(app)/(tabs)/self-report"), dropping the now-unused id/event params.
Scale confirmation from Joseph: the Self-Report tab's purpose is specifically a durable fallback for a missed notification, not a high-volume queue — realistically one or two items at a time. No "scroll to this specific card" mechanism is needed for the notification-redirect path; landing on the tab and finding the (typically single) relevant card is sufficient.
Once the notification path is redirected and the tab uses inline cards, events/[id]/self-report.tsx has zero remaining callers — confirmed via repo-wide grep before this DIP, to be re-confirmed by the implementer before deleting.
syncSelfReportBadge() (selfReportBadge.service.ts) is reused unchanged — same function, just called immediately after a successful submission (matching Confirmation's precedent) instead of only on manual pull-refresh.
Domain rules: no conflict — same submission call (submitSelfReport), same validation, no service-layer changes.

Implementation Plan

app/(app)/(tabs)/self-report/index.tsx (major rewrite):

Remove handlePress, toRouteEvent, and the router.push navigation entirely.
Add a new SelfReportItem component (per-item, mirroring ConfirmationItem's structure): renders event name/date/location, then attended: boolean | null state with Attended/Did Not Attend selection buttons, conditional reveal (Rating + Feedback for Attended; required Reason for Did Not Attend — same validation as the retired screen), a Submit button gated on attended !== null, and per-item isSubmitting/error state.
On successful submission (or a caught SELF_REPORT_ALREADY_SUBMITTED), call a passed-down onSubmitted(eventId) callback rather than navigating anywhere.
Parent screen's onSubmitted handler: setItems((prev) => prev.filter((i) => i.event_id !== eventId)) then syncSelfReportBadge().catch(...) — immediately, not gated on isRefresh like the current mount-only sync.


app/_layout.tsx: change the type === "self-report" notification handler to router.push("/(app)/(tabs)/self-report"), dropping the id/event params (mirroring the adjacent confirmation handler exactly).
Delete app/(app)/events/[id]/self-report.tsx — confirm zero remaining callers first.
app/(app)/_layout.tsx: remove the now-dead <Stack.Screen name="events/[id]/self-report" /> registration.

Files to Create/Modify

app/(app)/(tabs)/self-report/index.tsx
app/_layout.tsx
app/(app)/_layout.tsx
app/(app)/events/[id]/self-report.tsx (deleted)

Migration Files
Not applicable.
Branch Name
feature/FP-152-self-report-inline-cards
Commit Message
FP-152: redesign Self-Report tab to inline cards, mirroring Confirmation tab (retires standalone screen)
Pull Request Description
Maps to acceptance criteria:

"No separate screen, decisions inline on the card" → SelfReportItem, mirroring ConfirmationItem.
"Did Not Attend requires reason, Attended optionally accepts rating/feedback, two-step select-then-submit" → same validation/flow as the retired standalone screen, just embedded.
"Optimistic removal + immediate badge resync" → matches Confirmation's exact pattern.
"Verify other navigation paths before retiring the standalone screen" → found and handled the notification deep-link path (Option B, confirmed by Joseph): redirected to the tab, mirroring the existing confirmation notification handler precedent exactly.

Jira Linkage

PDEEpicID: FP-18 (EPIC-5)
PDEStoryID: FP-152

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-152.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for every file in the completion report, including the deletion.
