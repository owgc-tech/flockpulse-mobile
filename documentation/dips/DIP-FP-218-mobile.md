### DIP — FP-218 (Mobile): make two-step (MFA) setup survive leaving the app, and clean up leftover factors

### Not covered — deliberately excluded
- **Web.** Nothing in `flockpulse-web` changes. No migration, no API route, no database change. (Atlas has not checked whether the web app has its own MFA setup page; if it does, that is a separate ticket.)
- **QR code restore.** After a reload the QR image is NOT restored (it is a ~3 KB SVG). The manual key is restored. A "Start over with a new key" button gives a fresh QR.
- **Copy button and "open in authenticator" deep link.** Possible later improvements. Not in this DIP.
- **Authenticator label.** Report in the PR what the authenticator app shows as the account name/issuer (from the `uri` returned by `enroll()`), but do NOT change `issuer`.
- **Lost-authenticator / recovery.** Separate question, not this DIP.
- **Any build or deploy.** Joseph and Atlas decide how this reaches the Play build (see Grounding Check, item 9). Claude Code deploys nothing.

### Story Summary
When a member sets up two-step login, the app shows a secret key that they must type into an authenticator app, which means leaving FlockPulse and coming back. On Android the app can reload when they return. A reload re-runs the setup screen, which tries to create a second factor with the same empty name and fails with Supabase's raw error "A factor with the friendly name "" for this user already exists." Force-closing and reopening shows the same error until the leftover factor goes away. Even without the error, every restart creates a new secret, so the key already in the authenticator is stale. This DIP (a) fixes the cleanup so it really removes unfinished factors, (b) gives each attempt a unique name, (c) remembers the pending setup so a reload shows the SAME key, (d) stops two copies of the setup from running at once, and (e) replaces the raw error with a friendly message and a "Try again" button. It affects every Android tester on a single phone, so it is High priority.

### Repo Target
Mobile (Expo / `owgc-tech/flockpulse-mobile`). JavaScript only: `expo-secure-store` is already a dependency. No web dependency, no server field or endpoint is needed.

### Grounding Check
Everything below was READ by Atlas this session. **Re-verify each item first** and tell Joseph if anything differs.

1. `app/(auth)/mfa-enroll.tsx`: one `useEffect` with `[]` dependencies runs: `listAllTotpFactors()`, then `unenrollFactor()` for each factor with `status === "unverified"`, then `enrollTotpFactor()`. On any thrown error it sets `error` and the screen renders only the error text (no button). `handleVerify` calls `verifyTotpEnrollment(enrollment.factorId, code)`, then marks the device trusted if biometrics exist, then `router.replace("/(app)")`.
2. `src/features/auth/services/auth.service.ts`: `listAllTotpFactors()` returns `data.totp` from `supabase.auth.mfa.listFactors()`. Its comment says "returns every TOTP factor regardless of status". **That comment is wrong.** `enrollTotpFactor()` calls `mfa.enroll({ factorType: "totp" })` with NO `friendlyName` and NO `issuer`.
3. **Root cause.** `package-lock.json` pins `@supabase/auth-js` 2.119.0. In `node_modules/@supabase/auth-js/src/GoTrueClient.ts`, `_listFactors` (lines 6112 to 6141) puts every factor in `data.all` but pushes a factor into `data.totp` ONLY when `factor.status === 'verified'`. So the existing cleanup finds nothing and removes nothing. (Note: a comment in `forceLocalSignOut` mentions auth-js 2.110.8; the installed version is 2.119.0.)
4. Other callers of the verified-only helpers must NOT change: `hasEnrolledTotpFactor()` (used in `app/(auth)/login.tsx` and `app/(app)/_layout.tsx`) and `getTotpFactorId()` (used in `app/(auth)/mfa-verify.tsx`) correctly want verified factors only. `listAllTotpFactors`, `unenrollFactor` and `enrollTotpFactor` are used only by `mfa-enroll.tsx`.
5. Routing into the screen: `login.tsx` and the `(app)` gate in `app/(app)/_layout.tsx` can both send an aal1 user with no verified factor to `/(auth)/mfa-enroll`. FP-218's original "two screens mounted at once" race is therefore possible and is NOT ruled out; a single-flight guard is cheap insurance, but this DIP does not claim it is the cause.
6. Device evidence (2026-11-23, Joseph, Android, Play closed-test build): first open succeeded in showing a key; after switching to an authenticator app and returning, the app reloaded and showed the "friendly name "" already exists" error; a force-close and reopen showed the same error; the third open worked and enrolment completed. A read-only check of the hosted database afterward found one factor row for that account: verified, created 13:50:22 UTC, verified 13:54:07 UTC, no unverified leftovers. **NOT verified:** why the earlier unverified factor was gone by the third attempt (possible server-side expiry), and whether Android killed the process or the screen simply re-mounted. This fix must work either way.
7. `src/lib/secureSessionStorage.ts` already shows the pattern for `expo-secure-store` here: dependency-injected `SecureLike` interface, lazy `require` of the native module, `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, never throws out of reads, never logs values, keys may contain only letters, digits, `.`, `-`, `_`. Follow the same pattern. (`expo-secure-store` is `~57.0.4` in `package.json`.)
8. `forceLocalSignOut()` and `signOut()` in `auth.service.ts` are the two sign-out paths. `app.json` has `"orientation": "portrait"` (unrelated, do not touch). `eas.json` has profiles development, preview and production (production: `autoIncrement`, channel `production`).
9. **Unverified, for Claude Code to report (do not change anything):** read the deploy scripts if they exist in the working folder (`deploy-android.bat` / `deploy-ios.bat` may be gitignored) and `eas.json`, and state in the PR which update channel the Google Play (`production` profile) build listens to, and whether `expo-secure-store` was already in the native build that Google Play has (check git history for when it was added). Atlas will confirm with Joseph which commit build versionCode 3 came from. This decides whether the fix reaches testers over the air or needs a new build.

Invariants: no domain rule is touched. No tenant, RBAC, attendance or formation logic. No new endpoint, so the JSON-envelope rule does not apply. **Secrets:** the pending TOTP secret may be stored only in SecureStore, never logged, never printed, never put in the PR, a test fixture, or an error message. Tests use obviously fake values.

### Implementation Plan
Pure logic goes in testable helpers; the screen only wires them.

1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-218-mobile.md` before anything else. Then create `feature/FP-218-mfa-enroll-resilience` off current `dev`.
2. **Baseline.** On unchanged `dev` run `npx tsc --noEmit` and every `scripts/test-*.ts`; keep the results to compare later.
3. **Re-verify Grounding items 1 to 4** in the code and in `node_modules`. If the local Supabase stack from the web repo is available, run a throwaway script (never committed) that signs in a test user, calls `mfa.enroll` twice with the same name, lists `all`, and records what the server does; paste the finding in the PR. If that is not possible, say so. Do not run anything against the hosted database.
4. **`auth.service.ts`.**
   - Add an exported pure helper `selectUnverifiedTotp(all: Factor[]): Factor[]` (factor type `totp` and status `unverified`).
   - Change `listAllTotpFactors()` to read `data.all` and return every TOTP factor of any status. Correct its comment.
   - `enrollTotpFactor()` passes a unique `friendlyName` per attempt (for example `FlockPulse ` plus an ISO timestamp). Keep the returned shape.
   - Leave `hasEnrolledTotpFactor`, `getTotpFactorId`, `verifyTotp*` and both sign-out functions' behaviour unchanged, except that both sign-out paths also call `clearPendingEnrollment()` (step 5) in a way that can never throw or block sign-out.
5. **New `src/features/auth/services/pendingEnrollment.ts`.** Stores `{ userId, factorId, secret, uri }` as JSON in SecureStore under a fixed key (for example `flockpulse.mfa.pending`). Dependency-injected `SecureLike` like `secureSessionStorage`; lazy native `require`. Exports `savePendingEnrollment`, `readPendingEnrollment`, `clearPendingEnrollment`, and a pure `decidePending({ stored, userId, factors })` returning `{ action: "reuse", pending }` only when the stored `userId` matches the current user AND a factor with the stored `factorId` still exists in `factors` with status `unverified`; otherwise `{ action: "discard" }`. Read returns `null` on any missing, malformed or failed read; none of these functions throw. Do not store the QR SVG.
6. **New `src/features/auth/services/mfaEnrollFlow.ts`.** `startEnrollment(deps)` with injected `getUserId`, `listAllTotp`, `unenroll`, `enroll`, `pending` store. Behaviour:
   - Get the current user id (from the session).
   - List all TOTP factors. Read the stored pending enrolment and run `decidePending`.
   - If `reuse`: delete every OTHER unverified factor, and return the stored enrolment (`qrCode` absent, `restored: true`).
   - Otherwise: delete ALL unverified TOTP factors, clear any stored pending, call `enroll()`, save the new pending, return the enrolment (with `qrCode`).
   - **Single-flight:** a module-level in-flight promise, so two concurrent calls share ONE run. The in-flight reference is cleared when the run settles (success or failure) so a retry always works.
   - Keep the "start over" path as a separate exported function that unenrols the pending factor, clears the store, and runs a fresh enrolment.
7. **`TotpEnrollment` type** (`src/features/auth/types.ts`): make `qrCode` optional (`qrCode?: string`) and add optional `restored?: boolean`. Fix any compile errors this causes.
8. **`app/(auth)/mfa-enroll.tsx`.** Replace the inline effect with `startEnrollment`. On failure show a friendly message ("We could not start two-step setup. Please try again.") with a **Try again** button that re-runs it. Never show the raw Supabase error text. After a successful `verifyTotpEnrollment`, call `clearPendingEnrollment()` before navigating.
9. **`MfaEnrollForm.tsx`.** Render the QR only when `qrCode` is present. When `restored`, show a short line such as "Your setup key from before is shown below. If your authenticator app already has it, just enter the code." and a **Start over with a new key** button (calls the start-over path and replaces the enrolment shown). Keep the manual key `selectable`. Keep existing theming, test IDs and accessibility labels; add accessibility labels and test IDs for the new buttons. All new text uses existing theme tokens.
10. **Tests** in `scripts/test-fp218-mfa-enroll.ts` (standalone `tsx` script, no device, mocked dependencies). Cover at least:
    - `selectUnverifiedTotp`: mixed list (verified totp, unverified totp, unverified phone, verified phone) returns only the unverified totp.
    - `decidePending`: reuse when user and factor id match and the factor is unverified; discard when the user differs, the factor is gone, the factor is verified, or nothing is stored.
    - Pending store with an in-memory `SecureLike`: save, read, clear; malformed JSON returns null; a throwing store never throws out.
    - `startEnrollment`: first open calls `enroll` once and saves pending; a "reload" (second call after the first settled, same mock server state) reuses the stored enrolment and does NOT call `enroll`; leftover unverified factors with nothing stored are unenrolled then one `enroll` happens; stored pending whose factor no longer exists leads to a fresh `enroll`; two concurrent calls share one run (`enroll` count is 1); after a failed run a retry runs again.
    - Mock `friendlyName` uniqueness: two attempts get different names.
11. **Verify.** `npx tsc --noEmit` clean; all `scripts/test-*.ts` match baseline plus the new one passing; `npx expo-doctor` no new failures; `npx expo export --platform android` into a temp folder to prove the bundle builds.
12. **Report** the deploy-channel findings from Grounding item 9 and the local server behaviour from step 3 (or why it could not be run).

### Files to Create/Modify
- Modify: `src/features/auth/services/auth.service.ts`, `src/features/auth/types.ts`, `app/(auth)/mfa-enroll.tsx`, `src/features/auth/components/MfaEnrollForm.tsx`
- Create: `src/features/auth/services/pendingEnrollment.ts`, `src/features/auth/services/mfaEnrollFlow.ts`, `scripts/test-fp218-mfa-enroll.ts` (the `scripts/` folder is gitignored, so force-add it)
- Must stay untouched (show `git diff dev <branch> -- <file>` with zero output): `app/(auth)/login.tsx`, `app/(auth)/mfa-verify.tsx`, `app/(app)/_layout.tsx`, `app.json`, `eas.json`, `package.json`, `package-lock.json`, `src/lib/supabase.ts`, `src/lib/secureSessionStorage.ts`.

### Migration Files (if applicable)
None. No remote or database change of any kind.

### Branch Name
feature/FP-218-mfa-enroll-resilience

### Commit Message
FP-218: make MFA setup survive leaving the app and clean up unfinished factors

### Pull Request Description
Plain GitHub markdown. Map behaviour to each acceptance criterion:
- **AC1:** leftover unverified factors are really removed (cleanup reads `data.all`). Show the test that proves it.
- **AC2:** each attempt uses a unique friendly name, so a same-name collision cannot happen.
- **AC3:** leaving the app and returning shows the same key, with no error. Show the reuse test.
- **AC4:** two concurrent starts run once. Show the single-flight test.
- **AC5:** a failure shows a friendly message and a Try again button; the raw error is never shown.
- **AC6:** the pending secret exists only in SecureStore and is cleared on verify, sign-out and start-over; nothing is logged.

Also include: the Grounding Check re-verification results; deviations from this DIP with reasons; the deploy-channel findings; what was NOT tested: a real device, Android process death, switching to a real authenticator app, iOS, the hosted database, and (if not possible) the local server behaviour.

Manual steps for Joseph after Atlas confirms how it is delivered (use a member account that has no two-step login yet; use a fresh invitation if needed):
1. Sign in, and on the setup screen long-press and copy the key.
2. Switch to the authenticator app and add the key manually, then come back. Expected: the SAME key is still shown (compare the first four characters), no error.
3. Enter the 6-digit code. Expected: you are in the app.
4. On another fresh account, reach the key screen, force-close the app, reopen and sign in. Expected: same key again.
5. Tap "Start over with a new key". Expected: a new key and a QR code; delete the old entry in the authenticator.
6. Turn on airplane mode before opening the setup screen. Expected: a friendly message and a Try again button, not raw text. Turn airplane mode off and tap Try again.

### Jira Linkage
- PDEEpicID: FP-31 (the parent FP-218 was filed under; Atlas suggests Joseph may want to move it under FP-170 Launch Readiness, but it is not changed here)
- PDEStoryID: FP-218

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-218-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database (there is none), do not deploy or publish any update, and do not merge: Joseph tests and merges manually.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary. Tell Joseph not to run git commands or deploy scripts in the mobile folder while you are working, and to wait for your report.
