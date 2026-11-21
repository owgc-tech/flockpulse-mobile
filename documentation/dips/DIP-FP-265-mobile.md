# DIP — FP-265 (Mobile): add "Forgot password?" to the login screen

### Not covered — deliberately excluded
- **The web reset fix and the new email link.** That is the web DIP for FP-265 (`DIP-FP-265-web.md`). **Condition met before sending (2026-11-21): web PRs #249 and #250 are merged, Joseph edited the Supabase "Reset Password" email template on fpdb-dev, and a reset was tested end to end on preview.** Reason for the condition: this link sends Members to the web reset page, which had to work first.
- **No in-app reset form or in-app email request.** The link opens the web reset page in the phone's browser. Building a native reset flow is a separate decision.
- **No MFA changes** (Members optional MFA is a separate story). Do not touch `mfa-*` screens, `app/(app)/_layout.tsx` gate, or `auth.service.ts`.
- **The "Update: … | API: …" diagnostic line on the login screen stays** (FP-231 removes it later). Do not touch it.
- **No native change, no new package, no `app.json`/`package.json` change.** JavaScript only.
- **No server or migration change.** Web repo untouched.

### Story Summary
Members use only the phone app, and the login screen has no way to recover a forgotten password. Add a "Forgot password?" link under the Sign In button. It opens the web reset page (`<web host>/reset-password`) in the phone's browser, where the member asks for a reset email, opens the emailed link and chooses a new password (web DIP). When done the web page tells Members to return to the app.

### Repo Target
Mobile (Expo, `owgc-tech/flockpulse-mobile`). Depends on the web part of FP-265 being merged, deployed to `preview.flockpulse.ca` and the Supabase email template changed. The phone needs no new server field or endpoint, so an older server is not a problem: the link is a plain web address.

### Grounding Check
Everything below was READ in `flockpulse-mobile` at `origin/dev` = `05e4243` (Nov 20) in the planning session on Nov 21. **Re-verify first on current `dev`; if anything is wrong, stop and report before coding.**
- `app/(auth)/login.tsx` renders `<LoginForm onSubmit={…} />` plus a "Powered by" logo block and the TEMP diagnostic line. It contains no "forgot" or "reset" text (grep confirmed).
- `src/features/auth/components/LoginForm.tsx` holds `email`, `password`, `error`, `isSubmitting` state; has a `Pressable` Sign In button (`testID="login-submit"`) and an error `Text` (`testID="login-error"`); styles use `useThemeColors()` with a themed-styles pattern (`colors.text`, `colors.border`, `colors.danger`, `colors.accent`, `colors.textMuted`). Re-check that these keys exist in `src/theme/colors.ts` before using them.
- `src/lib/api.ts` reads `process.env.EXPO_PUBLIC_API_BASE_URL` (throws at import if missing). That variable is the web app's host (the API lives in the web deployment). `Linking.openURL(...)` is already used in `app/(app)/events/[id].tsx` and `EventListItem.tsx`.
- **Web page that must exist:** `/reset-password` (request form) exists today in `flockpulse-web` (`app/reset-password/page.tsx`). It is not changed by FP-265. The reset email link and `/reset-password/confirm` are what the web DIP fixes.
- Test style: no UI test framework; scripts like `scripts/test-fp261-always-show.ts` are plain `tsx` scripts using `declare const require`.
- **Not verified:** which host `EXPO_PUBLIC_API_BASE_URL` has in the EAS production environment (it should be the host that serves `/reset-password`); and whether `deploy-android.bat` updates reach the Play build's update channel (open item from FP-253/FP-231). Say so in the PR; do not guess.
- Invariants: no tenant, attendance, RBAC or removal rules involved. No secrets: the link contains no token. Never show raw errors to the member.

### Implementation Plan
1. **Pure helper, new file `src/features/auth/forgotPassword.ts`** (no React or Expo imports):
   - `getResetPasswordUrl(baseUrl: string | undefined | null): string | null` — trims; requires a parseable `http:` or `https:` URL with a host; returns `` `${origin}/reset-password` `` (use `new URL(baseUrl).origin`, so a trailing slash or path in the variable cannot break it); anything else returns `null`.
   - `FORGOT_PASSWORD_FALLBACK_MESSAGE`: a plain sentence for failures, e.g. `"We couldn't open the reset page. Please try again, or contact your community administrator."`
2. **`LoginForm.tsx`:** below the Sign In button add a `Pressable` "Forgot password?" (`testID="login-forgot-password"`, `accessibilityRole="link"`, `accessibilityLabel="Forgot password? Opens the reset page in your browser"`, min touch height 44, text color `colors.accent`, centered, small top margin). `onPress`: compute `getResetPasswordUrl(process.env.EXPO_PUBLIC_API_BASE_URL)`; if `null`, set the existing `error` state to the fallback message; otherwise `await Linking.openURL(url)` inside `try/catch`, and on failure set the same fallback message (never the raw error). Disable while `isSubmitting`. Do not clear what the member already typed. Reuse the existing `error` text for the message.
3. **Test script `scripts/test-fp265-forgot-password.ts`:** run the real helper: normal https base; trailing slash; base with a path (`https://x.test/api`); `http://localhost:3000`; `undefined`, empty string, whitespace, `"not a url"`, `ftp://x.test` → `null`. Also grep `LoginForm.tsx` for the testID and the `accessibilityRole`. Say plainly what could NOT be tested (no device run, no real browser hand-off, no email).
4. Run `npx tsc --noEmit` (must be clean) and all existing `scripts/test-*.ts` (must match `dev`).

### Files to Create/Modify
- Create: `src/features/auth/forgotPassword.ts`
- Create: `scripts/test-fp265-forgot-password.ts`
- Modify: `src/features/auth/components/LoginForm.tsx`
- Must stay untouched (show `git diff dev <branch> -- <file>` with zero output): `app/(auth)/login.tsx`, `app/(app)/_layout.tsx`, `src/features/auth/services/auth.service.ts`, `src/lib/api.ts`, `app.json`, `package.json`, `package-lock.json`, `eas.json`.

### Migration Files (if applicable)
None (and none in the web repo for this DIP).

### Branch Name
feature/FP-265-mobile-forgot-password

### Commit Message
FP-265: add Forgot password link to the login screen

### Pull Request Description
Plain GitHub markdown. Map behavior to the FP-265 mobile criteria: the login screen has "Forgot password?"; it opens the web reset page on the host the build uses; JavaScript only; works with an older server; no raw errors shown; accessibility label, touch size and theming follow the existing login screen. List deviations with reasons. State what was NOT tested (a device run, the browser hand-off, the real email, the Play build's update channel). Include Joseph's device steps: (1) ship with `deploy-ios.bat "FP-265 forgot password link"` and `deploy-android.bat "FP-265 forgot password link"` from the mobile folder on `dev`, compare the printed update ID with the `Update:` line on the login screen, force-quit and reopen twice, on EVERY test phone; (2) tap "Forgot password?" and expect the phone's browser to open `…/reset-password`; (3) request a reset for a test Member, open the email link on the phone, set a new password, and expect "Return to the FlockPulse app"; (4) sign in to the app with the new password (MFA as usual); (5) try it in dark mode and with a large text size; (6) airplane mode: tapping the link should show the plain message, not an error dump.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-265 (mobile part)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-265-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. No migration and no merge: Joseph merges manually and ships the update with the deploy scripts. Do not run git commands or deploy scripts in a folder Claude Code is using; wait for its report. Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
