### DIP 1 of 2 — Mobile

### Story Summary
Adds an in-app "change my password while logged in" flow to mobile, satisfying Apple's requirement that password management not rely solely on the "forgot password" email-reset flow. New screen reachable from Edit Profile, calling Supabase Auth's client-side `updateUser({ password })` directly — no current-password re-entry required, confirmed against this repo's own existing usage of that exact call on web.

### Repo Target
Mobile (Expo) — new screen only, no backend/schema changes.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` and `owgc-tech/flockpulse-web` `dev`:
- The open question FP-186 itself flags is answered by existing code, not assumption: `web/app/reset-password/confirm/actions.ts` already calls `supabase.auth.updateUser({ password })` with no current-password argument, on a session established via the recovery-link flow. A normal logged-in change-password call uses the same method against the same kind of active session — Supabase does not require the current password here.
- Password complexity rule to reuse: `web/app/register/set-password/page.tsx` enforces `password.length < 8` (both a JS check and `minLength={8}` on the inputs) at registration time — this exact rule, not a new one, is what this screen must reuse.
- Mobile's Edit Profile (`app/(app)/profile/edit.tsx`) is already a sizeable, single-purpose screen (profile fields only — name, gender, marital status, birthdate). Rather than growing it with an unrelated concern, the change-password flow is a new sibling screen (mirroring how `preferences.tsx` is already its own separate screen off the profile menu, not crammed into Edit Profile), linked via a row/button from Edit Profile.
- No RLS/tenant-isolation invariant touched — this is a client-side call against the caller's own already-authenticated session, no service-role/cross-member access involved.

### Implementation Plan
1. **New screen `app/(app)/profile/change-password.tsx`**: new password + confirm new password fields (both `secureTextEntry`), client-side match check, `password.length < 8` validation reusing registration's exact rule, submit calls `supabase.auth.updateUser({ password })` directly. Success: confirmation message, navigate back to Edit Profile. Error: surface Supabase's returned error message (e.g. weak password, expired session) inline, same pattern as other mobile screens' error handling.
2. **`app/(app)/profile/edit.tsx`**: add a "Change Password" row/link near the bottom of the screen, navigating to the new screen.

### Files to Create/Modify
- `app/(app)/profile/change-password.tsx` (new)
- `app/(app)/profile/edit.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-186-mobile-self-service-change-password

### Commit Message
FP-186-mobile: add self-service change-password screen

### Pull Request Description
Maps to FP-186's mobile acceptance criteria: new Change Password screen off Edit Profile, reusing registration's existing 8-character minimum rule and calling `supabase.auth.updateUser({ password })` directly against the caller's own session — confirmed via web's existing `reset-password/confirm` flow that no current-password re-entry is required. Clear success/error feedback.

### Jira Linkage
- PDEEpicID: FP-170
- PDEStoryID: FP-186

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-186-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
