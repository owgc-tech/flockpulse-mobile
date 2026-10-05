### DIP — FP-222-adj-1 (Mobile): Show who refused on the event detail; remove the 204 workaround

### Not covered — deliberately excluded
- Any server or web work: web adj-1 provides refused_by on the assignments endpoint and the JSON response of the view endpoint.
- The card and its strips: they already show the task names and the Changed line once web adj-1 is deployed, with no mobile change (the card deliberately shows task names only, never people).
- Any visibility rule: the server returns refusing people's names only to the event's owner and to Admins, so the phone just displays what it receives.

### Story Summary
A first device test showed that the event owner's detail screen says "NEEDS ATTENTION" but not WHO refused, while the web event page shows "Refused: Name" in red bold under the task. Show the same on the mobile detail screen, under the task's assignees, for the owner and Admins (the server decides who receives the names). Also remove the workaround in recordEventView that treats a parse error as success, now that the web view endpoint returns JSON.

### Repo Target
Mobile (Expo). Depends on web adj-1 being deployed.

### Grounding Check
Verified this session by reading the code, not assumed (re-verify first):
- src/features/tasks/types.ts: EventTaskAssignment has id, tenant_id, event_id, task_id, assignee, created_at, updated_at.
- app/(app)/events/[id].tsx builds taskAssignmentRows ({ taskId, taskName, assigneeNames }) in loadTaskAssignmentRows from listTasks() and listEventTaskAssignments(eventId) (GET /api/event-tasks-assignments?event_id=), and renders each row with its assigneeNames in the Tasks section (about line 552). loadTaskAssignmentRows already runs on focus and on pull to refresh.
- Web adj-1 adds refused_by: { member_id: string; name: string }[] to each assignment row of that endpoint: the current outstanding refusals, filled only for the event's owner and Admin tier and an empty array for every other caller.
- src/features/events/services/events.service.ts recordEventView (FP-222 part 2) currently returns normally when apiFetch throws a SyntaxError, because the web view endpoint used to answer 204 with no body. Web adj-1 changes it to 200 with { data: { version } }. VERIFY the deployed web really returns that (call it once on a real event and inspect the response) before removing the workaround; if the deployed web still answers 204, stop and report instead of removing it.
- The web event page's style for this line is red and bold ("Refused: Name", text-red-600 dark:text-red-400, font-bold).

### Implementation Plan
1. Types: add an optional refused_by to EventTaskAssignment. In listEventTaskAssignments normalize at the boundary: a missing, null or malformed refused_by becomes [], and entries without a non-empty name are dropped, so an older server never breaks the screen.
2. Detail screen: add refusedBy: string[] (the names) to each taskAssignmentRows entry, built from the assignment's refused_by. In the Tasks section, directly under a row's assignee names and only when refusedBy is not empty, render one line "Refused: Name, Name" in the danger theme color, bold, with the same font size as the assignee line; text plus bold, so it never relies on color alone. testID event-detail-task-refused-<taskId> and an accessibilityLabel such as "Refused by Name, Name". No new fetch: it appears on load, on focus and on pull to refresh through the existing loader, and disappears when the refusal is cleared.
3. recordEventView: after verifying the deployed web returns 200 JSON, remove the SyntaxError shortcut so every error is rethrown; update its comment accordingly. Callers stay fire-and-forget with console.warn.
4. Standalone script (extend the existing FP-222 mobile script or add one): the normalizer for refused_by (missing, null, wrong types, empty names), the row mapping with one and with several refusers, no refusal line for rows without refusals, and the recordEventView request shape and that a SyntaxError is now rethrown.
5. Change nothing else.

### Files to Create/Modify
- src/features/tasks/types.ts and src/features/tasks/services/tasks.service.ts (modify)
- app/(app)/events/[id].tsx (modify)
- src/features/events/services/events.service.ts (modify)
- The FP-222 mobile script (extend) or a new scripts/test-fp222-mobile-adj1.ts

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-222-mobile-adj-1-refused-names

### Commit Message
FP-222-mobile-adj-1: show who refused on the event detail; drop the 204 workaround

### Pull Request Description
Maps to the FP-222 requirement found in the first device test: the owner sees who refused on the mobile detail like on the web page. Include tsc, the script results, the check you made against the deployed web before removing the workaround, and what you could not test. Manual device steps for Joseph:
1. As the owner (or an Admin), on an event where someone has refused a task, open the event detail: under that task the red bold line "Refused: Name" appears, matching the web page.
2. The person changes their mind to Commit (or you replace them), then refocus or pull to refresh: the line disappears and the red NEEDS ATTENTION strip goes away on the next list refresh.
3. On a plain member's phone the line never appears, even for the member who refused.
4. Open an event (this records a view): nothing visible changes, and with airplane mode on no error is shown.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-222 (mobile adj-1)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-222-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
