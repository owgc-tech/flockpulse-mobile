### DIP — FP-213 (Mobile): neutral wording: "Formation Talk" → "Training Session"

### Not covered — deliberately excluded
- **The web app.** It has its own DIP, `DIP-FP-213-web`, which is independent of this one. The "what changed" banner labels (`modified_fields`) come from the server and change with the web DIP; no mobile change is needed for them.
- **API paths, types and identifiers:** `/api/talks`, the `Talk` interface, `talk_id`, `EventReminderFormation`, `src/features/formation/`, function and variable names, and comments.
- **Reminder notification content:** it shows the course › module › session *names*, which are tenant data, and contains no label word.
- **Tenant data,** such as an event type named "Formation".
- **Native configuration.** This is JavaScript only and ships over the air.

### Story Summary
FlockPulse serves any kind of organization. This DIP changes every **user-visible** "Formation" / "Talk" in the mobile app:
- "Formation" becomes **"Training"**;
- "Talk" becomes **"Session"**.

Decided 2026-11-19 (Joseph): labels only on mobile; the words are Training and Session.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). No server dependency: it works the same against the current and future web builds.

### Grounding Check
**Verified by Atlas this session** (read from `origin/dev` at `db90ee7`). These are the known user-visible strings:
- `app/(app)/events/[id].tsx:614`: field label "Formation Talk".
- `app/(app)/events/[id]/edit.tsx`:
  - line 179: "Formation Talk (optional)";
  - line 188: "Select Course" / "Select Module" / "Select Talk";
  - line 429: "Talk selected (tap to change)".
- `app/(app)/events/create.tsx`:
  - line 163: "Formation Talk (optional)";
  - line 172: "Select Talk".

**Not verified. Check first and report** every other user-visible string containing Formation, Talk, Talks, formation or talk in `app/` and `src/`:
- `Text` content, `accessibilityLabel` and `accessibilityHint`, `placeholder`, `Alert.alert` titles and messages;
- empty and error states, and screen titles in layouts.

**Rules check:**
- No API or contract change.
- Theming and accessibility are untouched apart from the wording; update the accessibility labels' text in the same way.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-213-mobile.md`. Create `feature/FP-213-neutral-wording` off current `dev`. Report the full list of strings found before editing.
2. **Labels.** Apply these rules:
   - "Formation Talk" → "Training Session";
   - "Formation Talk (optional)" → "Training Session (optional)";
   - "Select Talk" → "Select Session";
   - "Talk selected (tap to change)" → "Session selected (tap to change)";
   - any other user-visible "Formation" → "Training", and "Talk(s)" → "Session(s)".

   Keep "Course" and "Module". Do not change identifiers, imports, types, API paths or comments.
3. **Test script:** `scripts/test-fp213-wording.ts`, run with `npx tsx`. It fails if any user-visible string literal or JSX text in `app/` or `src/` still contains `\bFormation\b` or `\bTalks?\b`. It skips import lines, comments and type names, and keeps an explicit allowlist with a reason for each entry. Print what it found.

   **Report-only (does not fail):** also list every user-visible string containing any of these words: Pastoral, Prayer, Church, Bible, Scripture, Worship, Ministry, Fellowship, Parish, Congregation, Sermon, Pastor, Faith, God, Spirit, Shepherd, Retreat, Gospel, Holy, Devotion, Praise. The expected hit is `CORE_TASK_NAMES` ("Prayer Leader") in `src/features/tasks/types.ts`, which is out of scope and tracked separately in FP-261. Paste the full list in the PR.
4. **Checks.** Run `npx tsc --noEmit`, the repo's lint step if there is one, and the script. There is no UI test framework, so say plainly that nothing was checked on a device. `git diff dev --stat` must list only the expected files.
5. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-213-mobile.md` (verbatim, then frozen);
  - `scripts/test-fp213-wording.ts`.
- **Modify:**
  - `app/(app)/events/[id].tsx`;
  - `app/(app)/events/[id]/edit.tsx`;
  - `app/(app)/events/create.tsx`;
  - any other file found in grounding.
- **Must stay untouched:** `src/features/formation/services/`, `src/features/formation/types.ts`, `src/lib/api.ts`, `app.json` and `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-213-neutral-wording

### Commit Message
FP-213: rename Formation Talk to Training Session in mobile labels

### Pull Request Description
Plain GitHub markdown. Include:
- a table of every string changed: file, old text, new text;
- the script output and its allowlist;
- what was deliberately not renamed, and why.

**Not tested:** any device. This is JavaScript only and ships over the air.

**Steps for Joseph:**
1. Merge into `dev`.
2. From the mobile folder on `dev`, run `deploy-ios.bat "FP-213 neutral wording"` and `deploy-android.bat "FP-213 neutral wording"`.
3. On each test phone:
   - compare the printed update ID with the `Update:` line on the login screen;
   - force-quit and reopen the app twice.
4. Check that:
   - an event that has a session shows "Training Session" on its detail screen;
   - create and edit event show "Training Session (optional)" and "Select Session".

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-213

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-213-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
