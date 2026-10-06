### DIP — FP-242 (Mobile): colored assignee pills on the Event Detail for the event owner and Admins

### Not covered — deliberately excluded
- **Server work.** It is done: web PR 225 is merged (`2e3b72f`), migration `20261006000081` is applied to fpdb-dev, and Vercel is green. This DIP changes no web code and no migration.
- **The "+N more" screen-reader wording on the web page.** That fix is a separate small instruction for CC-web, because it is a different repo.
- **Removing `refused_by` from the server.** That is a later ticket, after every phone runs this build. This DIP keeps reading it as a fallback.
- **The Tasks tab, `TaskResponsePills` (the Commit/Refuse buttons), the Needs Attention and Recently Modified banners, the Tasks badge, and the event edit screen.** All unchanged.
- **Collapsing groups or lowering the 100 cap.** Joseph decides that after seeing it on a device.

### Story Summary
On the mobile Event Detail, the event owner and Admin tier will see each task's assignees as one pill per person:
- green with a ✓ when the person committed;
- red with a ✕ when they refused;
- grey with just the name when they have not answered.

No state words appear on screen; the screen reader announces the state. Group tasks show a small neutral caption with the group name above that group's pills. More than 100 pills ends with a neutral "+N more" pill. This replaces the comma-joined names line and the red "Refused: Name" line for those viewers.

Everyone else sees exactly what they see today. On an older server that does not send the new fields, the screen also falls back to today's display.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). JavaScript only: it ships over the air with `deploy-ios.bat` / `deploy-android.bat`, and no native build is needed. It depends on web PR 225, which is merged and deployed to `preview.flockpulse.ca`.

### Grounding Check
Verified this session, on mobile `dev` at `45002b1` (merge of PR 142) and web `dev` at `2e3b72f` (merge of PR 225). **Re-verify each point first, and report any difference in the PR description.**

**Server contract** (web, merged). Every row of `GET /api/event-tasks-assignments?event_id=X` now carries:
- `assignee_states: { member_id: string; name: string; state: 'COMMITTED' | 'REFUSED' | 'PENDING'; via_group_id: string | null }[]`
  - Already in display order: direct members first (`via_group_id: null`), then each group in `assignee.group_ids` order. Within a section the order is REFUSED, then PENDING, then COMMITTED, then by name.
  - At most 100 entries.
- `assignee_states_total: number`, the uncapped count.
- `refused_by`, same shape as before (now sorted by name).

The server fills all three only for the event owner and Admin tier. Everyone else gets `[]`, `0` and `[]`. Sources: web `src/features/tasks/eventTaskAssignment.types.ts` and `assigneeStates.ts`. Removed members never appear. The screen must **not** re-sort or re-filter the list. It only splits it into sections.

**Types.** `src/features/tasks/types.ts`: `EventTaskAssignment` has `refused_by?: RefusedBy[]` (line 34) and `RefusedBy { member_id; name }` (line 40). It has no field for states yet.

**Service.** `src/features/tasks/services/tasks.service.ts`:
- `listEventTaskAssignments(eventId)` (line 24) maps every row through `normalizeRefusedBy` (line 32). That function is a boundary normalizer: a missing or malformed value becomes `[]`, and entries without a name are dropped.
- Add the same kind of normalizer for the two new fields.

**Screen.** `app/(app)/events/[id].tsx` (1114 lines):
- `resolveAssigneeNames(assignment)` (line 103) fetches `/api/groups?id=` and `/api/members?id=` once per id with `Promise.allSettled`, then returns one comma-joined string: group names first, then member names.
- `taskAssignmentRows` state (line 238) is `{ taskId; taskName; assigneeNames; refusedBy: string[] }[] | null`.
- `loadTaskAssignmentRows` (line 242) keeps only assignments whose assignee has at least one group or member id, then builds those rows.
- The Tasks section (lines 541–566) renders `fieldLabel`, then the names `fieldValue`, then, when `refusedBy` is non-empty, a red bold `Refused: …` line (`testID event-detail-task-refused-${taskId}`, `styles.refusedLine` plus `themed.refusedLine`).
- `getThemedStyles` (line 58) holds the color-bearing keys. `useThemeColors()` is at line 197.
- The screen also computes `isAdminTier` and `canEdit` (lines 436–442) from `role`, `owner_member_id` and `myProfileId`. Do **not** use them to decide pill mode. The server is the gate: pill mode is decided only by the data the server sends.

**Theme.** `src/theme/colors.ts` has `lightColors` and `darkColors` with `ThemeColors = typeof lightColors`. There are no pill tokens yet. The banner tokens (`onDanger`, `onWarning`) were added the same way, with measured ratios in a comment.

**Name clash.** `src/features/tasks/components/TaskResponsePills.tsx` already exists (the Commit/Refuse buttons). Name the new component `AssigneeStatePills.tsx` to avoid confusion.

**Tests.** There is no UI test framework. The existing standalone scripts (`scripts/test-fp240-mobile.ts`, `scripts/test-fp222-mobile-indicators.ts`) stub `react-native`, React and the theme hook, call components as plain functions and walk the element tree. Follow that pattern. `scripts/` is not gitignored in this repo; confirm with `git check-ignore`.

**Contrast.** Atlas measured the suggested hex values below (the web pills' Tailwind colors) with the WCAG formula:

| Theme | Committed | Refused | Pending |
|---|---|---|---|
| Light | 8.30 | 8.20 | 13.55 |
| Dark | 12.30 | 11.16 | 13.55 |

Re-measure the values you actually use and put the table in the PR.

**Invariants.** The screen only reads data. No attendance, RSVP or formation logic is involved. Tenant and access are decided by the server. No new endpoint, and the JSON envelope is unchanged. The phone tolerates an older server: missing fields mean today's behavior (Section 5, rule 15).

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-242-mobile.md`. Branch `feature/FP-242-mobile-assignee-pills` off current `dev`.

2. **Types** (`src/features/tasks/types.ts`).
   - Add `export type AssigneeState = "COMMITTED" | "REFUSED" | "PENDING";`
   - Add `export interface AssigneeStateEntry { member_id: string; name: string; state: AssigneeState; via_group_id: string | null; }`
   - Add two optional fields to `EventTaskAssignment`: `assignee_states?: AssigneeStateEntry[]` and `assignee_states_total?: number`. Comment them: filled only for the owner and Admins; optional so an older server never breaks the screen.

3. **Normalizer** (`tasks.service.ts`). Add `export function normalizeAssigneeStates(states: unknown, total: unknown): { states: AssigneeStateEntry[]; total: number }`.
   - A non-array becomes `[]`.
   - Drop entries that are not objects, or whose `name` is not a non-empty string after trimming, or whose `state` is not one of the three values.
   - `via_group_id` becomes the string or `null`.
   - **Keep the server's order.**
   - `total` is the number when it is a finite integer at least as large as the kept length; otherwise use the kept length.
   - In `listEventTaskAssignments`, normalize both fields alongside `refused_by`.

4. **Pure helper.** New file `src/features/tasks/assigneePillSections.ts` (no React, no I/O).
   - `export function buildPillSections(states: AssigneeStateEntry[], total: number, groupIds: string[], groupNameById: Map<string, string>): PillSection[]`
     - `PillSection` is `{ key: string; caption: string | null; pills: AssigneeStateEntry[]; moreCount: number }`.
     - The first section is the direct members (`caption: null`), included only if non-empty.
     - Then one section per id in `groupIds` order that has at least one entry, captioned with `groupNameById.get(id) ?? "Unknown group"`.
     - Entries whose `via_group_id` is not in `groupIds` go into a last section captioned "Unknown group". This should never happen, but it must never crash.
     - `moreCount = total - states.length` goes on the **last** section only, 0 elsewhere.
     - Returns `[]` when `states` is empty.
   - `export function pillAccessibilityLabel(entry): string`. It returns `"${name}, committed"`, `"${name}, refused"` or `"${name}, not yet responded"`.
   - `export function morePillAccessibilityLabel(n): string`. It returns `"${n} more assignees"`.

5. **Theme tokens** (`src/theme/colors.ts`). Add these nine keys to both palettes, with a comment listing the measured ratios:
   - `pillCommittedBg`, `pillCommittedText`, `pillCommittedBorder`
   - `pillRefusedBg`, `pillRefusedText`, `pillRefusedBorder`
   - `pillPendingBg`, `pillPendingText`, `pillPendingBorder`

   Suggested values, the same as the web pills:

   | Key | Light | Dark |
   |---|---|---|
   | `pillCommittedBg` | `#dcfce7` | `#052e16` |
   | `pillCommittedText` | `#14532d` | `#bbf7d0` |
   | `pillCommittedBorder` | `#86efac` | `#166534` |
   | `pillRefusedBg` | `#fee2e2` | `#450a0a` |
   | `pillRefusedText` | `#7f1d1d` | `#fecaca` |
   | `pillRefusedBorder` | `#fca5a5` | `#991b1b` |
   | `pillPendingBg` | `#f4f4f5` | `#27272a` |
   | `pillPendingText` | `#27272a` | `#f4f4f5` |
   | `pillPendingBorder` | `#d4d4d8` | `#3f3f46` |

   Each text-on-background pair must reach at least 4.5:1, measured and reported.

6. **Component.** New file `src/features/tasks/components/AssigneeStatePills.tsx`, with props `{ sections: PillSection[]; testIDPrefix: string }`. Use `useThemeColors()`, a static `StyleSheet` for structure and themed colors at render time, as in the rest of the app.
   - **Captions:** each caption is small `textSecondary` text, 13px.
   - **Pill row:** each section's pills sit in a `View` with `flexDirection: "row"`, `flexWrap: "wrap"` and `gap: 6`.
   - **Each pill:**
     - It is a `View` with `accessible={true}` and `accessibilityLabel={pillAccessibilityLabel(e)}`, rounded (`borderRadius: 999`), `borderWidth: 1`, with horizontal padding of about 10 and vertical padding of about 3.
     - Its content is a `Text` (13px, weight 600) holding `✓ ` or `✕ ` for committed or refused, then the name. Pending shows the name only.
     - It has `testID={`${testIDPrefix}-pill-${member_id}`}`.
   - **The "+N more" pill:** pending colors, the visible text `+{n} more`, and `accessibilityLabel={morePillAccessibilityLabel(n)}`. The label must not repeat "more".
   - **Never** show the words committed, refused or pending on screen.

7. **Screen** (`app/(app)/events/[id].tsx`).
   - Extend the row type with `pillSections: PillSection[]`.
   - In `loadTaskAssignmentRows`:
     - Keep the existing filter and `resolveAssigneeNames` exactly as they are.
     - For rows whose normalized `total > 0`, build `pillSections`. Group captions need names for the row's `group_ids`: add a small `resolveGroupNames(groupIds): Promise<Map<string, string>>` that uses the same `/api/groups?id=` fetch and `allSettled` pattern as `resolveAssigneeNames`, collected once for all rows (each id fetched once per load).
     - Otherwise `pillSections` is `[]`.
   - **Render rule, per task row:**
     - If `row.pillSections.length > 0`: render the task label, then `<AssigneeStatePills sections={row.pillSections} testIDPrefix={`event-detail-task-${row.taskId}`} />`. Do **not** render the names line or the Refused line.
     - Otherwise: render **exactly today's markup**, the names line plus the Refused line when `refusedBy` is non-empty. This covers non-managers, older servers, and a manager whose group currently has no members: they keep seeing the group name, which is better than a dash.
   - Keep `refusedLine` and its themed style, because the fallback path still uses them.

8. **Tests.** New file `scripts/test-fp242-mobile.ts`, using the same stub-and-walk pattern as `test-fp240-mobile.ts`.
   - **`normalizeAssigneeStates`:**
     - missing, `null` and non-array values become `[]` with total 0;
     - bad entries are dropped (no name, blank name, unknown state, non-object);
     - order is preserved;
     - `via_group_id` is coerced;
     - the total is corrected when it is missing, smaller than the list, or not a number.
   - **`buildPillSections`:**
     - direct only;
     - groups in `group_ids` order;
     - direct plus two groups;
     - empty sections omitted;
     - an unknown `via_group_id` goes to the last section without throwing;
     - `moreCount` is only on the last section (100 shown out of 150 gives 50);
     - empty input gives `[]`.
   - **Labels:** the three labels and the more label, with no doubled "more".
   - **`AssigneeStatePills`, rendered as a function in both themes:**
     - one pill per entry, with the ✓ or ✕ mark or none;
     - no visible state word in any `Text` (scan every string);
     - the accessibility labels are correct;
     - captions are present for group sections and absent for the direct section;
     - the "+N more" pill is present only when `moreCount > 0`.
   - **Screen render rule:** test the pure decision (pills versus fallback) by extracting it as a helper if needed. With `pillSections` empty and `refusedBy` set, the old Refused line is used.
   - **Contrast:** compute the six WCAG ratios from the token values and fail below 4.5.
   - **Regressions:** also run `scripts/test-fp240-mobile.ts` and `scripts/test-fp222-mobile-indicators.ts`, and report the results.

9. **Checks.** Run `npx tsc --noEmit`. Commit, push, and run `gh pr create --base dev`.

### Files to Create/Modify
- Create:
  - `documentation/dips/DIP-FP-242-mobile.md` (saved verbatim, then frozen)
  - `src/features/tasks/assigneePillSections.ts`
  - `src/features/tasks/components/AssigneeStatePills.tsx`
  - `scripts/test-fp242-mobile.ts`
- Modify:
  - `src/features/tasks/types.ts`
  - `src/features/tasks/services/tasks.service.ts`
  - `src/theme/colors.ts`
  - `app/(app)/events/[id].tsx`
- Must stay untouched. Show `git diff dev feature/FP-242-mobile-assignee-pills -- <file>` with zero output for each:
  - `src/features/tasks/components/TaskResponsePills.tsx`
  - `app/(app)/(tabs)/my-tasks/` (the Tasks tab)
  - `src/lib/api.ts`
  - `app/(app)/events/[id]/edit.tsx`
  - `src/features/events/components/EventIndicatorBanners.tsx`

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-242-mobile-assignee-pills

### Commit Message
FP-242-mobile: show task assignees as colored state pills for the event owner and Admins

### Pull Request Description
Plain GitHub markdown. Include the following.

**Summary.** Say that this depends on web PR 225, which is merged and deployed, and that it ships over the air (JavaScript only).

**Acceptance criteria → behavior**, one line each, with evidence:
- The owner or an Admin sees pills: green ✓, red ✕, grey name-only, with no state words.
- A group task shows the caption with one pill per member, and "+N more" past 100.
- A changed response, or a replaced person, updates after pull-to-refresh or reopening the screen.
- A non-owner Leader or a Member sees exactly today's rows.
- Screen-reader labels work, and the contrast table shows every pill at 4.5:1 or better in both themes.
- Banners, badge, Tasks tab and edit screen are unchanged (zero-output diffs).

**Fallbacks.** Describe the older-server case and the empty-group case.

**Deviations from the DIP**, with reasons, including any grounding claim that turned out to be wrong.

**Not tested.** A real device in either theme; VoiceOver and TalkBack (only the labels in the element tree were checked); a real large group on a phone; the hosted API (unless you called it); the over-the-air deploy.

**Manual device steps for Joseph**, after `deploy-ios.bat` and `deploy-android.bat`. First check the update ID against the `Update:` line on the login screen, then force-quit and reopen twice, on every phone. Then:
1. As Admin, open an event with a task where one person committed, one refused and one has not answered. You should see three pills (green ✓, red ✕, grey) and no "Refused:" line.
2. Open a task assigned to a group. You should see the group name above one pill per member.
3. On a Member phone, have the refuser switch to Commit. On the Admin phone, pull to refresh: the pill turns green.
4. On a non-owner Leader phone and a Member phone, the same event's Tasks rows should look exactly as before.
5. Switch the phone to dark mode. The pills should stay readable.
6. Optional: turn on VoiceOver or TalkBack and check a pill reads as "Name, committed", and so on.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-242

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-242-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
