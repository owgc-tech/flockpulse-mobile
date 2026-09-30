### DIP — FP-219 (Mobile)

### Story Summary
Mobile counterpart to FP-219-web. Adds the same basic validation to the Location Address field on both the Create and Edit Event screens — a length cap and a check against obviously-junk input, matching web's rules exactly so behavior is consistent across platforms. The server-side check (already covered by FP-219-web's API changes) protects mobile submissions automatically, since both apps call the same routes — this DIP is specifically the client-side, mobile-side half.

### Repo Target
Mobile (Expo) — two screens.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- Neither `app/(app)/events/create.tsx` nor `app/(app)/events/[id]/edit.tsx` has any `maxLength` on their `locationAddress` `TextInput` — confirmed via direct search.
- Both screens already use the `fieldErrors`/`themed.invalidField` pattern from today's FP-214 work — the new junk-input check should plug into this same existing mechanism, not invent a separate one.
- Server-side enforcement is already covered by FP-219-web's changes to `app/api/events/route.ts` and `app/api/events/[id]/route.ts` — both apps share these routes, so no additional backend work is needed here.

### Implementation Plan
1. On both screens, add `maxLength={200}` to the Location Address `TextInput` — matching web's cap exactly.
2. Add the same lightweight junk-input check used on web: reject (via the existing `fieldErrors` mechanism) input that, after trimming, is empty or a single character repeated throughout.
3. No change to either screen's submission logic beyond this validation — the actual API call and its payload shape stay the same.

### Files to Create/Modify
- `app/(app)/events/create.tsx` (modify)
- `app/(app)/events/[id]/edit.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-219-mobile-address-validation

### Commit Message
FP-219-mobile: basic validation for Location Address field

### Pull Request Description
Mobile counterpart to FP-219-web. Same 200-character cap and junk-input check, using the existing `fieldErrors` pattern from FP-214. No change to submission logic. Confirm in the PR this was tested on a real device on both screens.

### Jira Linkage
- PDEEpicID: FP-8
- PDEStoryID: FP-219

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-219-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it on a real native build, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
