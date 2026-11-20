### DIP — FP-258 (Mobile): show every account-deletion block, including "only Administrator", in plain words

### Not covered — deliberately excluded
- **The server side:** the last-Admin guard, the pre-check and the new `lastAdmin` field are in `DIP-FP-258-web`, which must be merged and deployed first, with its migration applied.
- **Role changes on the phone.** The phone has no role editing.
- **Any change to the delete flow itself:** the password re-check, sign-out and the AUTH_DELETE_FAILED handling stay as they are.

### Story Summary
When "Delete My Account" is blocked, the phone currently shows only the **first** reason, and has no sentence for the new "only Administrator" case. After FP-258 web, the server returns **all** reasons at once (`assignedMemberCount`, `ownedGroupCount`, `ownedEventCount`, `lastAdmin`) plus a plain `message`. This DIP makes the phone show every reason as a short readable list, and never raw error text.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). **Depends on `DIP-FP-258-web` being merged and deployed to preview, with its migration applied.** It must also work against an older server.

### Grounding Check
**Verified by Atlas this session** (`origin/dev` at `1b80808`):
- **`src/lib/api.ts`:**
  - `class ApiError` has `assignedMemberCount`, `ownedGroupCount` and `ownedEventCount` (number or null);
  - `ApiEnvelope.error` declares the same three fields;
  - `apiFetch` builds an `ApiError` from the envelope. Find exactly where.
- **`app/(app)/profile/delete-account.tsx`:**
  - `describeStateTransitionError(err)` returns ONE sentence, for the first non-null count in the order events, groups, members led; otherwise `err.message`;
  - it is shown via `setError(...)` on `INVALID_STATE_TRANSITION`.
- **`src/features/members/services/myProfile.service.ts`:** `deleteOwnAccount()` calls `DELETE /api/members/me`.

**Re-verify all of the above first.** Also confirm how `setError` text is rendered (style and accessibility), so a list of several sentences stays readable.

**Rules check:**
- Messages contain no ids.
- Theming uses the existing tokens.
- Older server: no `lastAdmin` and only one count, which must still give a good sentence.
- Newer server: several counts plus `lastAdmin`.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-258-mobile.md`. Create `feature/FP-258-removal-guards` off current `dev`.
2. **`src/lib/api.ts`.** Add `lastAdmin: boolean` to `ApiError`; it is false when missing. Read it from the envelope as `error.lastAdmin === true`. Keep the constructor back-compatible: add the field as a new trailing optional parameter, or set it after construction. Say which.
3. **Pure helper** `src/features/members/removalBlockers.ts`: `describeDeletionBlockers(err: { assignedMemberCount; ownedGroupCount; ownedEventCount; lastAdmin; message }): string[]`. It returns one sentence per block present, in this order, matching the web's "self" wording:
   - **lastAdmin:** "You are this community's only Administrator. Make another member an Administrator first, or email support@flockpulse.ca to close the community."
   - **members led:** "You lead N member(s). Ask your Administrator to assign them to another leader first."
   - **groups:** "You own N group(s). Ask your Administrator to give them to someone else first."
   - **events:** "You own N upcoming event(s). Ask your Administrator to give them to someone else first."

   A count counts as present when it is a number greater than 0. If nothing is present, return `[err.message]` when it exists and contains no UUID; otherwise return `["Your account can't be deleted right now. Please contact support@flockpulse.ca."]`.
4. **`delete-account.tsx`.**
   - Replace `describeStateTransitionError` with the helper.
   - Show the sentences as a short list: one line each with a bullet or spacing, using the existing error style, readable in light and dark mode, inside the existing scroll view.
   - Add an `accessibilityLabel` that reads all of them.
   - Keep everything else unchanged.
5. **Test script** `scripts/test-fp258-removal-blockers.ts`, run with `npx tsx`. Cover:
   - each block alone;
   - all four together, in the right order;
   - singular and plural;
   - the old-server shape (one count, no `lastAdmin`);
   - nothing present, with a friendly message;
   - nothing present, with a raw message containing a UUID, which must give the fallback sentence;
   - a check that no output ever contains a UUID.
6. **Checks.** Run `npx tsc --noEmit` and the script. State plainly that nothing was checked on a device. `git diff dev --stat` lists only the expected files.
7. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-258-mobile.md` (verbatim, then frozen);
  - `src/features/members/removalBlockers.ts`;
  - `scripts/test-fp258-removal-blockers.ts`.
- **Modify:**
  - `src/lib/api.ts` (the `lastAdmin` field only);
  - `app/(app)/profile/delete-account.tsx`.
- **Must stay untouched:** `myProfile.service.ts` (unless a type import needs updating), `app.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-258-removal-guards

### Commit Message
FP-258: show every account-deletion block in plain words on the phone

### Pull Request Description
Plain GitHub markdown. Include:
- the behavior for old and new servers;
- the message table;
- the script output;
- deviations from this DIP.

**Not tested:** any device. JavaScript only, so it ships over the air.

**Steps for Joseph:**
1. Make sure FP-258 web is merged, its migration applied, and preview Ready.
2. Merge this PR into `dev`.
3. Run `deploy-ios.bat "FP-258 deletion blocks"` and `deploy-android.bat "FP-258 deletion blocks"`.
4. On each test phone:
   - compare the update ID with the login screen;
   - force-quit and reopen the app twice.
5. With a **test** account, not your real one, that leads a member and owns a group:
   - Delete My Account shows **both** reasons in plain words, and the account is NOT deleted;
   - with the sole Admin of a test community, it shows the "only Administrator" sentence.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-258

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-258-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
