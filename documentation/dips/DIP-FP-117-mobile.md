# DIP-FP-113-mobile

### Story Summary

Replaces the app's single-screen structure with real tab navigation (My Events, Confirmations — Leader/Admin only), moves Sign Out out of the header into a new Profile Card reached via a circular initials avatar, and adds a full editable Profile screen — consuming `GET/PATCH /api/members/me` (merged in FP-112).

### Repo Target

Mobile only.

### Grounding Check

* Confirmations tab is hidden entirely for Members, not just empty — a one-line role check using the same `session.user.app_metadata?.role` pattern already used throughout the app.
* Avatar placement, resolved from description: small circular initials avatar sits where Sign Out currently is (top-right of the header, present on every screen). Tapping it opens the Profile Card — large centered avatar, name centered below it, then Profile and Sign Out buttons. Tapping Profile opens the editable form (new screen); tapping Sign Out signs out directly, same as today.
* Initials require the user's own name — confirmed nothing currently fetches this; `GET /api/members/me` (FP-112, merged) provides it directly, fetched once and cached per session, same pattern as the old `fetchAttendanceWindowHours()`.
* Editable fields and options confirmed against actual DB constraints, not the stale web form: gender `MALE`/`FEMALE`; marital status `SINGLE`/`MARRIED`/`WIDOWED`/`DIVORCED`/`SEPARATED` (full FP-105-widened set).
* Tab navigation is a real structural change — `(app)/_layout.tsx` currently renders a single `<Stack>` after the auth/biometric gate resolves. This becomes a tab navigator wrapping two stacks, with the gate logic itself completely untouched — only what renders once `gate.phase === 'ready'` changes.
* Branched off PR #6's branch, not `dev` (see intro note) — this DIP's own diff should only include what it actually adds; don't re-attribute PR #6's changes as part of this DIP's summary/PR description.

### Implementation Plan

1. New `src/features/members/types.ts` and `services/myProfile.service.ts`: `fetchMyProfile()` (`GET /api/members/me`, cached per session), `updateMyProfile(patch)` (`PATCH /api/members/me`).
2. Restructure `(app)/_layout.tsx`: after the gate resolves to `ready`, render a tab navigator (`expo-router`'s `Tabs`) with two tabs — My Events (wraps the existing events stack unchanged) and Confirmations (rendered only if `role !== 'MEMBER'`, wraps the existing `confirmations/index.tsx` from PR #6). Shared header supplies the avatar in the top-right on both tabs.
3. New `src/features/profile/components/Avatar.tsx`: small circular badge, initials from first+last name, tappable, navigates to the Profile Card.
4. New `app/(app)/profile/index.tsx` (Profile Card): fetches `fetchMyProfile()`, renders large centered avatar, centered name, group list, Profile button (→ edit screen), Sign Out button (existing `signOut()` logic, moved here from `(app)/index.tsx`).
5. New `app/(app)/profile/edit.tsx`: form pre-filled from `fetchMyProfile()` — first/last name (text), gender (two-option picker), marital status (five-option picker), birthdate (date picker) — submits via `updateMyProfile()`.
6. `app/(app)/index.tsx`: remove the Sign Out header button and its handler — lives solely on the Profile Card now.

### Files to Create/Modify

```
app/(app)/_layout.tsx                          (modified — tabs, avatar header)
app/(app)/index.tsx                            (modified — remove Sign Out)
app/(app)/profile/index.tsx                    (new — Profile Card)
app/(app)/profile/edit.tsx                     (new — edit form)
src/features/members/types.ts                  (new)
src/features/members/services/myProfile.service.ts   (new)
src/features/profile/components/Avatar.tsx     (new)
```

### Migration Files (if applicable)

None.

### Branch Name

`feature/FP-113-mobile-navigation-profile` (created from `feature/FP-97-98-mobile-self-report-confirmation-reminders`, per Grounding Check)

### Commit Message

`FP-113-mobile: tab navigation, profile card, and editable profile screen`

### Pull Request Description

* Tab navigation replaces the single-screen structure: My Events, Confirmations (Leader/Admin only).
* Sign Out moves off the header entirely, onto the new Profile Card, reached via a circular initials avatar.
* Full editable profile screen, backed by `GET/PATCH /api/members/me` (FP-112).
* Note in the PR description that this branch is stacked on PR #6 and its base will need retargeting to `dev` once PR #6 merges.

### Jira Linkage

* PDEEpicID: FP-11 (EPIC-3) / FP-5 (EPIC-1) — spans both
* PDEStoryID: new story, to be filed once reviewed

### Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-113-mobile.md` and do not append executor notes, observations, or any other content to that file after the initial save. Open the PR against PR #6's branch (per Grounding Check) and stop. Do not merge — test via `expo start` + Expo Go, then merge manually once confirmed.

Include full diffs for every file in the completion report per Section 5, rule 12 — not a summary.
