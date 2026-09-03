### Story Summary
Mobile counterpart to FP-214-web. Adds visible red-border highlighting to blank required fields on the Create and Edit Event screens when Save fails — currently, both screens already have JS-driven required-field validation, but it only ever produces one generic message ("Please fill in all required fields.") with no indication of which specific field is the problem. Arguably a bigger gap than web's version, since there's no native browser fallback to soften it here at all.

### Repo Target
Mobile (Expo) — two screens.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Both `create.tsx` and `edit.tsx` share the identical validation shape: a single `setError("Please fill in all required fields.")` covering multiple fields at once, with a separate, distinct message for the target-selection check (`"Please select at least one target group or member."`).
- Confirmed the exact field list per screen, including the same conditional split as web: `isAnnouncement` branch checks `name`, `eventTypeId`, `startDatetime`, `announcementBody`; the non-announcement branch checks those plus `endDatetime`, `locationName`, `locationAddress`, and separately `target` (a compound check — `group_ids`/`member_ids` both empty).
- No existing field-level invalid-styling pattern in mobile either — confirmed via search, same as web. This is a new (small) pattern on this platform too, not a mismatch with something already established.

### Implementation Plan
1. On both screens, add a `fieldErrors` state object (`Record<string, boolean>`) alongside the existing `error` state.
2. In `handleSubmit`, replace each existing blanket `if (!field1 || !field2 || ...) { setError(...); return; }` check with one that also populates `fieldErrors` per individual field (which specific field(s) are actually empty), keeping the existing `error` message as the top-level summary text — this is additive, not a replacement for the existing check's logic or wording.
3. For each required field's input `style`, conditionally apply a red border (e.g. `borderColor: colors.danger, borderWidth: 1.5`, matching this app's existing `colors.danger` token already used elsewhere) when `fieldErrors[<field>]` is true.
4. Clear a specific field's entry in `fieldErrors` inside its own `onChangeText`/`onChange` handler, the moment it becomes non-empty — matching FP-214-web's same requirement, highlighting disappears as the user fixes it, no re-submit needed.
5. The target-selection check (group/member picker) gets its own `fieldErrors.target` entry, clearing when the picker's selection becomes non-empty, same mechanism as the text fields.

### Files to Create/Modify
- `app/(app)/events/create.tsx` (modify)
- `app/(app)/events/[id]/edit.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-214-mobile-required-field-highlighting

### Commit Message
FP-214-mobile: highlight blank required fields on Create/Edit Event screens

### Pull Request Description
Mobile counterpart to FP-214-web. Blank required fields now get a visible red border on both Create and Edit Event when Save fails, clearing individually as each is filled in. The existing generic error text is kept as-is (still shown alongside the new per-field highlighting), this is additive. Confirm in the PR this was tested on a real device across both the Announcement and regular-event field sets, since they validate a different field list.

### Jira Linkage
- PDEEpicID: FP-8
- PDEStoryID: FP-214

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-214-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
