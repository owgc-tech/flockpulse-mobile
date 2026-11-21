# DIP — FP-253 (Mobile): align Expo SDK 57 patches and block the Android exact-alarm permission

### Not covered — deliberately excluded
- TypeScript 7 (Dependabot #72) and async-storage 3 (Dependabot #71). Each gets its own branch and decision later. Do NOT touch `typescript` or `@react-native-async-storage/async-storage`.
- Any web repo change. No migration.
- Building or submitting anything. Joseph runs the EAS build and the Play upload by hand.
- Removing the temporary `Update: … | API: …` line on the login screen (FP-231).
- An Expo SDK upgrade (58+). Patch alignment inside SDK 57 only.

### Story Summary
Two things that must be in the native build that goes to Google Play. (1) 13 packages are behind the SDK 57 patch set (for example expo 57.0.11 to about 57.0.33, react-native 0.86.2 to 0.86.3, expo-router to about 57.0.31) and `expo-doctor` fails 2 of 21 checks. (2) `app.json` declares `android.permission.SCHEDULE_EXACT_ALARM`. Since Android 14 it is denied by default for new installs, and Google Play restricts it to alarm-clock and calendar style apps. Event reminders do not need minute-exact timing, so the permission is removed. Both changes are native, so they ship only in a new native build.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). No dependency on the web repo.

### Grounding Check
VERIFIED this session, on mobile `origin/dev` at `8ed9513` (PR #158 merged):
- `app.json` `expo.android.permissions` contains `"android.permission.SCHEDULE_EXACT_ALARM"` (line 27), plus `USE_BIOMETRIC` and `USE_FINGERPRINT`. So the app lists it explicitly; it is not only added by a plugin. A plugin (`expo-notifications`) may add it or other alarm permissions too: UNVERIFIED, check first.
- Plugins: `expo-router`, `expo-secure-store`, `expo-notifications`, `expo-system-ui`, `expo-local-authentication`, `@react-native-community/datetimepicker`, `expo-splash-screen`.
- Reminders use `Notifications.scheduleNotificationAsync` with `SchedulableTriggerInputTypes.DATE` in `src/features/notifications/services/selfReportReminders.service.ts` (line ~58 to 66); `confirmationReminders.service.ts` (line ~35) also schedules. UNVERIFIED: its trigger type.
- `package.json`: `expo` "57", `react-native` 0.86.2, `expo-router` ~57.0.11, `expo-notifications` ~57.0.9, `typescript` ~6.0.3, async-storage ^2.2.0. `eas.json` has profiles development, preview, production (production: autoIncrement, channel production).
- Jira FP-253 (To Do) holds the acceptance criteria; comment 10566 (2026-11-18) adds the exact-alarm scope.
- Test scripts live in `scripts/` as standalone `tsx` files (e.g. `test-fp258-removal-blockers.ts`). There is no UI test framework.

Re-verify all of this first. Tell me if anything differs.

Invariant check: no domain rule is touched. No tenant, RBAC, attendance or formation logic changes. No API calls change, so the JSON-envelope rule is unaffected.

### Implementation Plan
1. Save this DIP verbatim to `documentation/dips/DIP-FP-253-mobile.md` before any other work. Never append to it afterwards.
2. Branch off CURRENT `dev`: `feature/FP-253-sdk-patches-exact-alarm`. Do not stack.
3. **Find the source of the permission first (read-only).** Read how `expo-notifications` 57.x schedules DATE triggers on Android in `node_modules` (does it use an exact alarm only when permitted, and fall back to an inexact one otherwise, or does it throw?). Also check `confirmationReminders.service.ts`'s trigger. Report what you found in the PR description. STOP and report instead of continuing if the library throws when the permission is missing.
4. **Patch alignment.** Run `npx expo install --fix`. Then `npx expo install --check` must be clean. Do not accept any major version change: if `--fix` proposes a major, or changes `typescript` or `@react-native-async-storage/async-storage`, undo that part and tell me.
5. **Permission.** In `app.json` remove `android.permission.SCHEDULE_EXACT_ALARM` from `android.permissions` and add `"blockedPermissions": ["android.permission.SCHEDULE_EXACT_ALARM"]` under `expo.android`. Keep `USE_BIOMETRIC` and `USE_FINGERPRINT` unchanged. Then check the merged Android manifest in a THROWAWAY copy of the repo (`npx expo prebuild --platform android --no-install` in a temp directory, never in the working folder and never committed). Confirm `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` do not appear as granted permissions (a `tools:node="remove"` entry is correct). Paste the relevant manifest lines in the PR description. If a plugin adds `USE_EXACT_ALARM`, block that too and say so.
6. **Checks.** `npx expo-doctor` should pass 21 of 21, or explain each remaining failure. `npx tsc --noEmit` clean. Run every existing `scripts/test-*.ts` against `dev` as the baseline and again on the branch: results must match. Run `npm audit` and record what remains. Say whether the newer `expo-router` still pulls `query-string@7` and `decode-uri-component` 0.5.0 or lower. Do NOT add an npm override for it (it is ESM-only from 0.5.1 and would break URL parsing at runtime).
7. Do not change any file under `src/` unless step 3 proves it is needed. If it is needed, stop and report first.

### Files to Create/Modify
- `documentation/dips/DIP-FP-253-mobile.md` (new, the saved DIP)
- `app.json`
- `package.json`
- `package-lock.json`

### Migration Files
None.

### Branch Name
feature/FP-253-sdk-patches-exact-alarm

### Commit Message
FP-253: align SDK 57 patches and block the exact-alarm permission

### Pull Request Description
Plain GitHub markdown. Map each acceptance criterion to evidence: patch set clean, doctor result, audit result and the `query-string` finding, tsc, test scripts versus baseline. Include the manifest lines. List deviations from this DIP with reasons. State plainly what was NOT tested: any device, reminder delivery, iOS, and the EAS build. Manual steps for Joseph after merge:
1. Run the preview-profile native build for Android and install it on a test phone.
2. Smoke test: sign in, open an event, RSVP.
3. Reminder test: create or use an event so a reminder is due in a few minutes, put the app in the background, and confirm the notification arrives (a delay of a few minutes is acceptable).
4. Repeat on iOS if the iOS preview build is available.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-253 (partial: TypeScript 7 and async-storage 3 stay open)

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-253-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database, do not build or submit with EAS, and do not merge: Joseph tests and merges manually.

Include full diffs for every file in your completion report, not a summary. For `src/`, show `git diff dev feature/FP-253-sdk-patches-exact-alarm -- src` with zero output.
