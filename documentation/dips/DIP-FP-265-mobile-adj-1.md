# DIP — FP-265 adj-1 (Mobile): "Forgot password?" opens the reset page with `?from=app`

### Not covered — deliberately excluded
- The web half (page shows "Back to the app" when `from=app`). That is `DIP-FP-265-web-adj-3.md`. **Send this DIP only after that web PR is merged and Vercel is Ready**, so the phone does not ship ahead of the page. (An old web page ignores the parameter, so nothing breaks if the order slips.)
- No change to the button, its wording, accessibility, theming or error handling. No MFA, native, package, `app.json` or `package.json` change. JavaScript only. Web repo untouched.

### Story Summary
The "Forgot password?" link opens `<web host>/reset-password` in the phone's browser. Add `?from=app` so the web page knows the visitor came from the app and shows a way back to the app instead of the web login.

### Repo Target
Mobile (Expo), `owgc-tech/flockpulse-mobile`. Depends on web adj-3 being deployed to `preview.flockpulse.ca` (soft dependency, see above).

### Grounding Check
READ on `origin/dev` = `a49f4da` (merge of #160) on 2026-11-21. Re-verify first; stop and report if different.
- `src/features/auth/forgotPassword.ts` exports `getResetPasswordUrl(baseUrl)`, which returns `` `${parsed.origin}/reset-password` `` for http(s) addresses and `null` otherwise, and `FORGOT_PASSWORD_FALLBACK_MESSAGE`.
- `src/features/auth/components/LoginForm.tsx` calls `getResetPasswordUrl(process.env.EXPO_PUBLIC_API_BASE_URL)` in `handleForgotPassword` and opens the result with `Linking.openURL`. It needs no change.
- `scripts/test-fp265-forgot-password.ts` has checks whose expected values end in `/reset-password` (about 5); these must be updated to end in `/reset-password?from=app`.
- No invariant rule, server field or endpoint is involved. No secret: the parameter is a fixed word.

### Implementation Plan
1. In `forgotPassword.ts` change the return to `` `${parsed.origin}/reset-password?from=app` `` and update the doc comment. Nothing else in the file changes.
2. In `scripts/test-fp265-forgot-password.ts` update the expected values of the existing checks to the new address; all `null` checks stay as they are.
3. Run `npx tsc --noEmit` and the test script; also run every other `scripts/test-*.ts` that existed on `dev` (must match `dev`).

### Files to Create/Modify
- Modify: `src/features/auth/forgotPassword.ts`, `scripts/test-fp265-forgot-password.ts` (gitignored: `git add -f`).
- Create (docs): `documentation/dips/DIP-FP-265-mobile-adj-1.md`.
- Must stay untouched (zero diff against `dev`): `src/features/auth/components/LoginForm.tsx`, `app/(auth)/login.tsx`, `app/(app)/_layout.tsx`, `auth.service.ts`, `src/lib/api.ts`, `app.json`, `package.json`, `package-lock.json`, `eas.json`.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-265-mobile-adj-1-from-app

### Commit Message
FP-265: open the reset page with from=app

### Pull Request Description
Plain GitHub markdown. State: the address the app opens now ends in `?from=app`; nothing else changes; JavaScript only; works with an older web page. Not tested: device run, browser hand-off. Manual steps for Joseph: (1) pull `dev`, ship with `deploy-ios.bat "FP-265 from=app"` and `deploy-android.bat "FP-265 from=app"`, compare update IDs, force-quit twice on every phone; (2) tap "Forgot password?": the browser opens `…/reset-password?from=app` and the page shows "Back to the app"; (3) request a reset, expect the green box with "Then return to the FlockPulse app."; (4) tap "Back to the app" and expect the app to open.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-265 (mobile adj-1)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-265-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. No migration and no merge: Joseph merges manually and ships the update with the deploy scripts. Do not run git commands or deploy scripts in a folder Claude Code is using; wait for its report. Include full diffs for every file in your completion report per Section 5, rule 13, not a summary.
