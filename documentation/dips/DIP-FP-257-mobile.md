### DIP — FP-257 (Mobile): Leaders no longer see rating or feedback when confirming attendance

### Not covered — deliberately excluded
- **The server half** (the anonymous `event_feedback` table, the data move, removing the fields from `GET /api/confirmations/pending`): `DIP-FP-257-web`. This DIP is independent and can be merged before or after it.
- **The member's self-report screen:** members still give a rating and feedback exactly as today. `submitSelfReport` and `SelfReportResponse` are unchanged.
- **The Board (Dashboard "Rating & Feedback" card):** the server keeps the same shape, so no change.

### Story Summary
Feedback is anonymous (Joseph, 2026-11-18): no one, including Leaders, may see who wrote it. Today the Leader's confirmation card shows the member's name together with their rating and feedback. This DIP removes those two lines and stops the app's type from expecting the fields, so the card works with both the old server (which still sends them) and the new one (which does not). It supersedes STORY-6.2/6.5 (Leader sees feedback when confirming).

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`), JavaScript only, shipped over the air. No server dependency in either direction.

### Grounding Check
**Verified by Atlas this session** (`origin/dev` at `7e3fb64`):
- **`app/(app)/(tabs)/confirmations/index.tsx`** lines 169–170 render `Rating: {item.star_rating}/5` and `{item.feedback}` when the report is "attended".
- **`src/features/confirmations/types.ts`** `PendingConfirmationRow` has `feedback: string | null` and `star_rating: number | null` (lines 23–24).
- **Other mobile uses** of `feedback`/`star_rating`: the self-report submit screen and service (member's own input, unchanged), the Dashboard card (anonymous list, unchanged), and `src/features/self-reports/types.ts` `SelfReportResponse` (unchanged; the server keeps echoing them).

**Re-verify all of the above first,** and grep `app` and `src` for `feedback` and `star_rating` again; list every hit and whether you changed it.

**Rules check:** no new endpoint; no raw errors shown; the card must not leave an empty gap where the lines were; theming unchanged.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-257-mobile.md`. Create `feature/FP-257-hide-feedback-on-confirm` off current `dev`.
2. **`confirmations/index.tsx`:** delete the two lines that show rating and feedback. Leave a one-line comment: feedback is anonymous and never shown to Leaders (FP-257). Change nothing else on the card.
3. **`confirmations/types.ts`:** remove `feedback` and `star_rating` from `PendingConfirmationRow`, and update the header comment (the server stops sending them with FP-257; an older server may still send them and the app ignores them).
4. **Test script** `scripts/test-fp257-confirm-card.ts` (`npx tsx`):
   - grep that `confirmations/index.tsx` no longer contains `feedback` or `star_rating`;
   - grep that `PendingConfirmationRow` no longer declares them;
   - grep that `self-report/index.tsx` still sends `feedback` and `starRating` (the member's side is unchanged).
5. **Checks.** `npx tsc --noEmit`, the new script and the existing scripts. State plainly that nothing was checked on a device. `git diff dev --stat` lists only the expected files.
6. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-257-mobile.md` (verbatim, then frozen);
  - `scripts/test-fp257-confirm-card.ts`.
- **Modify:**
  - `app/(app)/(tabs)/confirmations/index.tsx` (the two lines only);
  - `src/features/confirmations/types.ts`.
- **Must stay untouched:** `app/(app)/(tabs)/self-report/index.tsx`, `src/features/self-reports/*`, `app/(app)/(tabs)/dashboard/index.tsx`, `src/features/dashboard/types.ts`, `app.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-257-hide-feedback-on-confirm

### Commit Message
FP-257: stop showing rating and feedback on the Leader's confirmation card

### Pull Request Description
Plain GitHub markdown. Include: what was removed and why (anonymity, superseded STORY-6.2/6.5); behavior against old and new servers; the grep list; the script output; deviations from this DIP.

**Not tested:** any device.

**Steps for Joseph:**
1. Merge into `dev`.
2. Run `deploy-ios.bat "FP-257 hide feedback on confirm"` and `deploy-android.bat "FP-257 hide feedback on confirm"`.
3. On each test phone: force-quit and reopen twice (check the update ID on the login screen when you next see it).
4. As a test member, submit "Yes" with a rating and a comment on a finished event. As that member's Leader, open Confirmations: the card shows the name, event and status, but **no rating and no comment**. Confirm works as before.
5. The Board still shows the rating and comment, with no name.

### Jira Linkage
- PDEEpicID: FP-18
- PDEStoryID: FP-257

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-257-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
