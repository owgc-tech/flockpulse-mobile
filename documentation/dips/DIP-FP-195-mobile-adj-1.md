### Story Summary
Fixes a visible flash discovered during real-device testing of FP-195: the outgoing screen's slide-out position resets to center immediately after the navigation call fires, not after the tab switch has actually visually completed — since inactive tab screens stay mounted (not unmounted), this produces a brief flash of the previous screen snapping back into view before the new one takes over. Single-file fix, `SwipeableTabScreen.tsx` only — no other part of FP-195 or FP-194 is touched.

### Repo Target
Mobile (Expo) — no new dependencies, uses `react-native-reanimated`/navigation infrastructure already in place from FP-195.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Root cause confirmed precisely: `SwipeableTabScreen.tsx`'s `withTiming` completion callback resets `translateX.value = 0` right after queuing `runOnJS(onSwipeLeft/onSwipeRight)()` — that reset is not coordinated with when React Navigation's tab switch actually completes, since bottom tabs keep inactive screens mounted rather than unmounting them.
- `useFocusEffect`/`useIsFocused` are genuinely available from the same vendored path already used for `useNavigation`/`useNavigationState` in `useSwipeTabNavigation.ts` (`expo-router/build/react-navigation/native` → re-exported from `../core`) — confirmed against the actual installed package's `.d.ts`, not assumed. Same `@deprecated`-with-no-better-alternative situation already known from FP-179's review: `expo-router`'s own top-level doesn't export either one yet either.
- The correct fix resets a screen's position when *it* becomes focused, not when the *other* screen is left — this decouples the reset from any timing race with the outgoing animation entirely, rather than trying to delay/time the existing reset more carefully (which would be fragile and device-speed-dependent, exactly the kind of thing that could pass on a fast device and still flash on a slow one).
- No routing/deep-link/gesture-threshold logic is touched — this is purely about *when* a position reset happens, not *what* navigates where.

### Implementation Plan
1. **`SwipeableTabScreen.tsx`**: import `useIsFocused` from `expo-router/build/react-navigation/native` (same import path convention as `useSwipeTabNavigation.ts`). Add a `useEffect` that resets `translateX.value = 0` whenever `isFocused` becomes `true` — this guarantees any screen is always at its resting position by the time it's actually visible again, regardless of how or when it was last left.
2. Remove the `translateX.value = 0` reset currently inside the `withTiming` completion callback — it's no longer the source of truth for resetting position; the focus-based reset in step 1 fully replaces it. Leaving both in place would just be two competing reset points for the same problem, worth removing rather than leaving as redundant/confusing.

### Files to Create/Modify
- `src/features/navigation/SwipeableTabScreen.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-195-mobile-adj-1-fix-swipe-flash

### Commit Message
FP-195-mobile-adj-1: reset swipe transition position on focus, not on animation completion

### Pull Request Description
Fixes the flash found during FP-195's real-device testing: outgoing screens now reset their slide position when they next become focused (via `useIsFocused`), not immediately after the navigation call fires — eliminating the timing race that let a screen snap back to center while still visually on top. No change to gesture detection, thresholds, navigation targets, or the deep-link flows FP-195 already verified.

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-195

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-195-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
