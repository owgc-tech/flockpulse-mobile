### Story Summary
Replaces four fragmented, individually-broken Dependabot PRs (react-native, expo, expo-router, expo-notifications) with one coordinated Expo SDK 54→57 upgrade, using `expo install --fix` to resolve every Expo-ecosystem package to its correct mutually-compatible version rather than trusting Dependabot's individually-proposed numbers. Fixes the one already-known breaking change (`StyleSheet.absoluteFillObject` → `absoluteFill`) across its 4 known files, and — since a 3-SDK-version jump realistically surfaces more than one rename — requires CC to actually attempt the upgrade and fix whatever typecheck surfaces, not just the known list. Closes Dependabot's fragmented PRs and tightens `dependabot.yml` so this doesn't recur. This also happens to move the app onto an Xcode-26-era RN version, relevant to Apple's current SDK requirement, though that's a side effect of this story, not its purpose.

### Repo Target
Mobile (Expo) — dependency/version change only, no schema/backend involvement. **Requires a real native rebuild to test** — same caveat as FP-194: `npx expo run:ios`/`run:android` (or EAS Build, still not set up), never the existing OTA workflow, since native module versions are changing underneath the JS layer.

### Grounding Check
Re-confirmed live against `owgc-tech/flockpulse-mobile` `dev`, this session — nothing drifted since this story was originally scoped:
- Still on `expo ^54.0.0`, `react-native 0.81.5`, `expo-router ~6.0.24`, `expo-notifications ~0.32.17` — no partial upgrade has landed.
- All 4 originally-flagged files still use `StyleSheet.absoluteFillObject`: `src/features/profile/components/Avatar.tsx`, `app/(app)/events/create.tsx`, `app/(app)/events/[id]/edit.tsx`, `app/(app)/(tabs)/index.tsx` — specifically re-verified `Avatar.tsx` survived its recent FP-192-mobile rewrite with this usage intact (that rewrite touched role-label logic, not styling).
- `.github/dependabot.yml` still has no `groups:` config and no `ignore` rules — the grouping fix this story requires is still needed exactly as originally scoped.
- Real uncertainty, stated plainly rather than glossed over: SDK 55/56 each had their own breaking changes en route to 57 (per Expo's own release notes) — `absoluteFillObject`→`absoluteFill` is the one already found by isolated Dependabot attempts, but the *actual* upgrade, run as one coordinated change, may surface more. This DIP is scoped to "fix whatever typecheck and testing actually surface," not "fix exactly these 4 files and stop."

### Implementation Plan
1. Close/supersede Dependabot PRs #60, #59, #57, #55 — this coordinated upgrade replaces them, they should not be merged individually.
2. Bump `expo` to `^57.0.0` in `package.json`, then run `npx expo install --fix` to let Expo itself resolve every ecosystem package (react-native, expo-router, expo-notifications, and any others `expo install` manages) to its correct SDK-57-compatible version — not hand-picking version numbers.
3. Fix the known rename: `StyleSheet.absoluteFillObject` → `StyleSheet.absoluteFill` in all 4 flagged files.
4. Run `npx tsc --noEmit -p .` and fix whatever else it surfaces beyond the known rename — expect this, don't treat anything beyond the 4 known files as out of scope. Document each additional fix in the PR description (not the DIP file), same convention as every other DIP this session.
5. Update `.github/dependabot.yml`: add a `groups:` entry bundling `expo`, `expo-*`, and `react-native` into a single combined PR going forward, so a future SDK bump arrives as one coordinated PR instead of fragmenting again.
6. Real-device testing via `npx expo run:ios`/`run:android` (or EAS Build) required before this is considered done — a clean typecheck alone is not sufficient given the native-code nature of this change, per this story's own acceptance criteria.

### Files to Create/Modify
- `package.json`, `package-lock.json` (modify — coordinated version bump)
- `src/features/profile/components/Avatar.tsx`, `app/(app)/events/create.tsx`, `app/(app)/events/[id]/edit.tsx`, `app/(app)/(tabs)/index.tsx` (modify — known rename)
- Any additional files typecheck/testing surfaces (document each in the PR description)
- `.github/dependabot.yml` (modify — grouping)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-179-mobile-expo-sdk-57-upgrade

### Commit Message
FP-179-mobile: coordinated Expo SDK 54→57 upgrade

### Pull Request Description
Maps to FP-179's acceptance criteria: one coordinated upgrade (via `expo install --fix`) replacing Dependabot's four fragmented, individually-broken PRs; known `absoluteFillObject`→`absoluteFill` rename fixed across all 4 files; `dependabot.yml` grouped to prevent recurrence. List every additional file touched beyond the 4 known ones, with what specifically broke and why, since more than the known rename is expected on a 3-version jump. **Flag clearly that this requires a native rebuild to test — confirm in the PR whether real-device testing (not just typecheck) was actually done, and on what.**

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-179

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-179-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
