### DIP — FP-258 (Mobile) adj-1: the password re-check must not replace the signed-in session, and a blocked deletion says "Your account was not deleted"

### Not covered — deliberately excluded
- **The server:** FP-258 web is merged and live, and nothing changes there.
- **The wording of the reasons:** they stay as merged in PR #154.
- **Two-step login (MFA) itself:** the verify and enroll screens, the trusted-device logic, and the `(app)/_layout.tsx` gate. All unchanged.
- **The web admin Remove flow:** it works (tested 2026-11-19).

### Story Summary
Device test, 2026-11-19 (Joseph). On a test account that has two-step login, "Delete My Account" went like this:
1. He entered the password.
2. The app jumped to the two-step code screen.
3. After the code, he was simply signed back in.

The account was **not** deleted (correct), but the reasons never appeared.

**Cause (Atlas, read from the code; not yet seen in a debugger):**
- `delete-account.tsx` re-checks the password by calling `signInWithPassword(email, password)` on the app's **shared** Supabase client (`src/lib/supabase.ts`, persistent session).
- That replaces the signed-in session (assurance level aal2) with a brand-new **aal1** session.
- The gate in `app/(app)/_layout.tsx` then sees `currentLevel !== 'aal2'` with `nextLevel === 'aal2'` and redirects to `/(auth)/mfa-verify` (lines ~116–130). That unmounts the Delete Account screen, so the 409 reasons have nowhere to show.

This affects every account with two-step login, so all Admins. It predates FP-258: it dates from the original password re-check (FP-187). Accounts without two-step login were probably unaffected.

**The fix:**
- Check the password on a **separate, throwaway** Supabase client that never stores a session. The app's own aal2 session is never touched, so the gate doesn't fire, the delete call is made with the real session, and the reasons show.
- When deletion is blocked, end the list with **"Your account was not deleted."** (Joseph's request).

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`), JavaScript only, shipped over the air. No server dependency.

### Grounding Check
**Verified by Atlas this session** (`origin/dev`, after #154):
- **`src/lib/supabase.ts`:** `createClient(url, anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`, plus an AppState listener that starts and stops auto-refresh.
- **`src/features/auth/services/auth.service.ts`:** `signInWithPassword(email, password)` calls `supabase.auth.signInWithPassword` on that shared client, and throws `GENERIC_LOGIN_ERROR` on failure.
- **`app/(app)/profile/delete-account.tsx`:**
  - `handleSubmit` calls `signInWithPassword(email, password)`, then `deleteOwnAccount()`;
  - on `INVALID_STATE_TRANSITION` it calls `setBlockers(describeDeletionBlockers(err))`;
  - on success it calls `signOut()` and goes to login.
- **`app/(app)/_layout.tsx`:** the assurance-level gate redirects an aal1 session whose next level is aal2 to `mfa-verify`.

**Re-verify all of the above first.** Also:
1. Find where the `(app)` gate listens for auth changes (an `onAuthStateChange` listener or a session hook). Confirm that a `SIGNED_IN` event on the shared client is what triggers the redirect.
2. Confirm the installed `@supabase/supabase-js` version supports `createClient` with `persistSession: false` and a custom `storageKey`.
3. Check whether `signOut` on a client defaults to `scope: 'global'` in that version. It must **never** be called with global scope from the throwaway client, because that would sign the user out on every device.

If the cause turns out to be different, STOP and report before changing anything.

**Rules check:**
- No secrets are logged.
- The password is held only in component state, as today, and is not stored.
- No new endpoint.
- The deletion still happens only after a correct password.

### Implementation Plan
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-258-mobile-adj-1.md`. Create `feature/FP-258-mobile-adj-1` off current `dev`. Report the grounding answers.
2. **`auth.service.ts`:** add `verifyPassword(email, password): Promise<void>`.
   - Create a **throwaway** client with the same URL and anon key and these auth options: `persistSession: false`, `autoRefreshToken: false`, `detectSessionInUrl: false`, and a distinct `storageKey` (for example `fp-password-check`). Give it no AsyncStorage.
   - Call `signInWithPassword` on it. On error, throw `GENERIC_LOGIN_ERROR`, the same message as today.
   - On success, end the throwaway session with `signOut({ scope: 'local' })` on **that** client only. Never use global scope, and never touch the shared client.
   - Discard the client. Comment why: replacing the shared session drops aal2 and triggers the two-step gate.
   - Do not change `signInWithPassword` (login still uses it).
3. **`delete-account.tsx`:**
   - Replace the `signInWithPassword(email, password)` call with `verifyPassword(email, password)`. Everything after it stays the same.
   - When blockers are shown, add a final line **"Your account was not deleted."** in the same style, after the reasons, and include it in the list's accessibility label.
4. **Test script** `scripts/test-fp258-adj1.ts` (pure, `npx tsx`):
   - If the "not deleted" line is built in the pure helper, test that it is appended exactly once and only when there are reasons. Otherwise test the helper used by the screen.
   - A grep that `delete-account.tsx` no longer imports `signInWithPassword`.
   - A grep that `verifyPassword` never calls `signOut` without `scope: 'local'`.
5. **Checks.** Run `npx tsc --noEmit` and the new and existing scripts. State plainly that no device test was possible. `git diff dev --stat` lists only the expected files.
6. **Commit, push, and open the PR** with `gh pr create --base dev`.

### Files to Create/Modify
- **Create:**
  - `documentation/dips/DIP-FP-258-mobile-adj-1.md` (verbatim, then frozen);
  - `scripts/test-fp258-adj1.ts`.
- **Modify:**
  - `src/features/auth/services/auth.service.ts` (add `verifyPassword` only);
  - `app/(app)/profile/delete-account.tsx`;
  - `src/features/members/removalBlockers.ts`, only if the "not deleted" line is added there.
- **Must stay untouched:** `src/lib/supabase.ts`, `app/(app)/_layout.tsx`, every `app/(auth)/*` screen, `app.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-258-mobile-adj-1

### Commit Message
FP-258: re-check the password without replacing the session, and say the account was not deleted

### Pull Request Description
Plain GitHub markdown. Include:
- the cause, as confirmed in grounding;
- why a throwaway client fixes it;
- why `scope: 'local'` is used;
- what happens for accounts without two-step login (unchanged behavior);
- the script output;
- deviations from this DIP.

**Not tested:** any device.

**Steps for Joseph:**
1. Merge into `dev`.
2. Run `deploy-ios.bat "FP-258 adj-1 delete account with 2FA"` and `deploy-android.bat "FP-258 adj-1 delete account with 2FA"`.
3. On each test phone: check the update ID, then force-quit and reopen twice.
4. With the **same test account with two-step login** that leads someone and owns a group, go to Delete My Account and enter the password. Expected:
   - **no** jump to the two-step screen;
   - the reasons appear, followed by "Your account was not deleted.";
   - you are still signed in on the same screen.
5. Optional: with a test account **without** two-step login and no blocks, deletion still works, and you land on the login screen. Use a disposable test account; this really deletes it.
6. Enter a wrong password. You should still see "Incorrect email or password."

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-258

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-258-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
