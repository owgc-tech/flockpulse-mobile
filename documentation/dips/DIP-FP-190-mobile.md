### DIP 2 of 2 — Mobile

### Story Summary
Adds a self-service unavailability section to the Edit Profile screen — "Not available on these Dates" (left) with a "+" (right) opening a from/to date-range picker, a list of filed ranges below (current calendar year only), swipe-to-reveal delete per row — positioned above the existing Change Password/Delete My Account links. Consumes FP-190-web's new endpoints. **Depends on FP-190-web being merged and live — do not start until confirmed.**

### Repo Target
Mobile (Expo) — UI only; no new native dependency (gesture-handler/reanimated already compiled in from FP-195, reused for the swipe-to-delete row).

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- **Date picker precedent, confirmed exact**: `profile/edit.tsx` already uses `DateTimePicker`/`DateTimePickerAndroid` (`@react-native-community/datetimepicker`) for `birthdate`, with the established Android-inline-vs-iOS-modal split (`Platform.OS === "android"` branch). The from/to range picker mirrors this exactly — two date fields, same platform-split pattern, not a new picker library.
- **Swipe-to-delete precedent**: `SwipeableTabScreen.tsx` is the only existing gesture-handler-based component, tab-navigation-specific — not directly reusable, but confirms `react-native-gesture-handler`/`react-native-reanimated` are already compiled into the native binary (from FP-195's build), so a new swipeable list-row component needs no new native dependency and stays OTA-updatable.
- No direct client-side table writes exist for member data anywhere in mobile — the new unavailability section calls FP-190-web's new endpoints via `apiFetch`, same convention as every other mobile feature.
- This section's add/remove actions are explicitly independent of the main profile Save button (per the story) — each range add/delete is its own immediate API call, not batched with `updateMyProfile()`.

### Implementation Plan
1. **New `src/features/members/unavailability.service.ts`**: `listMyUnavailability()`, `addUnavailabilityRange(startDate, endDate)`, `deleteUnavailabilityRange(id)` — thin wrappers over FP-190-web's three endpoints.
2. **New `src/features/profile/components/UnavailabilitySection.tsx`**: header row (label left, "+" button right) opening a from/to `DateTimePicker` pair (mirroring `edit.tsx`'s existing birthdate pattern) on tap; on confirming both dates, calls `addUnavailabilityRange()` and refreshes the list. List below shows each range (e.g. "Aug 12 – Aug 15"), filtered to ranges overlapping the current calendar year (client-side filter on the full list `listMyUnavailability()` returns — filing itself is never restricted, only this view). Each row wrapped in a swipeable component (new, gesture-handler-based, mirroring `SwipeableTabScreen.tsx`'s `activeOffsetX`/`failOffsetY` disambiguation so it doesn't fight vertical scrolling) revealing a delete (trash/X) affordance on swipe, calling `deleteUnavailabilityRange()` on confirm.
3. **`app/(app)/profile/edit.tsx`**: render `<UnavailabilitySection />` below the Save button, above the existing "Change Password" and "Delete My Account" links (pushing both down, unchanged otherwise).

### Files to Create/Modify
- `src/features/members/unavailability.service.ts` (new)
- `src/features/profile/components/UnavailabilitySection.tsx` (new)
- `app/(app)/profile/edit.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-190-mobile-unavailability-section

### Commit Message
FP-190-mobile: self-service unavailability section on Edit Profile

### Pull Request Description
Maps to FP-190's mobile acceptance criteria: "Not available on these Dates" section on Edit Profile, from/to range picker mirroring the existing birthdate picker pattern, current-year-filtered list, swipe-to-reveal delete, positioned above Change Password/Delete My Account — each action independent of the main profile Save. Confirm in the PR that a real hard-block error (from FP-190-web, triggered by testing an assignment against a filed range) was actually exercised end-to-end, not just the filing UI in isolation.

### Jira Linkage
- PDEEpicID: FP-11
- PDEStoryID: FP-190

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-190-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build (should not require a fresh EAS build — no new native dependency — but confirm via `expo start --dev-client` first), and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
