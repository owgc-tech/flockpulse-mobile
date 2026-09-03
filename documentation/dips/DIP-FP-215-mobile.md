### DIP — FP-215 (Mobile)

### Story Summary
Switches the remaining three spinner-style iOS date pickers to the calendar-grid style, matching the pattern already established and tested for the unavailability date-range picker (FP-190-mobile-adj-1). Purely visual — no change to date-selection logic or validation.

### Repo Target
Mobile (Expo) — three screens.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`, this session:
- Exactly three remaining screens use `display="spinner"`: `app/(app)/profile/edit.tsx` (birthdate), `app/(app)/events/[id]/edit.tsx` (start/end datetime), `app/(app)/events/create.tsx` (start/end datetime).
- The correct target value, `display="inline"`, is already proven working in production via FP-190-mobile-adj-1's unavailability picker — confirmed against the actually-installed `@react-native-community/datetimepicker` version's real type definitions at that time, not reused blindly here, but the same established, tested value.
- Android is genuinely unaffected — its native picker was never spinner-style; this prop only has meaning on iOS.

### Implementation Plan
1. On each of the three screens, change every `display="spinner"` occurrence to `display="inline"`. No other prop, handler, or logic change on any of these pickers.

### Files to Create/Modify
- `app/(app)/profile/edit.tsx` (modify)
- `app/(app)/events/[id]/edit.tsx` (modify)
- `app/(app)/events/create.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-215-mobile-calendar-date-pickers

### Commit Message
FP-215-mobile: switch remaining spinner date pickers to calendar style

### Pull Request Description
Maps to FP-215's acceptance criteria: all three remaining spinner-style iOS date pickers now use the calendar-grid style, matching the already-proven FP-190-mobile-adj-1 pattern exactly. No change to date logic, validation, or Android behavior. Confirm in the PR this was tested on a real iOS device across all three screens.

### Jira Linkage
- PDEEpicID: FP-8
- PDEStoryID: FP-215

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-215-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
