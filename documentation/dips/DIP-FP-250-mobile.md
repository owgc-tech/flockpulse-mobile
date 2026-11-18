### DIP — FP-250 (Mobile): security update for flockpulse-mobile: audit triage, safe fixes, Dependabot setup

### Not covered — deliberately excluded
- **Any Expo SDK upgrade, and any bump of an Expo SDK-pinned package** (`expo`, `expo-*`, `react`, `react-native`, `react-native-*`, `@react-native/*`, `@expo/*` and anything else `npx expo install --check` manages). Those move only with an Expo SDK upgrade, which is a separate story.
- **Major upgrades of any package.** Each one gets its own ticket.
- **Web (flockpulse-web).** Already done in FP-241 (PR #232).
- **Behavior changes.** None are intended. If a fix would need a source change, stop and report.

### Story Summary
The phone app's dependencies have not been security-checked since October. The triage on 2026-10-06 suggested most advisories sit in build tools (Metro, the Expo command line, xmldom, shell-quote) rather than in code that ships inside the app, but that is not proven. This story:
1. measures the real audit today and sorts every advisory into "ships in the app" or "build tool only";
2. **stops and reports**, so Atlas can approve the fix list before anything changes;
3. applies only the approved, safe fixes;
4. adds a Dependabot configuration that groups minor and patch updates and never touches Expo SDK-pinned packages.

Part 2 is a deliberate checkpoint. Expo apps break easily when a package moves outside the SDK's pinned set.

### Repo Target
Mobile (`owgc-tech/flockpulse-mobile`). There is no web dependency and no migration.

If the approved fixes touch only JavaScript, the change ships over the air with `deploy-ios.bat` and `deploy-android.bat`. If anything changes native code, say so: that needs a new native build and would also refresh the expired Android test build (FP-231).

### Grounding Check
**Atlas could not read the mobile repo this session (no GitHub access).** Everything below comes from earlier sessions and must be verified first:
- Mobile `dev` was at `8ad6830` on 2026-10-13 and is on Expo SDK 57 (FP-189–FP-217 era).
- `apiFetch` lives in `src/lib/api.ts`. The standalone test scripts live in `scripts/` (for example `test-fp240-mobile.ts`, `test-fp222-mobile-indicators.ts`, `test-fp242-mobile.ts`), and there is no UI test framework.
- `eas.json` profiles: development, preview and production.
- Unknown: whether `.github/dependabot.yml` exists in this repo, and which Dependabot PRs are open. Check both with `gh pr list --state open`.

Invariant rules: not touched. The JSON-envelope contract: not touched.

### Implementation Plan

**Part 1: measure (no changes yet)**
1. **Bootstrap.** Save this DIP verbatim to `documentation/dips/DIP-FP-250-mobile.md`. Then create the branch `feature/FP-250-mobile-security-updates` off current `dev`.
2. **Baseline.** On unchanged `dev`, run each of these and record the summaries:
   - `npm audit --json`
   - `npm audit --omit=dev`
   - `npx expo install --check`
   - `npx expo-doctor`
   - `npx tsc --noEmit`
   - every `scripts/test-*.ts`
3. **Classify every advisory.** Make one table with these columns:
   - package and installed version;
   - severity;
   - **SHIPS** (bundled into the app at runtime) or **BUILD** (Metro, CLI, bundler or build tooling only), with how you decided: `npm ls <pkg>` showing the dependency path;
   - fix available? To what version? Is it a semver-major jump?
   - is the package **SDK-pinned**? (Yes if it, or the parent that brings it in, is managed by `expo install`.)
   - proposed action: `npm audit fix` (no `--force`), an `overrides` entry, wait for an Expo SDK upgrade, or accept with a reason.
4. **List open Dependabot PRs** with number, package, from and to versions, and your recommendation (close as superseded, keep, or major: ticket).
5. **STOP.** Report Part 1 to Joseph: the baseline numbers, the table and the Dependabot list. Do not change `package.json` or `package-lock.json` yet. Atlas will approve or edit the action list.

**Part 2: apply (only after Joseph pastes Atlas's approval)**
6. **Apply exactly the approved actions.**
   - Never use `npm audit fix --force`.
   - Never bump an SDK-pinned package.
   - Any `overrides` entry must be the minimal version that fixes the advisory, with a comment in the PR saying why.
7. **Dependabot.** Create or edit `.github/dependabot.yml`:
   - an npm entry: weekly, `target-branch: dev`, `open-pull-requests-limit: 5`;
   - `groups: { minor-and-patch: { update-types: ["minor", "patch"] } }`;
   - `ignore` for: `expo`, `expo-*`, `@expo/*`, `react`, `react-dom`, `react-native`, `react-native-*`, `@react-native/*`, `@react-native-community/*`, and `typescript` major;
   - leave everything else alone.
8. **Verify.** After the changes, run each of these:
   - `npx expo install --check`: must report nothing new out of line with the SDK;
   - `npx expo-doctor`: no new failures;
   - `npx tsc --noEmit`: clean;
   - every `scripts/test-*.ts`: must match its baseline;
   - `npx expo export --platform ios` and `--platform android` into a temp folder, to prove the JavaScript bundle still builds;
   - `npm audit` and `npm audit --omit=dev`.

   Expected: no critical; no high in SHIPS packages. Anything left over is listed with a reason.
9. **Native or not.** Say plainly whether any changed package contains native code (an `ios/` or `android/` folder in the package, or a config plugin). If none does, this ships over the air.
10. **Ship.** Commit, push, and run `gh pr create --base dev`.

### Files to Create/Modify
- Create: `documentation/dips/DIP-FP-250-mobile.md` (verbatim, then frozen).
- Modify, in Part 2 only: `package.json` (only `overrides`, or non-SDK direct dependencies that Atlas approved), `package-lock.json`, `.github/dependabot.yml`.
- Must stay untouched: everything under `app/`, `src/`, `scripts/`, `app.json` / `app.config.*`, `eas.json`. Show `git diff dev feature/FP-250-mobile-security-updates --stat` listing only the files above.

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-250-mobile-security-updates

### Commit Message
FP-250-mobile: security update for mobile dependencies; group Dependabot minor and patch updates, ignore Expo SDK-pinned packages

### Pull Request Description
Plain GitHub markdown. Include:
- **The audit before and after**, both full and `--omit=dev`, and the classification table.
- **The exact changes** with the reason for each.
- **Results:** expo check, expo-doctor, tsc, the export builds and the test scripts.
- **Over-the-air or native build**, and why.
- **Dependabot PRs** to close as superseded, and majors moved to tickets.
- **Not tested:** real devices.
- **Device steps for Joseph** after the over-the-air deploy, on every phone:
  1. Compare the update ID with the `Update:` line on the login screen. Force-quit and reopen twice.
  2. Log in. Open Events, one event, My Tasks and Announcements. Send an RSVP.
  3. Pull to refresh on the Events tab.
  4. Nothing should look or behave differently.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-250

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-250-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Branch off current dev and open the PR with gh pr create --base dev; quote the base in your report and do NOT stack it on any other branch. Do not apply any migration to a remote database and do not merge: Joseph applies migrations after review, tests, and merges manually.

**This DIP has an extra stop after Part 1:** report and wait for approval before changing any dependency.

Include full diffs for every file in your completion report per Section 5, rule 13, not a summary. The one exception is package-lock.json: report it as the list of packages whose resolved version changed (name: old → new), not the raw diff.
