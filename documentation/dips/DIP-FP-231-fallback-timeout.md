# CC-mobile instruction: FP-231 (part): make a first launch wait briefly for the newest update

Repo: owgc-tech/flockpulse-mobile. Small change, sent as a short direct instruction (not a full DIP).

First action, before anything else: save this text verbatim to `documentation/dips/DIP-FP-231-fallback-timeout.md`. Never append to that file afterwards. Executor notes go in the PR description only.

## Not covered, deliberately
- Building native binaries (Joseph does this).
- Checking the `EXPO_PUBLIC_API_BASE_URL` value in the EAS environment (Joseph does this).
- Removing the temporary `Update: ... | API: ...` line on the login screen (`app/(auth)/login.tsx`). Do NOT touch it; we still need it to verify the first-launch behaviour.
- The iOS build and store submission.

## Why
A fresh install runs the JavaScript baked into the build. Newer updates only apply on the next launch because `app.json` has no `updates.fallbackToCacheTimeout` (the default is 0). Every new tester and every store reviewer would see a broken-looking first launch (FP-231 has the full background).

## Verify first (do not trust this text)
1. Read `app.json`. At the time of writing, `expo.updates` contained only `url`. Confirm that, and confirm `runtimeVersion` is `{"policy": "sdkVersion"}`.
2. Read the installed `expo-updates` version's own documentation or type definitions in `node_modules` and confirm `updates.fallbackToCacheTimeout` is a valid key there and that its unit is milliseconds. If the key name or unit is different, STOP and report. Do not guess.

## Change
In `app.json`, add `"fallbackToCacheTimeout": 5000` inside `expo.updates`. No other change. Do not touch `eas.json`, the login screen, or any deploy script.

## Rules
- Branch `feature/FP-231-fallback-timeout` off CURRENT `dev`. Never stack. Open the PR with `gh pr create --base dev` and quote the base in your report. Do NOT merge.
- Commit message: `FP-231: wait up to 5 s for the newest update on first launch`
- Run `npx tsc --noEmit` and report the result.
- Do not run `deploy-ios.bat`, `deploy-android.bat` or any EAS command. Do not read `.env` files.
- Report with the full diff of every changed file. Expect exactly one file: `app.json`, plus the saved instruction file.
- PR description (plain GitHub markdown): say this setting is embedded in the NATIVE build, so it has no effect until a new build is made, and an over-the-air update will not deliver it. State plainly that nothing was tested on a device. Device step for Joseph after the Android build: install the app fresh, open it, read the Update line on the login screen before signing in, and confirm the first launch works without the "JSON Parse error".
- Jira linkage: PDEEpicID FP-170, PDEStoryID FP-231. FP-231 stays open after this PR.
