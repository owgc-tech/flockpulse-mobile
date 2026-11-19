### DIP — FP-261 (Mobile): use the task's "Always show on events" setting instead of CORE_TASK_NAMES

### Not covered — deliberately excluded
- **The server side:** the migration, the API and the Tasks page are in `DIP-FP-261-web`, which must be merged and deployed first.
- **A Tasks settings screen on the phone.** The setting is managed on the web only.
- **Auto-assign, My Tasks, and event detail display.** They don't use `CORE_TASK_NAMES` (verify).

### Story Summary
The phone hardcodes `CORE_TASK_NAMES = ["Prayer Leader", "Food Assignment", "Music"]`. Tasks with those names always appear on the create and edit event screens. The server now sends `always_show` on every task (FP-261 web), so the phone uses that field instead and the hardcoded list is deleted. Decided 2026-11-19 (Joseph).

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). **Depends on `DIP-FP-261-web` being merged and deployed to preview, with its migration applied.**

**Send this DIP only after `DIP-FP-213-mobile` is merged.** Both edit `create.tsx` and `edit.tsx`.

### Grounding Check
**Verified by Atlas this session** (`origin/dev` at `db90ee7`):
- `src/features/tasks/types.ts`:
  - the `Task` type has `individual_only: boolean` (line 13);
  - `export const CORE_TASK_NAMES` is defined at line 66.
- `app/(app)/events/create.tsx`:
  - imports `CORE_TASK_NAMES` (line 29);
  - filters core tasks and the remaining tasks by name, around line 414.
- `app/(app)/events/[id]/edit.tsx`:
  - imports it (line 37);
  - line 485: `coreTasks = tasks.filter(t => CORE_TASK_NAMES.includes(t.name))`;
  - line 504 excludes core tasks from the "add" list.
- Tasks come from `listTasks` in `src/features/tasks/services/tasks.service.ts`, which reads `GET /api/tasks` through `apiFetch`.

**Re-verify all of the above** after FP-213 mobile has merged. Also confirm that `CORE_TASK_NAMES` is used nowhere else.

**Rules check:**
- The phone must tolerate an older server: a missing `always_show` is treated as false.
- No new endpoint.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-261-mobile.md`. Create `feature/FP-261-task-always-show` off current `dev`.
2. **`types.ts`.**
   - Add `always_show?: boolean` to `Task`, with a comment: "FP-261: missing on older servers = false".
   - Delete `CORE_TASK_NAMES` and its comment.
3. **A pure helper,** in the tasks feature folder: `isAlwaysShown(task: Task): boolean`, which returns `task.always_show === true`.
4. **`create.tsx` and `edit.tsx`.** Replace every `CORE_TASK_NAMES.includes(t.name)` with `isAlwaysShown(t)`, and rename `coreTasks` to `alwaysShownTasks`. No other behavior changes.
5. **Test script** `scripts/test-fp261-always-show.ts`, run with `npx tsx`. It checks that `isAlwaysShown` returns:
   - true for `{always_show: true}`;
   - false for `false`;
   - false when the field is missing;
   - false for a task *named* "Prayer Leader" without the flag.

   It also checks by grep that `CORE_TASK_NAMES` is gone from `app/` and `src/`.
6. **Checks.**
   - Run `npx tsc --noEmit`, lint if present, and the script.
   - State plainly that nothing was checked on a device.
   - `git diff dev --stat` lists only the expected files.
7. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-261-mobile.md` (verbatim, then frozen);
  - the helper file (or add the helper to an existing tasks utility file);
  - `scripts/test-fp261-always-show.ts`.
- **Modify:**
  - `src/features/tasks/types.ts`;
  - `app/(app)/events/create.tsx`;
  - `app/(app)/events/[id]/edit.tsx`.
- **Must stay untouched:** `src/lib/api.ts`, `app.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-261-task-always-show

### Commit Message
FP-261: use task always_show instead of CORE_TASK_NAMES

### Pull Request Description
Plain GitHub markdown. Include:
- the behavior mapped to FP-261's acceptance criteria;
- the script output;
- the older-server behavior: without `always_show`, no task is auto-shown, and tasks are added by hand.

**Not tested:** any device. JavaScript only, so it ships over the air.

**Steps for Joseph:**
1. Make sure FP-261 web is merged, its migration is applied and preview is Ready.
2. Merge this PR into `dev`.
3. Run `deploy-ios.bat "FP-261 always show tasks"` and `deploy-android.bat "FP-261 always show tasks"`.
4. On each test phone:
   - compare the update ID with the login screen;
   - force-quit and reopen the app twice.
5. Check that:
   - Create Event shows Prayer Leader, Food Assignment and Music automatically, as before;
   - a task you ticked "Always show" on the web also appears;
   - editing an existing event still shows its assigned tasks.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-261

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-261-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
