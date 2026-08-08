### DIP 2 of 2 — Mobile

### Story Summary
Adds the self-service Delete My Account flow to mobile's Edit Profile screen, gated behind password re-entry given the action's irreversibility, calling the new `DELETE /api/members/me` endpoint (FP-187-web) and signing the person out immediately on success. Depends on FP-187-web being merged and live — do not start until confirmed.

### Repo Target
Mobile (Expo) — UI and confirmation flow only; all scrubbing/deactivation logic lives in the web-side endpoint this consumes.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` `dev`:
- `app/(app)/profile/edit.tsx` already has a "Change Password" link (added under FP-186-mobile, `testID="edit-profile-change-password-link"`, navigating to a sibling screen) — this DIP follows the exact same pattern: a new link near it, navigating to a new sibling screen, not a modal or inline section.
- `signOut()` exists in `src/features/auth/services/auth.service.ts` — reused as-is for the post-deletion sign-out, no new auth-service code needed.
- Password re-entry as the confirmation gate is verified via `supabase.auth.signInWithPassword({ email, password })` — if that succeeds, the password is confirmed correct without needing a separate backend verification endpoint. If it fails, show an inline error and do not proceed to the actual deletion call.
- The delete call must surface `INVALID_STATE_TRANSITION`'s parsed count clearly (e.g. "You still own 2 events — transfer ownership before deleting your account") rather than a generic failure message, mirroring how the existing web admin deactivation-guard errors are already surfaced there.

### Implementation Plan
1. **New screen `app/(app)/profile/delete-account.tsx`**: clear warning copy about irreversibility, a password field, "Delete My Account" button. On submit: `supabase.auth.signInWithPassword()` with the current session's email + entered password to confirm identity; on success, call the new `DELETE /api/members/me`. On success of that: call `signOut()`, then navigate to the sign-in/welcome screen (there is no member record left to return to). On `INVALID_STATE_TRANSITION`: surface the specific reason and count from the error. On `AUTH_DELETE_FAILED`: the person's data is already scrubbed and they're already locked out server-side — show a message telling them the deletion completed but to contact support if they're still able to log in, then sign them out regardless.
2. **`app/(app)/profile/edit.tsx`**: add a "Delete My Account" link near the existing "Change Password" link, visually distinguished (e.g. destructive/red styling) given its irreversible nature, navigating to the new screen.

### Files to Create/Modify
- `app/(app)/profile/delete-account.tsx` (new)
- `app/(app)/profile/edit.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-187-mobile-self-service-account-deletion

### Commit Message
FP-187-mobile: add self-service account deletion screen

### Pull Request Description
Maps to FP-187's mobile acceptance criteria: new Delete My Account screen off Edit Profile, gated behind password re-entry (verified via `signInWithPassword`, not a new backend endpoint), calling the new `DELETE /api/members/me` and signing out immediately on success. Guard-trigger failures (still-owns-things) are surfaced with their specific reason and count, not a generic error.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-187

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-187-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
