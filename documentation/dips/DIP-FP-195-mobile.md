### Story Summary
Adds a real sliding-transition feel to the swipe gesture FP-194 already shipped, without touching the underlying navigation/routing at all — this is a purely visual layer on top of FP-194's existing gesture detection and `navigation.navigate()` calls. On a qualifying swipe, the current screen's content visually follows the finger and slides off, then the exact same navigation FP-194 already computes fires — no change to which tab is "adjacent," no change to routing, no change to the two existing notification-tap deep-links.

### Repo Target
Mobile (Expo) — new native dependency (`react-native-reanimated`), so this needs a real native rebuild to test, same caveat as FP-194 and FP-179.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- `SwipeableTabScreen.tsx`'s own comment already documents exactly why reanimated wasn't needed for FP-194: gesture-handler's plain JS-thread `.onEnd()` callback was sufficient for a snap-to-adjacent-tab behavior with no visual motion. This story is precisely the case that comment anticipated — reanimated is now genuinely needed to drive a UI-thread-animated value from the gesture in real time.
- `useSwipeTabNavigation()`'s `onSwipeLeft`/`onSwipeRight` are reused completely unchanged — this DIP does not touch that file, `visibleTabRouteNamesStore.ts`, `AnimatedTabBar.tsx`, or any routing/deep-link code. The two notification-tap deep-links in `app/_layout.tsx` (self-report, confirmations) are untouched by this DIP entirely — confirmed by not needing to modify that file at all.
- **No `babel.config.js` exists anywhere in this repo.** `react-native-reanimated` requires its Babel plugin registered as the *last* plugin in the list, or it fails at runtime (not a typecheck-catchable failure) — this DIP must create the file, not edit one.
- `expo-router`'s own `peerDependencies` already list `react-native-reanimated: "*"` (confirmed during FP-179's review) — installing it now finally satisfies a peer dependency that's been unmet since the SDK 57 upgrade, closing that previously-flagged, previously-unverified gap.

### Implementation Plan
1. Run `npx expo install react-native-reanimated` (resolves the correct SDK-57-compatible version, same convention as every other native dependency this session).
2. **New `babel.config.js`**: `presets: ['babel-preset-expo']`, `plugins: ['react-native-reanimated/plugin']` — the reanimated plugin must be last in the plugins array per its own documented requirement.
3. **`SwipeableTabScreen.tsx`**: add a Reanimated shared value (`translateX`), driven by the pan gesture's `.onUpdate()` (not just `.onEnd()` as today) so the screen content visually tracks the finger during the drag. On `.onEnd()`: if the swipe qualifies (same `SWIPE_DISTANCE_THRESHOLD`/`SWIPE_VELOCITY_THRESHOLD` constants, unchanged), animate `translateX` the rest of the way off-screen in the swipe direction (`withTiming`), then call the existing `onSwipeLeft()`/`onSwipeRight()` from `useSwipeTabNavigation()` once that animation completes — identical navigation call to today, just sequenced after a visual transition instead of instantly. Reset `translateX` to 0 immediately after navigating, so the screen doesn't appear off-screen if the user swipes back to it later (each tab screen is its own `SwipeableTabScreen` instance with its own shared value — this reset is local, not global). If the swipe doesn't qualify (too short/slow), spring `translateX` back to 0 with no navigation call at all — same as today's behavior for a non-qualifying gesture, just with a visual "snap back" instead of nothing happening.
4. Wrap the animated content in `Animated.View` (from `react-native-reanimated`) with a `useAnimatedStyle` mapping `translateX` to a transform — the only new visual-layer code; everything else in the component (gesture config, thresholds, direction convention) stays as FP-194 built it.

### Files to Create/Modify
- `package.json`, `package-lock.json` (modify — new dependency)
- `babel.config.js` (new)
- `src/features/navigation/SwipeableTabScreen.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-195-mobile-animated-swipe-transition

### Commit Message
FP-195-mobile: add animated slide transition to tab swipe

### Pull Request Description
Maps to FP-195's acceptance criteria: swipe now visually slides via `react-native-reanimated` before firing the exact same `navigation.navigate()` FP-194 already computed — no routing changes, no changes to `useSwipeTabNavigation.ts`/`AnimatedTabBar.tsx`/`visibleTabRouteNamesStore.ts`, and specifically confirm in the PR that the two existing notification deep-links (self-report, confirmations tabs) still work unchanged, since that was this story's explicit risk to guard against. **Flag clearly that this requires a native rebuild to test — a new `babel.config.js` plus a new native dependency (`react-native-reanimated`) means this cannot be verified by typecheck alone; confirm real-device testing was done.**

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-195

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-195-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
