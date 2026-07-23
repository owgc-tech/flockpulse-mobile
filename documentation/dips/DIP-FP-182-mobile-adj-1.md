DIP-FP-182-mobile-adj-1

Story Summary
Corrects PR #74 (feature/FP-182-mobile-dashboard-tab), which was built against a guessed API contract rather than the real one, and has three serious problems: none of its API calls match the actual web endpoints (two of them silently reuse an unrelated, unscoped endpoint instead), feedback displays a member name in direct contradiction of the story's anonymity requirement, and the tab's landing-route wiring was set backwards (still lands on My Events, not Dashboard). Also fixes two missing stat buckets and a date-format gap.

Repo Target
Mobile (Expo/React Native), owgc-tech/flockpulse-mobile. Continues on the existing branch feature/FP-182-mobile-dashboard-tab (PR #74 already open) — do not open a new branch or PR.

Grounding Check
- The real endpoints (once DIP-FP-182-web-adj-1 lands) are GET /api/reports/dashboard/event-types, GET /api/reports/dashboard/events?event_type_id=, GET /api/reports/dashboard/default, GET /api/reports/dashboard/stats?event_id= — confirmed by reading the actual web PR's route files directly, not the mobile PR's own guessed paths.
- member_name must be removed entirely, not just left unpopulated — it was actually rendered on screen (a dedicated bold Text element above each feedback entry), directly contradicting the story's explicit "no attribution, enforced at the data layer, can't be recovered from network traffic either" requirement.
- The landing-route mistake was a deliberate (if mistaken) choice, evidenced by the PR's own comment explaining why it kept initialRouteName="index" — the story's own confirmed decision is explicit that Dashboard becomes the landing route.
- This DIP depends on DIP-FP-182-web-adj-1 landing first, since the corrected field names (did_not_attend_count, did_not_self_report_count, average, rounded, tentative_count, and feedback as {star_rating, feedback} pairs) only exist after that fix.

Implementation Plan
1. Fix every API call in src/features/dashboard/services/dashboard.service.ts to hit the real paths: /api/reports/dashboard/event-types, /api/reports/dashboard/events?event_type_id=, /api/reports/dashboard/default, /api/reports/dashboard/stats?event_id=. Remove the two calls that were quietly reusing the unrelated general /api/event-types and /api/event-types/:id/events endpoints entirely — those don't do the required visibility/year/already-held filtering, and were never the intended source for this feature.
2. Update src/features/dashboard/types.ts to match the corrected web contract:
   - DashboardAttendanceStats: attended_count, did_not_attend_count, did_not_self_report_count, expected_count, percent (drop the invented attendance_rate; band off attended_count / expected_count computed locally, or off percent directly).
   - DashboardRsvpStats: yes_count, no_count, tentative_count, no_response_count (drop the invented total_invited; compute a total locally as the sum of all four if needed for display).
   - DashboardRatingStats: average (raw), rounded, rating_count, feedback: { star_rating: number | null; feedback: string }[] — remove member_name from the feedback entry type entirely, not just stop reading it.
   - DefaultDashboard/DashboardEventType field names updated to match whatever the real endpoints actually name their event-type object ({id, name} nested under event_type, per the web DIP), rather than the flat event_type_id/event_type_name guessed here.
3. Fix the Attendance card to show all three counts (Attended, Did Not Attend, Did Not Self-Report), not just a percentage and "X of Y expected."
4. Fix the RSVP card to show all four counts (Accepted, Declined, Tentative, Did Not Respond) — currently Tentative is missing entirely.
5. Remove the feedback name display in StatsCards — delete the feedbackName Text element and its style entirely; render only the star rating (if present) and the feedback text.
6. Fix formatEventOptionLabel to include the year: { month: "short", day: "numeric", year: "numeric" }, matching Joseph's own example ("Jul 19, 2026 — Community Assembly").
7. Fix the landing route: change initialRouteName from "index" to "dashboard/index" in _layout.tsx, and update/remove the comment that currently justifies the wrong choice.
8. Double-check the icon-only tab's footprint: confirm whether rendering null instead of an empty-string Text for the label keeps this tab visually the same height as the other four (which have both an icon and a label stacked with a gap) — if it visibly sits shorter/differently centered, render an empty Text element instead of null so the layout slot is still reserved, per the story's explicit "same total visual footprint" requirement.

Files to Create/Modify
- src/features/dashboard/services/dashboard.service.ts (modify — all four functions' paths)
- src/features/dashboard/types.ts (modify — all four interfaces)
- app/(app)/(tabs)/dashboard/index.tsx (modify — Attendance/RSVP card content, feedback rendering, date format)
- app/(app)/(tabs)/_layout.tsx (modify — initialRouteName)
- src/features/navigation/AnimatedTabBar.tsx (modify only if the footprint check in step 8 finds a real visual mismatch)

Migration Files
None.

Branch Name
Continue on the existing feature/FP-182-mobile-dashboard-tab (no new branch).

Commit Message
FP-182-mobile-adj-1: fix API contract mismatch, remove feedback attribution, fix landing route, add missing stat buckets

Pull Request Description
Add to the existing PR #74's description (don't replace it):
- Confirm every API call now hits a real, matching web route — list all four before/after paths explicitly.
- Confirm member_name is gone from both the type and the rendered UI — screenshot the feedback section.
- Confirm the app now actually lands on the Dashboard tab after login.
- Confirm the Attendance and RSVP cards now show their full required bucket counts.
- Note this still depends on DIP-FP-182-web-adj-1 being pushed first, since the field names only line up once that lands.

Jira Linkage
- PDEEpicID: FP-36
- PDEStoryID: FP-182

Stop Point
This is a correction to the still-open PR #74 — push these changes as additional commits on the existing feature/FP-182-mobile-dashboard-tab branch. Do not open a new PR. Do not append to DIP-FP-182-mobile.md (that file is frozen) — record corrections only in the PR description. Stop once pushed; the user will re-review before merging.

Include full diffs for every changed file, no elisions.
