### Story Summary
Adds swipe left/right as an additional way to move between the 5 bottom tabs (Events, Check-In, Board, Confirm, Tasks), alongside the existing tap-only navigation. Lightweight approach, confirmed: swipe acts as a shortcut for the same navigation a tap on the adjacent tab already does — no visual sliding transition between screens (that's explicitly out of scope, a possible follow-on story).

### Repo Target
Mobile (Expo) — new native dependency (`react-native-gesture-handler`), so this requires a real native rebuild to test; the existing OTA update workflow (`publish-dev-update.bat`) cannot deliver this on its own.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Tab bar is `expo-router`'s `Tabs` (`app/(app)/(tabs)/_layout.tsx`) with a fully custom `AnimatedTabBar` — bottom tabs don't support swipe natively; this is genuinely new gesture infrastructure, not a config flip.
- Neither `react-native-gesture-handler` nor `react-native-reanimated` is a current dependency (checked `package.json` directly) — `react-native-gesture-handler` needs to be added. No `GestureHandlerRootView` currently wraps the app in `app/_layout.tsx` either — required setup, not yet present.
- Tab registration order (from `Tabs.Screen` declarations, matches `state.routes` order): `index` (Events) → `self-report/index` (Check-In) → `dashboard/index` (Board) → `confirmations/index` (Confirm) → `my-tasks/index` (Tasks).
- **Critical existing precedent, must be reused, not reimplemented**: `AnimatedTabBar.tsx` already has a proven `isRouteHidden(options)` helper and a `visibleRoutes` computation (`state.routes` filtered by `!isRouteHidden(descriptors[route.key].options)`), specifically because `href: null` (used to hide Confirmations for Member-tier) does **not** remove the route from `state.routes` — it's expressed as `tabBarItemStyle: { display: 'none' }`, and anything computing "adjacent tab" must check this itself or it'll target a hidden route. This DIP exports and reuses that exact helper rather than re-deriving visibility logic from scratch — a second, slightly-different implementation of "is this tab visible" is exactly the kind of drift that caused real bugs earlier this session (FP-186's error-code duplication, FP-192's near-miss on a second hardcoded role list).
- No RLS/backend/tenant-isolation invariant touched — this is entirely client-side navigation behavior.

### Implementation Plan
1. **`package.json`**: add `react-native-gesture-handler` (Expo-compatible version, via `npx expo install react-native-gesture-handler` so the version matches SDK 54 exactly rather than picking a version by hand).
2. **`app/_layout.tsx`**: wrap the app root in `GestureHandlerRootView` (required one-time setup for gesture-handler to function).
3. **`src/features/navigation/AnimatedTabBar.tsx`**: export the existing `isRouteHidden` helper (currently module-private) so it can be reused rather than duplicated.
4. **New `src/features/navigation/useSwipeTabNavigation.ts`**: a hook that reads the parent tab navigator's state (`useNavigation()` + `useNavigationState()`, called from within a tab screen — these resolve to the `Tabs` navigator directly since tab screens are its direct children), computes the visible route list using the exported `isRouteHidden` (identical filter to `AnimatedTabBar`'s own `visibleRoutes`), and returns `{ onSwipeLeft, onSwipeRight }` — each finds the current route's position within the visible list and calls `navigation.navigate(route.name)` on the adjacent one, or does nothing at the first/last visible tab (no wraparound, per acceptance criteria).
5. **New `src/features/navigation/SwipeableTabScreen.tsx`**: a thin wrapper component using `react-native-gesture-handler`'s `Gesture.Pan()` API, configured with a horizontal-distance/velocity threshold and `.activeOffsetX`/`.failOffsetY` tuned so a mostly-vertical drag (normal list scrolling) doesn't trigger it — calls the hook's `onSwipeLeft`/`onSwipeRight` on a qualifying gesture.
6. **Each of the 5 tab screens** (`index.tsx`, `self-report/index.tsx`, `dashboard/index.tsx`, `confirmations/index.tsx`, `my-tasks/index.tsx`): wrap the screen's existing top-level return value in `<SwipeableTabScreen>...</SwipeableTabScreen>` — no other changes to any screen's own logic.

### Files to Create/Modify
- `package.json` (modify — new dependency)
- `app/_layout.tsx` (modify — `GestureHandlerRootView`)
- `src/features/navigation/AnimatedTabBar.tsx` (modify — export `isRouteHidden`)
- `src/features/navigation/useSwipeTabNavigation.ts` (new)
- `src/features/navigation/SwipeableTabScreen.tsx` (new)
- `app/(app)/(tabs)/index.tsx`, `self-report/index.tsx`, `dashboard/index.tsx`, `confirmations/index.tsx`, `my-tasks/index.tsx` (modify — wrap in `SwipeableTabScreen`)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-194-mobile-swipe-tab-navigation

### Commit Message
FP-194-mobile: add swipe left/right to switch between bottom tabs

### Pull Request Description
Maps to FP-194's acceptance criteria: swipe left/right on any tab screen navigates to the adjacent *visible* tab (reusing `AnimatedTabBar`'s existing, proven `isRouteHidden` visibility check, so Member-tier accounts never swipe into the hidden Confirmations tab), no wraparound at either end, tuned to not fight with each screen's own vertical scrolling. No visual sliding transition — that's explicitly this story's non-goal, not this PR's job. New native dependency (`react-native-gesture-handler`) — **flag clearly in the PR that this requires a real native rebuild before it can be tested on device; the existing OTA workflow cannot deliver it.**

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-194

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-194-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
