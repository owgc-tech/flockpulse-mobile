### Not covered — deliberately excluded
- Any web or server change: slice 1 already provides the endpoint and my_response.
- The Needs Attention and Recently Modified indicators, and the Events tab badge: FP-222.
- Notifications of any kind (dropped in FP-221).
- Any screen showing refusal history or counts: the data is recorded, there is no UI for it.
- The Tasks tab loading cost: FP-233.

### Story Summary
Slice 2 of 3 for FP-221, mobile. Adds Commit and Refuse pills to each task on the My Tasks tab, lets the person change their mind, and makes the Tasks badge (tab and app icon) count only the tasks they have not responded to.

### Repo Target
Mobile (Expo). Depends on web slice 1, which is merged, deployed and has its migrations applied.

### Grounding Check
Verified live this session, not assumed:
- Server (web slice 1): POST /api/event-tasks-assignments/[id]/response with body {"status": "COMMITTED" or "REFUSED"} returns {data: {assignment_id, status, responded_at}}; idempotent; errors include NOT_FOUND, FORBIDDEN_SCOPE (not an assignee), VALIDATION_ERROR (event not SCHEDULED or ACTIVE) and body-validation errors. GET /api/event-tasks-assignments/mine now includes my_response ("COMMITTED", "REFUSED" or null) on each row. Re-verify all of this against the web code on dev before relying on it.
- Mobile: MyTaskAssignment (src/features/tasks/types.ts) has no my_response. listMyTaskAssignments() lives in src/features/tasks/services/tasks.service.ts. The My Tasks screen (app/(app)/(tabs)/my-tasks/index.tsx) renders each row as a Pressable card (task name, event name, start time, location) with a Try Again error state (restored by FP-232) and syncs the badge only on pull-to-refresh; the tabs layout (app/(app)/(tabs)/_layout.tsx) syncs it on mount and foreground.
- Badge: syncMyTasksBadge() (src/features/notifications/services/myTasksBadge.service.ts) currently counts every row (assignments.length), then calls setMyTasksBadgeCount and reportMyTasksBadgeCount (the app icon).
- The existing response-button pattern is src/features/events/components/RsvpControls.tsx; theme colors success and danger exist in src/theme/colors.ts. Reuse their look and spacing.
- apiFetch (after FP-230 and FP-232) already retries once after a rejected token and shows a friendly timeout with Try Again. Do not add auth or retry logic of your own.
- The server returns only SCHEDULED or ACTIVE events, so no "hide after the event ends" rule is needed, and a replaced person's task disappears on the next load.

### Implementation Plan
1. types.ts: add my_response: "COMMITTED" | "REFUSED" | null to MyTaskAssignment, and a TaskResponseStatus type.
2. tasks.service.ts: add submitTaskAssignmentResponse(assignmentId, status) that POSTs the call above through apiFetch.
3. My Tasks card: add two inline pills, Commit and Refuse, below the existing lines. The chosen pill is filled (Commit in the success color, Refuse in the danger color) and the other is outlined; neither is filled when my_response is null. Tapping the already chosen pill does nothing; tapping the other one changes the response. The pills must NOT trigger the card's own onPress (navigation). While a request is in flight, only that card's pills are disabled, with a small indicator; other cards stay usable. Add testIDs and accessibility labels (for example my-task-commit-<id>). A small separate component under src/features/tasks/components/ is fine if it keeps the screen readable.
4. On success: update that item's my_response from the server reply, then call syncMyTasksBadge() so the badge decrements immediately, not only on pull-to-refresh.
5. On failure: show the message inline on that card (apiFetch's friendly messages cover timeouts), leave the previous selection unchanged, and keep the pills enabled to retry. For VALIDATION_ERROR or FORBIDDEN_SCOPE (the event started or ended, or the person was replaced since the last load): show the server message and reload the list so the card reflects reality.
6. syncMyTasksBadge(): count only rows where my_response is null.
7. Change nothing else: the list, refresh and Try Again behavior, and every other screen stay as they are.

### Files to Create/Modify
- src/features/tasks/types.ts (modify)
- src/features/tasks/services/tasks.service.ts (modify)
- app/(app)/(tabs)/my-tasks/index.tsx (modify)
- src/features/notifications/services/myTasksBadge.service.ts (modify)
- src/features/tasks/components/TaskResponsePills.tsx (new, optional)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-221-mobile-task-commit-refuse

### Commit Message
FP-221-mobile: Commit/Refuse pills on My Tasks and a responded-aware badge

### Pull Request Description
Maps to FP-221's mobile acceptance criteria: pills on each task, change of mind, immediate badge decrement, inline errors. Include tsc, plus evidence from a small standalone script that covers the badge-count rule (only my_response null counts) and the shape of the service call (mock apiFetch). State clearly what you could not test, and list the manual device steps for Joseph:
1. As a member with an assigned task, open Tasks: Commit and Refuse pills show, nothing filled. Tap Commit: it fills and the badge drops by one.
2. Tap Refuse: it switches and the badge does not change. Tap Commit again.
3. On the web event page, as the event owner, "Refused: Name" shows while Refuse is selected and is gone after Commit.
4. In the Supabase SQL Editor run: select member_id, status, is_current, cleared_reason, responded_at from event_task_assignment_responses order by responded_at desc limit 10; to see the history rows (earlier answers cleared as SUPERSEDED, newest current).
5. On the web, replace that person on the task, then pull to refresh on the phone: the task is gone.
6. Airplane mode, tap a pill: an inline error shows and the selection is unchanged.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-221 (slice 2 of 3)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-221-mobile-slice-2.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
