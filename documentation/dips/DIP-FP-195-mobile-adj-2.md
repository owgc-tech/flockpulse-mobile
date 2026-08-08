### Story Summary
Two related fixes found during real-device testing of FP-195/adj-1, both in the same file/gesture logic: (1) a real bug — swiping past the first or last tab plays the slide-off animation unconditionally, but since there's no adjacent tab to navigate to, focus never actually changes, so the `useIsFocused`-triggered reset from adj-1 never fires and the screen is stuck blank indefinitely; (2) a refinement — the incoming screen currently just appears instantly rather than sliding in from the opposite edge, making the transition feel one-sided.

### Repo Target
Mobile (Expo) — same file as adj-1, one small addition (a new pub-sub-style store, mirroring existing precedent). No new dependencies.

### Grounding Check
Confirmed live against `feature/FP-195-mobile-adj-1-fix-swipe-flash` (this stacks on that branch, same as adj-1 stacked on FP-195 itself):
- **Root cause of the blank-screen bug, confirmed precisely**: `useSwipeTabNavigation()`'s `navigateByOffset()` silently no-ops at either boundary (`if (targetIndex < 0 || targetIndex >= visibleRouteNames.length) return;`) with no signal back to the caller about whether navigation happened. `SwipeableTabScreen.tsx`'s `.onEnd()` has no boundary awareness at all — it always plays the full off-screen slide animation once a swipe qualifies by distance/velocity, regardless of whether there's actually an adjacent tab to land on. At a boundary, the screen slides fully off-screen, `onSwipeLeft`/`onSwipeRight` no-ops internally, focus never changes, and adj-1's `isFocused`-triggered reset — which only fires on a focus *transition* — never runs, since this screen's focus never left in the first place.
- `visibleTabRouteNamesStore.ts` is the existing pub-sub precedent to mirror for any new module-level shared state in this file's neighborhood — but the new store this DIP needs is read imperatively once (inside a `useEffect`, at the moment a screen becomes focused), not reactively re-rendered on change, so a plain get/set pair is sufficient and simpler than replicating the full listener-subscription pattern; noted explicitly here so it's clear this is a deliberate simplification, not an inconsistency.
- The "which direction did the outgoing screen slide" information doesn't exist anywhere today — it's local to the gesture handler's own closure and discarded once the animation completes. Making the incoming screen slide in from the correct edge requires this information to cross from the outgoing screen's component instance to the incoming screen's separate component instance — two different mounted `SwipeableTabScreen` instances, since tab screens stay mounted independently (confirmed repeatedly this session, most recently in adj-1's own grounding).

### Implementation Plan
1. **`useSwipeTabNavigation.ts`**: compute and return `canSwipeLeft`/`canSwipeRight` booleans alongside the existing `onSwipeLeft`/`onSwipeRight` — same `currentIndex`/`visibleRouteNames` computation already there, just exposing the boundary check as a value instead of only using it internally to decide whether to no-op.
2. **New `src/features/navigation/lastSwipeDirectionStore.ts`**: plain module-level `let lastDirection: "left" | "right" | null = null` with `setLastSwipeDirection()`/`getLastSwipeDirection()` — no listener/subscription machinery, since this is read once imperatively at the moment of focus, not subscribed to for re-renders. Comment explaining why this deliberately doesn't mirror `visibleTabRouteNamesStore.ts`'s fuller pub-sub shape.
3. **`SwipeableTabScreen.tsx`**:
   - Read `canSwipeLeft`/`canSwipeRight` from the hook. In `.onEnd()`, before starting the off-screen slide: if the swipe direction has no adjacent tab to go to (`isSwipeLeft && !canSwipeLeft`, or `!isSwipeLeft && !canSwipeRight`), treat it exactly like a non-qualifying swipe — `translateX.value = withSpring(0)` and return, never starting the off-screen animation at all. This is the actual bug fix.
   - Right before calling `runOnJS(onSwipeLeft)()`/`runOnJS(onSwipeRight)()` in the qualifying-swipe branch, also call `runOnJS(setLastSwipeDirection)(isSwipeLeft ? "left" : "right")` to record which direction caused this transition, for the incoming screen to read.
   - In the `isFocused`-triggered `useEffect`: read `getLastSwipeDirection()`. If `null` (a plain tap on the bottom tab bar, or initial app load — never a swipe), keep today's behavior: set `translateX.value = 0` directly, no animation. If a direction is present, this screen is the swipe's *destination* — set `translateX.value` to the correct starting off-screen position first (arriving from a `"left"`-caused transition means the outgoing screen went left, so this screen should start at `+screenWidth` and slide *left* to 0; a `"right"`-caused transition starts this screen at `-screenWidth` and slides *right* to 0), then animate to 0 via `withTiming` using the same `SLIDE_OUT_DURATION_MS`. Clear the stored direction (`setLastSwipeDirection(null)`) immediately after reading it, so a subsequent plain tap doesn't incorrectly replay a stale slide-in.

### Files to Create/Modify
- `src/features/navigation/useSwipeTabNavigation.ts` (modify)
- `src/features/navigation/lastSwipeDirectionStore.ts` (new)
- `src/features/navigation/SwipeableTabScreen.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-195-mobile-adj-2-boundary-and-two-sided-slide

### Commit Message
FP-195-mobile-adj-2: fix stuck-blank-screen at swipe boundaries, add two-sided slide transition

### Pull Request Description
Two fixes, both found during real-device testing: (1) swiping past the first/last tab no longer plays the off-screen animation at all when there's no adjacent tab — fixes the stuck-blank-screen bug, root cause explained in the Grounding Check above; (2) the incoming screen now slides in from the correct edge in sync with the outgoing screen sliding out, via a small new direction-tracking store, rather than just instantly appearing. Explicitly test: swiping past the first tab (Events) to the right, past the last tab (Tasks) to the left, a normal mid-list swipe in both directions, and a plain tap on the bottom bar (should still be instant, no slide) — confirm none of these leave a screen stuck off-screen.

### Jira Linkage
- PDEEpicID: FP-15
- PDEStoryID: FP-195

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-195-mobile-adj-2.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against feature/FP-195-mobile-adj-1-fix-swipe-flash (not dev — same stacking reasoning adj-1 used) and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
