### DIP 2 of 2 — Mobile

### Story Summary
Reworks the unavailability list row: removes swipe-to-reveal entirely, makes the trash icon permanently visible, adds a Pencil (edit) icon to its left with deliberate spacing between the two to prevent mis-taps. Editing opens the same from/to picker pre-filled with the existing range, calling the new update endpoint. Also switches the iOS date picker from the spinner wheel to a calendar grid, matching Android's look. **Depends on FP-190-web-adj-2 being merged and live — do not start until confirmed.**

### Repo Target
Mobile (Expo) — no new native dependency (removes gesture-handler/reanimated usage from this component entirely; `lucide-react-native`'s `Pencil` icon is already available, same package already used for `Plus`/`Trash2`).

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- **Checked the actually-installed `@react-native-community/datetimepicker` version (9.1.0)**, not assumed — its iOS `display` type supports `'inline'`, which renders the native calendar-grid picker (matching Android's look), alongside the currently-used `'spinner'`. This is the correct prop value to switch to, confirmed against the real installed types, not guessed from general familiarity with the library.
- `lucide-react-native` is already a dependency (used for `Plus`/`Trash2` in this same file) — `Pencil` is part of the same icon set, no new package needed.
- Current `UnavailabilityRow` uses `Gesture.Pan()`/`GestureDetector`/`useSharedValue`/`useAnimatedStyle` entirely for the swipe-reveal mechanic — all removed, since the trash icon becomes permanently visible and there's nothing left to reveal.

### Implementation Plan
1. **`unavailability.service.ts`**: new `updateUnavailabilityRange(id, startDate, endDate)` wrapping the new `PATCH` endpoint.
2. **`UnavailabilityRow`**: remove all gesture/reanimated code. New layout: range text (left, flexible width) — Pencil icon button — a fixed horizontal gap (e.g. 24px, generous enough to avoid fat-finger mis-taps as explicitly requested) — Trash icon button (right). Both icon buttons get `hitSlop` padding as an additional defensive measure against mis-taps, beyond the visual gap alone. Tapping Pencil opens the same from/to picker used for adding, pre-filled with the row's current `start_date`/`end_date`; confirming calls `updateUnavailabilityRange()` instead of `addUnavailabilityRange()`. Tapping Trash behaves exactly as today (immediate delete, no confirmation step, unchanged).
3. **Date picker mode**: both the add-flow and the new edit-flow's iOS `DateTimePicker` instances switch from `display="spinner"` to `display="inline"`.

### Files to Create/Modify
- `src/features/members/unavailability.service.ts` (modify)
- `src/features/profile/components/UnavailabilitySection.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-190-mobile-adj-1-edit-and-always-visible-actions

### Commit Message
FP-190-mobile-adj-1: always-visible edit/delete actions, calendar-style date picker

### Pull Request Description
Removes swipe-to-reveal (trash now always visible), adds a Pencil edit action with deliberate spacing from Trash to prevent mis-taps, and switches iOS's date picker from spinner to the calendar-grid `inline` display, matching Android. Edit calls the new atomic `PATCH` endpoint from FP-190-web-adj-2, not delete-then-recreate.

### Jira Linkage
- PDEEpicID: FP-11
- PDEStoryID: FP-190

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-190-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
