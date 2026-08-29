### Story Summary
Fixes a real, remaining gap found during your own device testing of FP-203: the "reason for declining" and "number of guests" fields on the event detail screen are still partially covered by the keyboard, even with `KeyboardAvoidingView` in place. Confirmed root cause: `RsvpControls` genuinely is inside the `KeyboardAvoidingView`/`ScrollView` — the issue is that the `ScrollView`'s content area has only a flat `padding: 24`, with no extra room reserved below the last content specifically for keyboard clearance. When there isn't much content below `RsvpControls` (e.g. an event with few RSVPs, so the Roster section beneath it is short), the `ScrollView` runs out of room to scroll into before the field clears the keyboard.

### Repo Target
Mobile (Expo) — no new dependency, this is a styling adjustment to already-fixed screens.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile`, on `feature/FP-203-mobile-keyboard-avoiding-inputs`:
- `<RsvpSection>` (containing `<RsvpControls>`, containing both reported fields) is genuinely rendered inside both the `<ScrollView>` and the `<KeyboardAvoidingView>` in `app/(app)/events/[id].tsx` — confirmed by tracing the actual JSX invocation point, not just the function's textual position in the file.
- The `ScrollView`'s `contentContainerStyle` (`container: { padding: 24, ... }`) has no bottom-specific extra padding at all — confirmed this is the actual gap, not a mis-applied `KeyboardAvoidingView`.
- This same shape of gap (flat, uniform padding with nothing reserved for keyboard clearance) is worth checking across all nine other screens FP-203 already fixed, not assumed to be isolated to this one — the underlying `KeyboardAvoidingView` fix was correct everywhere, but this specific "not enough scroll runway" issue is a separate concern per screen, depending on how much content sits below each screen's lowest input.

### Implementation Plan
1. **`app/(app)/events/[id].tsx`**: add generous extra bottom padding to the `ScrollView`'s `contentContainerStyle` — specifically for keyboard clearance, not just general spacing (e.g. `paddingBottom: 300`, roughly matching a typical keyboard's height plus margin; confirm a reasonable exact value at implementation time rather than under- or over-shoot).
2. **Audit the other nine FP-203 screens** for the same gap (a `ScrollView`/`FlatList` contentContainerStyle with no keyboard-clearance-specific bottom padding) and apply the same fix to any that need it. Document in the PR which screens were found to need it and which didn't, rather than applying it blindly everywhere — some screens (like `mfa-verify.tsx`, with only two fields and no long scrollable content) likely don't need this at all.

### Files to Create/Modify
- `app/(app)/events/[id].tsx` (modify)
- Any of the other nine FP-203 screens found to need the same fix during the audit (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-203-mobile-adj-1-keyboard-scroll-padding

### Commit Message
FP-203-mobile-adj-1: add keyboard-clearance bottom padding where scroll content runs short

### Pull Request Description
Fixes a real gap found during Joseph's own device testing: the "reason for declining" and "number of guests" fields were still partially covered by the keyboard because the ScrollView had no extra room reserved below its content to scroll into — not a KeyboardAvoidingView placement issue, which was already correct. Report which of the other nine FP-203 screens were checked and which actually needed the same fix.

### Jira Linkage
- PDEEpicID: FP-11
- PDEStoryID: FP-203

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-203-mobile-adj-1.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against feature/FP-203-mobile-keyboard-avoiding-inputs (not dev — this stacks on the still-open, unmerged parent PR #111, same reasoning as FP-195's earlier adjustment DIPs) and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
