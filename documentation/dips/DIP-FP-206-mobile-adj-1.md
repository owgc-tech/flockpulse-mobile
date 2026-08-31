### Story Summary
Fixes two real gaps found during your own device testing of FP-206. (1) The friendly timeout message never actually reaches the screen — Expo's real fetch implementation throws a `FetchError` with no custom `.name` set (confirmed via its source), so our `err.name === "AbortError"` check never matches, and the raw native exception text leaks through instead. (2) Once any screen enters its error state, there's no way to recover without fully restarting the app — the error view is a bare `<Text>` with no `RefreshControl`/retry affordance, confirmed identical on all three screens you hit (Events, Check-in, Confirm).

### Repo Target
Mobile (Expo) — one shared file plus three screens.

### Grounding Check
Confirmed live against `feature/FP-206-mobile-api-fetch-timeout` (stacks on this still-open PR, not `dev` directly):
- `node_modules/expo/src/winter/fetch/FetchErrors.ts`'s `FetchError` class extends `Error` but never sets `.name` in its constructor — confirmed by reading the actual installed source, not assumed. It inherits the generic `"Error"`, never `"AbortError"`.
- The correct, platform-independent fix is checking `controller.signal.aborted` directly after the fetch throws, rather than trying to match the thrown error's `.name`/type — this sidesteps needing to know each platform's exact fetch error shape, since it's asking "did *my own* timeout fire" rather than "does this error happen to be named a certain way."
- All three screens (`(tabs)/index.tsx`, `(tabs)/self-report/index.tsx`, `(tabs)/confirmations/index.tsx`) confirmed to have the identical bare-error pattern: `error ? <View style={styles.center}><Text>{error}</Text></View> : (<FlatList.../SectionList.../>)`  — the list/refresh-control-bearing component is completely absent in the error branch on every one of them.

### Implementation Plan
1. **`src/lib/api.ts`**: in the `fetch()` catch block, replace `if (err instanceof Error && err.name === "AbortError")` with a check against `controller.signal.aborted` (the controller is already in scope at that point) — if true, throw `timeoutError()`, matching the existing behavior otherwise unchanged.
2. **All three screens**: in the error branch, add a **Retry** button (or `Pressable`) below the error text that calls the screen's own existing load/fetch function again (`load()` in Confirm/Check-in, the equivalent existing function in Events) — no new data-fetching logic, just re-invoking what already exists.

### Files to Create/Modify
- `src/lib/api.ts` (modify)
- `app/(app)/(tabs)/index.tsx` (modify)
- `app/(app)/(tabs)/self-report/index.tsx` (modify)
- `app/(app)/(tabs)/confirmations/index.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-206-mobile-adj-1-timeout-message-and-retry

### Commit Message
FP-206-mobile-adj-1: fix timeout message not showing, add retry to error states

### Pull Request Description
Fixes two real gaps found in FP-206 testing: the friendly timeout message wasn't reaching the screen (fixed by checking the controller's own abort signal instead of the thrown error's name, which Expo's fetch implementation doesn't set reliably), and error states on Events/Check-in/Confirm had no way to recover without restarting the app (fixed with a Retry button on all three). Confirm in the PR this was tested on a real device using the same black-hole-address technique from FP-206's own testing, including confirming the friendly message now actually appears and Retry actually recovers without a restart.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-206

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-206-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against feature/FP-206-mobile-api-fetch-timeout (not dev — stacks on the still-open parent PR #119) and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
