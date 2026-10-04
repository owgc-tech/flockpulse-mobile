### DIP — FP-234 (Mobile): Edit-event screen re-saves only changed assignments, can remove added tasks, and names the failing task

### Not covered — deliberately excluded
- Any server or database change: the web DIP for FP-234 handles stale members and the update function.
- The three core tasks (Food Assignment, Prayer Leader, Music): they stay non-removable, exactly like web.
- The picker screens and any display of removed members.

### Story Summary
Part of FP-234. On the mobile edit-event screen: (1) every existing task assignment is re-sent on every save even when unchanged, so one stale member in any task blocks every save; (2) an added (non-core) task such as Game Master cannot be removed from the event; (3) the save error does not say which task failed. Fix all three, mirroring web where web already behaves correctly.

### Repo Target
Mobile (Expo).

### Grounding Check
Verify against current dev, not assumed:
- app/(app)/events/[id]/edit.tsx builds coreTasks, addedTasks (from addedTaskIds and from non-core tasks that already have an assignment, preAssignedNonCoreTaskIds) and displayedTasks = core + added. The save step runs Promise.all over displayedTasks only: existing and no selection deletes; existing with a selection calls updateEventTaskAssignment with no comparison against what was loaded; no existing and a selection creates. A failure sets "Event updated but one or more task assignments could not be saved: <message>" with no task name.
- Web (app/admin/(shell)/events/EventForm.tsx): handleRemoveTask(taskId) only hides the row (removes it from visibleTaskIds), and only non-core tasks get the Remove button; syncTaskAssignments then iterates visible tasks UNION tasks that already have an assignment, deleting an existing assignment whose task is no longer visible, and skips unchanged ones using sameIds (sorted comparison of group_ids and member_ids).
- Mobile has no Remove control on any task row.

### Implementation Plan
1. Add a small sameIds helper (same behavior as web) in src/features/events/utils.ts. In the save step, for an existing assignment with a selection, compare the originally loaded group_ids and member_ids with the current ones and do nothing when they are equal. Use the values loaded from the server, not state that was already edited.
2. Add a Remove link on each ADDED (non-core) task row only, in the same style as the screen's other text actions. Tapping it hides the row and marks the task removed in local state (for example removedTaskIds); it excludes the task from addedTasks and from availableToAddTasks handling consistently, and it must also drop that task's entry from taskAssignments. Nothing is sent until Save, so leaving the screen without saving undoes it. The save step must iterate displayedTasks UNION existingAssignments' tasks (like web) so an existing assignment whose task was removed gets deleteEventTaskAssignment. Core tasks never get a Remove link.
3. Replace the bare Promise.all with per-task handling (for example Promise.allSettled) so every task is attempted and every failure is reported by name: "Event updated but these task assignments could not be saved: Game Master: <message>; ...". If only one fails, one name. Keep the existing wording prefix for the rest.
4. Do not change the pickers, the create screen, or any other file.

### Files to Create/Modify
- app/(app)/events/[id]/edit.tsx (modify)
- src/features/events/utils.ts (modify, for the helper)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-234-mobile-assignment-save-and-remove

### Commit Message
FP-234-mobile: re-save only changed assignments, Remove for added tasks, name the failing task

### Pull Request Description
Maps to FP-234's mobile criteria. Include tsc and a standalone script that covers: unchanged is skipped (no request); a changed list triggers one update; a different order alone is not a change; a newly assigned task creates; a cleared task deletes; a removed added task deletes its existing assignment on save and sends nothing when it had none; core tasks have no Remove; a failing task is named, two failing tasks are both named, and the others still save. State what you could not test. Manual device steps for Joseph: (1) edit an event with several tasks and change only the name: the assignments endpoint should receive no PATCH; (2) add a person to one task: only that task is updated; (3) tap Remove on an added task and Save: it disappears and stays gone after reopening the event; (4) tap Remove, then leave without saving: the task is still there; (5) with a stale member in another task (before the web DIP ships), the error names that task.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-234

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-234-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not merge. Joseph tests on a real native build and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 12, not a summary.
