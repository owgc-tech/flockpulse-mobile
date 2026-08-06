### Story Summary
Mobile's `Avatar.tsx` currently derives its displayed role from the JWT session claim via its own duplicate hardcoded `ROLE_LABELS` map — the mobile-side gap left over from FP-192-web, which resolved this correctly for web but never touched mobile. `GET /api/members/me` (already consumed by `fetchMyProfile()`) already returns a resolved `role_display_name` field as of FP-192-web — this DIP just switches mobile to read it, deletes the now-dead local map, and removes the now-obsolete session-refresh workaround whose entire purpose was working around the stale-JWT-claim problem this fix eliminates.

### Repo Target
Mobile (Expo) — pure consumption of a field FP-192-web already ships; no backend changes.

### Grounding Check
Confirmed live against `owgc-tech/flockpulse-mobile` and `owgc-tech/flockpulse-web` `dev`:
- `getMyProfile()` (web `src/features/members/service.ts`) already selects `role, role_catalog_entry_id` and returns `{ ...member, role_display_name: roleDisplayName, groups }` — confirmed this is the actual response body of `GET /api/members/me`, not just an internal value used elsewhere.
- `updateMyProfile()` (the PATCH handler backing the same route) does **not** select or return `role`/`role_catalog_entry_id`/`role_display_name` — its `.select()` only has the five profile-edit fields. Mobile's `UpdatedProfile` type (`Omit<MyProfile, "groups">`) would incorrectly claim these three fields exist on a PATCH response if `MyProfile` is widened without also excluding them there.
- `Avatar.tsx`'s `role`/`roleLabel` (JWT-derived) is used only at line 112, nowhere else in the component. `session` (from `useSession()`) is used only to read that claim — no other use in the file. `supabase` (the module import) is used only inside `handleOpenProfile`'s `refreshSession()` call — no other use in the file. Removing the role-claim logic cleanly frees both imports as dead code, not a side effect requiring separate justification.
- `fetchMyProfile()` has its own doc comment confirming it's deliberately never cached, specifically because a prior cached version missed group renames made on web — the same no-cache behavior means a role change on web will already be picked up on next overlay-open without any session refresh.
- No RLS/RBAC/tenant-isolation invariant touched — this is a pure read-path swap on data already being returned correctly.

### Implementation Plan
1. **`src/features/members/types.ts`**: add `role: string; role_catalog_entry_id: string | null; role_display_name: string;` to `MyProfile`. Update `UpdatedProfile`'s definition from `Omit<MyProfile, "groups">` to `Omit<MyProfile, "groups" | "role" | "role_catalog_entry_id" | "role_display_name">`, since the PATCH response genuinely doesn't return these three.
2. **`src/features/profile/components/Avatar.tsx`**:
   - Delete the `ROLE_LABELS` const and its doc comment (dead code once nothing reads the raw role claim).
   - Replace `const role = session?.user.app_metadata?.role; const roleLabel = typeof role === "string" ? (ROLE_LABELS[role] ?? role) : "";` with `const roleLabel = profile?.role_display_name ?? "";`.
   - Remove `handleOpenProfile`'s `supabase.auth.refreshSession()` call and its explanatory comment (obsolete once role no longer comes from the session claim).
   - Remove the now-unused `useSession` import/hook call and `supabase` import.

### Files to Create/Modify
- `src/features/members/types.ts` (modify)
- `src/features/profile/components/Avatar.tsx` (modify)

### Migration Files (if applicable)
None.

### Branch Name
feature/FP-192-mobile-role-display-name

### Commit Message
FP-192-mobile: read role_display_name from profile instead of duplicate hardcoded map

### Pull Request Description
`Avatar.tsx` now reads `role_display_name` from `fetchMyProfile()`'s response (already resolved server-side as of FP-192-web) instead of deriving a label from the JWT session claim via its own duplicate hardcoded map. The now-unnecessary session-refresh workaround (whose sole purpose was catching role changes made on web) and its now-unused imports are removed as well, since `fetchMyProfile()`'s existing no-cache behavior already covers that case.

### Jira Linkage
- PDEEpicID: FP-8
- PDEStoryID: FP-192

### Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-192-mobile.md and do not append executor notes, observations, or any other content to that file after the initial save. Executor observations belong exclusively in the PR description. Open the PR against dev and stop. Do not merge — the user will check out the branch locally, test it against the deployed dev environment, and merge manually.

Include full diffs for every file in your completion report per Section 5, rule 12 — not a summary.
