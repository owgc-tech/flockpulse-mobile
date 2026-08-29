### Story Summary
Fixes a systemic, app-wide bug, confirmed via a full audit rather than assumed: the on-screen keyboard covers active text input fields on 9 of the 10 screens in this app that have one — `login.tsx` is the sole exception, and already has the correct fix. This applies that exact same proven pattern to every remaining screen.

### Repo Target
Mobile (Expo) — no new native dependency (`KeyboardAvoidingView` is core React Native, already used in `login.tsx`).

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`, via a full-repo audit, not a spot check:
- Found every file containing a `TextInput` (10 top-level screens plus component-level inputs whose parent screens are listed below), then individually confirmed `KeyboardAvoidingView` presence in each — `login.tsx` is the only one that has it.
- `login.tsx`'s exact pattern: `<KeyboardAvoidingView style={[...]} behavior={Platform.OS === "ios" ? "padding" : undefined}>` wrapping the screen's existing content — reused verbatim across all nine fixes below, not reinvented per screen.
- Each affected screen's existing scroll container (`ScrollView` or `FlatList`) stays exactly as-is — `KeyboardAvoidingView` wraps *around* it, never replaces it.
- `create.tsx` and `[id]/edit.tsx` also each host `GroupMemberChipPicker`/`MemberGroupPicker` (search-box components) — these sit inside the same screen and are covered by the same top-level wrapper, no separate fix needed per picker.

### Implementation Plan
Apply the identical fix to each of the following nine screens: wrap the existing top-level return (whatever currently wraps the `ScrollView`/`FlatList`) in a `KeyboardAvoidingView`, `behavior={Platform.OS === "ios" ? "padding" : undefined}`, matching `login.tsx` exactly.

1. `app/(app)/events/[id].tsx` (RSVP guest-count field)
2. `app/(app)/(tabs)/self-report/index.tsx` (feedback field) — also confirm whether `FlatList`'s `keyboardShouldPersistTaps="handled"` is needed alongside this for a fully smooth experience, since `KeyboardAvoidingView` alone doesn't control tap-through on a `FlatList`.
3. `app/(app)/events/[id]/edit.tsx`
4. `app/(app)/events/create.tsx`
5. `app/(app)/profile/edit.tsx`
6. `app/(app)/profile/change-password.tsx`
7. `app/(app)/profile/delete-account.tsx`
8. `app/(app)/preferences.tsx`
9. `app/(auth)/mfa-enroll.tsx`
10. `app/(auth)/mfa-verify.tsx`

### Files to Create/Modify
All ten files listed above (modify).

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-203-mobile-keyboard-avoiding-inputs

### Commit Message
FP-203-mobile: fix keyboard covering input fields app-wide

### Pull Request Description
Maps to FP-203's acceptance criteria: every screen with a text input now keeps that input visible above the keyboard while typing, using the exact `KeyboardAvoidingView` pattern already proven on the login screen — applied consistently across all nine previously-unfixed screens, not just the two originally reported. Confirm in the PR that this was tested on a real device on at least a few of the ten screens (not just typechecked), including one `FlatList`-based screen and one long form (event create/edit) specifically, since those are the cases most likely to behave differently from a simple `ScrollView`.

### Jira Linkage
- PDEEpicID: FP-11
- PDEStoryID: FP-203

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-203-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
