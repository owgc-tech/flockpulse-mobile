### Story Summary
Extends FP-206-adj-1's Retry button to the two remaining screens that show the friendly error message but not the button — Board (dashboard) and Tasks (my-tasks). Confirmed via your own testing that the shared `api.ts` fix already applies everywhere (both screens correctly show the friendly message), it's specifically the per-screen Retry affordance that was scoped to only three screens in the original adj-1.

### Repo Target
Mobile (Expo) — two screens.

### Grounding Check
Confirmed live against `feature/FP-206-mobile-adj-1-timeout-message-and-retry`:
- **Tasks (`my-tasks/index.tsx`)** has the identical bare-error pattern already fixed on the other three screens — same fix applies directly.
- **Board (`dashboard/index.tsx`) has a genuinely different structure, confirmed by reading the surrounding code, not assumed**: its error is a single inline `<Text>` banner rendered *above* the Event Type/Event picker controls, inside a `ScrollView` that keeps rendering everything else regardless of error state — not a full-screen replacement like the other three. This is deliberate: the picker controls should stay usable even if the dashboard stats themselves failed to load, so a full-screen swap would be wrong here. The Retry button needs to sit directly beside this inline banner, not replace the screen.

### Implementation Plan
1. **`my-tasks/index.tsx`**: add the same Retry `Pressable` pattern already used on Events/Check-in/Confirm — same styling, same "Try Again" text, calling this screen's own existing load function.
2. **`dashboard/index.tsx`**: add a Retry `Pressable` directly beside the existing inline error `<Text>` (same row/adjacent, not replacing any other content), calling this screen's own existing load function. Confirm at implementation time which function that is — likely the same one already invoked elsewhere on this screen for its initial load.

### Files to Create/Modify
- `app/(app)/(tabs)/my-tasks/index.tsx` (modify)
- `app/(app)/(tabs)/dashboard/index.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-206-mobile-adj-2-board-tasks-retry

### Commit Message
FP-206-mobile-adj-2: add Retry button to Board and Tasks tabs

### Pull Request Description
Extends FP-206-adj-1's Retry button to the two remaining screens. Tasks mirrors the existing full-screen-swap pattern exactly. Board uses a different placement (beside the existing inline error banner, not a full-screen replacement) since its picker controls need to stay usable even during an error — confirm this was tested specifically: trigger an error on Board, confirm the pickers are still interactive, and confirm Retry successfully reloads the stats.

### Jira Linkage
- PDEEpicID: FP-31
- PDEStoryID: FP-206

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-206-mobile-adj-2.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against feature/FP-206-mobile-adj-1-timeout-message-and-retry (stacked, since that PR is still open) and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
