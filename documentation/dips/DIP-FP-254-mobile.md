# DIP — FP-254 (Mobile): remove birthdate from the profile screen, one-time acceptance screen

### Not covered — deliberately excluded
- **The web half** (`DIP-FP-254-web.md`: database, registration, API, web one-time screen). **Send this DIP only after the web PR is merged, migration `…090` is applied and Vercel is Ready.** The endpoints below come from that DIP.
- **No registration screen.** Registration exists only on the web.
- **No native change, no new package, no `app.json`/`package.json` change.** JavaScript only (over-the-air update).
- **No server-side blocking.** The screen is a gate in the app like the MFA gate; the server does not block API calls. Say so in the PR.
- **Login, MFA, biometric lock and `auth.service.ts` logic are not changed.**

### Story Summary
The server stops collecting birthdate and now requires every member to accept the Terms of Service and Privacy Policy and confirm they are 18 or older. Members who use only the phone never see the web screen, so the app needs its own one-time screen. The profile edit screen must also drop the birthdate field.

### Repo Target
Mobile (Expo), `owgc-tech/flockpulse-mobile`. Depends on the web part being deployed. **It must tolerate an older server:** if the acceptance endpoint does not exist (HTTP 404), treat acceptance as not required and show nothing.

### Grounding Check
READ on `origin/dev` = `47781df` (2026-11-21). Re-verify first; stop and report if different.
- Birthdate in mobile: `src/features/members/types.ts` (`birthdate: string | null` in the profile type, line 21; `birthdate?: string` in the update input, line 50) and `app/(app)/profile/edit.tsx` (state `birthdate`, `showIosDatePicker`, `handlePressBirthdate`, the payload line `...(birthdate ? { birthdate: toDateOnlyString(birthdate) } : {})`, the "Birthdate" label and `testID="edit-birthdate"` and the iOS `DateTimePicker`). No other mobile file mentions birthdate (grep).
- `app/(app)/_layout.tsx`: a `Gate` state machine (`loading`, `redirect`, `biometric-lock`, `ready`) driven by the session, the MFA assurance level and biometric trust; it renders a `Stack` when ready. **Read the rest of the file (below line 200) before editing.**
- `src/lib/api.ts` `apiFetch` always parses a JSON envelope `{ data }`; `EXPO_PUBLIC_API_BASE_URL` is the web host. `src/features/auth/forgotPassword.ts` already builds an address from that variable (`getResetPasswordUrl`) with `new URL(base).origin`; reuse the same approach for the legal pages.
- API contract (from the web DIP): `GET /api/members/me/acceptance` returns `{ data: { required: boolean } }`; `POST /api/members/me/acceptance` with `{ confirmAdult: true, acceptTerms: true }` returns `{ data: { accepted: true } }`; a bad body is `VALIDATION_ERROR` 422. **Not verified until the web PR is deployed:** re-read the merged web route first and follow it exactly.
- The profile endpoint will stop returning `birthdate`; an old server still returns it. Both must work.

### Implementation Plan
1. **Profile:** remove the birthdate field, its state, date-picker code, payload line and `testID` from `app/(app)/profile/edit.tsx`; remove the field from `types.ts`. Leave unused imports out (clean `tsc`/lint); do not touch `package.json` even if a date-picker import becomes unused elsewhere (report it).
2. **Pure helper `src/features/legal/acceptance.ts`** (no React or Expo imports): `getLegalPageUrl(baseUrl, 'terms' | 'privacy')` returns `${new URL(base).origin}/terms` or `/privacy`, or `null` for missing or non-http(s) input; `canSubmitAcceptance(adult, terms)` true only when both are true; `parseAcceptanceStatus(response)` returns `{ required: boolean }` from the envelope, treating anything unexpected as `false`.
3. **Service `src/features/legal/acceptance.service.ts`** using `apiFetch`: `fetchAcceptanceRequired()` — on HTTP 404 (older server) returns `false`; on a network or other error returns `false` (the app is not blocked by a transient failure) and does not throw; `submitAcceptance()` posts the body above and returns success or a plain failure.
4. **Screen component `src/features/legal/components/AcceptanceScreen.tsx`** with the exact words below (do not reword). Theming and accessibility follow the login screen: colors from `useThemeColors()`, two checkboxes with `accessibilityRole="checkbox"` and state, min touch height 44, a disabled button style, large-text friendly layout (scrollable).
   - Title: **Please confirm to continue**
   - Text: **We updated our Terms of Service and Privacy Policy. Please read them, then confirm below. FlockPulse does not ask for your birthdate.** The words "Terms of Service" and "Privacy Policy" are links that open `/terms` and `/privacy` on the web host in the phone's browser (`Linking.openURL`, failure shows a plain sentence, never a raw error).
   - Box 1: **I accept the Terms of Service and the Privacy Policy.**
   - Box 2: **I confirm I am 18 or older.**
   - Button: **Continue** (disabled until both boxes are ticked, and while submitting).
   - Line under the button: **If you do not agree, you can delete your account.**
   - Plus a "Sign out" link (uses the existing sign-out function from `auth.service.ts`, which is only imported, not changed) so nobody is trapped.
   - On a failed submit show a plain message ("We couldn't save that. Please try again.").
5. **Gate in `app/(app)/_layout.tsx`:** once the existing gate is `ready` (after MFA and biometric), call `fetchAcceptanceRequired()` once per app session per user; while it is in flight keep showing the existing loading state; if required, render `<AcceptanceScreen onAccepted={…} />` instead of the `Stack`; after success continue to the app. Keep the change minimal and do not alter any existing gate logic, redirect, notification-drain effect or biometric code. A token refresh must NOT re-run the check (use the same user-id ref pattern the layout already uses).
6. **Tests:** `scripts/test-fp254-acceptance.ts` (plain `tsx`, `declare const require`, mocked `apiFetch`): the URL helper (https, trailing slash, path in base, http localhost, undefined, empty, "not a url", ftp); `canSubmitAcceptance` (all four combinations); `parseAcceptanceStatus` (true, false, missing data, garbage); the service with a mocked 404 (returns false), network error (returns false, no throw), `{data:{required:true}}`; grep the screen file for the exact texts, the two `accessibilityRole="checkbox"` and `minHeight: 44`; grep `edit.tsx` and `types.ts` for no `birthdate`. Run `npx tsc --noEmit` and every existing `scripts/test-*.ts` (must match `dev`). Say plainly what could not be tested (no device run, no real browser hand-off, no hosted server).

### Files to Create/Modify
- Create: `src/features/legal/acceptance.ts`, `src/features/legal/acceptance.service.ts`, `src/features/legal/components/AcceptanceScreen.tsx`, `scripts/test-fp254-acceptance.ts`, `documentation/dips/DIP-FP-254-mobile.md`.
- Modify: `app/(app)/profile/edit.tsx`, `src/features/members/types.ts`, `app/(app)/_layout.tsx` (minimal).
- Must stay untouched (zero diff against `dev`): `app/(auth)/login.tsx`, `src/features/auth/services/auth.service.ts`, `src/features/auth/components/LoginForm.tsx`, `src/features/auth/forgotPassword.ts`, `src/lib/api.ts`, `app.json`, `package.json`, `package-lock.json`, `eas.json`.

### Migration Files (if applicable)
None (the database changes are in the web DIP).

### Branch Name
feature/FP-254-mobile-acceptance-no-birthdate

### Commit Message
FP-254: one-time acceptance screen and remove birthdate from the profile screen

### Pull Request Description
Plain GitHub markdown. Map behavior to the criteria: no birthdate field in the app; one-time screen shown once per member until accepted, with the exact texts; older server tolerated (404 means no screen); a failed check never blocks the app; no raw errors; accessibility, theming and touch size follow the login screen; JavaScript only. List deviations. State what was NOT tested (device, browser hand-off, hosted server, the Play build's update channel). Joseph's device steps: (1) after the web part is live, ship with `deploy-ios.bat "FP-254 acceptance screen"` and `deploy-android.bat "FP-254 acceptance screen"`, compare update IDs, force-quit twice on every phone; (2) sign in as a member who has not accepted: the screen appears after MFA, before the app; (3) tap "Terms of Service" and "Privacy Policy": the browser opens the pages; (4) Continue stays off until both boxes are ticked; tick both, Continue, the app opens; (5) close and reopen: no screen; (6) Edit Profile shows no birthdate; (7) dark mode and large text; (8) airplane mode on the screen: a plain message, not an error dump; (9) sign out from the screen works.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-254 (mobile part)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-254-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. No migration and no merge: Joseph merges manually and ships the update with the deploy scripts. Do not run git commands or deploy scripts in a folder Claude Code is using; wait for its report. Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
