# DIP-FP-122-FP-126

### Story Summary
Two mobile stories, one branch, one test session. **FP-122 (bug):** in the Confirmations tab, the loading spinner always renders on the "Attended" button regardless of which button was tapped, because a single shared `isSubmitting` boolean can't distinguish which decision is in flight — the fix is tracking *which* decision is submitting. **FP-126 (story):** dark mode phase 2 — theme the bottom tab bar and status bar, migrate every remaining unthemed screen using FP-124's established pattern, and add `placeholderTextColor` to all TextInputs. Bundled per Section 5.9: FP-122's fix edits a screen FP-126's sweep passes anyway, and both ship as one phone-testing pass.

**Not covered — deliberately excluded:** the "menu Joseph liked and wants to copy" (mentioned in testing, never specified — needs its own story once described); any new Settings screen (that's FP-110's blocked scope).

### Repo Target
**Mobile (Expo) — `owgc-tech/flockpulse-mobile`**, branch off `dev`. No web involvement, no migrations.

### Grounding Check
- Verified live against dev: `ConfirmationItem` in `app/(app)/(tabs)/confirmations/index.tsx` — both buttons share `disabled={isSubmitting}` (correct, keep), but only "Attended" conditionally renders `<ActivityIndicator/>`; exactly as FP-121's bug report describes.
- Verified live: `app/(app)/(tabs)/_layout.tsx` renders `<Tabs screenOptions={{ headerShown: false }}>` with **no tab bar styling at all** — hence the white bar in dark mode. It's a component with hooks already in use, so `useThemeColors()` slots in directly.
- **Grounding correction to FP-126's ticket:** no `FormationTalkPicker.tsx` / `MeetingResourcePicker.tsx` files exist. The only shared picker is `src/features/shared/components/MemberGroupPicker.tsx`; formation-talk and meeting-resource pickers are inline in Create/Edit Event and are covered by migrating those screens. Verify this on checkout; if the pickers turn out to be extracted elsewhere, flag rather than improvise.
- Unthemed files confirmed by listing: `events/create.tsx`, `events/[id]/edit.tsx`, `events/[id]/self-report.tsx`, `profile/edit.tsx`, `(auth)/_layout.tsx`, `(auth)/login.tsx`, `(auth)/mfa-enroll.tsx`, `(auth)/mfa-verify.tsx`, `src/features/auth/components/{LoginForm,MfaEnrollForm,MfaVerifyForm}.tsx`, `MemberGroupPicker.tsx`.
- Status bar handling in the root `app/_layout.tsx` was **not** inspected — verify live: if `expo-status-bar`'s `<StatusBar style="auto" />` is present it already follows the theme; if absent or hardcoded, add/fix it.
- Invariants untouched; no error codes; no schema.

### Implementation Plan
1. **Phase 0 (strict order):** branch off dev → live-verify the grounding claims above → save this DIP verbatim → code.
2. **FP-122 first (small, isolated):** in `ConfirmationItem`, replace `const [isSubmitting, setIsSubmitting] = useState(false)` with `const [submitting, setSubmitting] = useState<ConfirmationDecision | null>(null)`. Both buttons: `disabled={submitting !== null}` (preserves AC3 exactly). Each button renders its spinner only when `submitting` equals *its own* decision, using the identical `<ActivityIndicator color="#fff"/>` pattern "Attended" already has. Set to the decision in `handlePress`, reset to `null` in the same places the boolean is reset today (including error paths).
3. **Tab bar + status bar:** in `(tabs)/_layout.tsx`, call `useThemeColors()` and extend `screenOptions` with `tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border }`, `tabBarActiveTintColor: colors.accent`, `tabBarInactiveTintColor: colors.textMuted`. Verify the badge (`tabBarBadge`) remains legible in both themes; add `tabBarBadgeStyle` from tokens only if needed. Root layout: verify/add `<StatusBar style="auto" />` per the grounding note.
4. **Screen migrations — FP-124's exact pattern, no deviations:** base `StyleSheet.create` untouched for structure; color-bearing keys pulled into a `getThemedStyles(colors)` merged via style arrays; memoized. Apply to every file in the unthemed list above. `DIP-FP-124.md` in `documentation/dips/` is the reference implementation record. Forms are the bulk here: every `TextInput` gets `placeholderTextColor={colors.textMuted}` and themed `color`/`borderColor`.
5. **Placeholder sweep of already-themed screens:** grep all `TextInput` usages repo-wide; any without `placeholderTextColor` gets it — the known one is RsvpControls' decline-reason input (add the prop; its styles are already themed).
6. **`sectionHeaderBlank` watch-point:** inspect the blank current-month header style in `(tabs)/index.tsx`; if it hardcodes a light background, move that key into the themed set. If it's already correct, note so in the PR — don't touch it.
7. **Validation:** full-repo typecheck (`npx tsc --noEmit`) clean; grep sweep confirming no remaining hardcoded hex colors in migrated files except the deliberate white-on-accent button-text precedent from FP-124 (list any such exceptions in the PR description).

### Files to Create/Modify
```
app/(app)/(tabs)/confirmations/index.tsx          (FP-122 + any placeholder gaps)
app/(app)/(tabs)/_layout.tsx                      (tab bar theming)
app/_layout.tsx                                   (status bar — verify, fix only if needed)
app/(app)/(tabs)/index.tsx                        (sectionHeaderBlank watch-point only, if needed)
app/(app)/events/create.tsx
app/(app)/events/[id]/edit.tsx
app/(app)/events/[id]/self-report.tsx
app/(app)/profile/edit.tsx
app/(auth)/_layout.tsx
app/(auth)/login.tsx
app/(auth)/mfa-enroll.tsx
app/(auth)/mfa-verify.tsx
src/features/auth/components/LoginForm.tsx
src/features/auth/components/MfaEnrollForm.tsx
src/features/auth/components/MfaVerifyForm.tsx
src/features/shared/components/MemberGroupPicker.tsx
src/features/events/components/RsvpControls.tsx   (placeholderTextColor only)
documentation/dips/DIP-FP-122-FP-126.md           (new)
```

### Migration Files
None — no backend/schema changes.

### Branch Name
`feature/FP-122-FP-126-spinner-and-dark-mode-p2`

### Commit Message
`FP-122 FP-126: per-decision confirmation spinner; dark mode phase 2 (tab bar, remaining screens, placeholders)`

### Pull Request Description
- FP-122 AC1+AC2: spinner renders only on the tapped button → per-decision `submitting` state replaces the shared boolean.
- FP-122 AC3: both buttons disabled while either request is in flight → `disabled={submitting !== null}`.
- FP-126 AC1: tab bar + status bar follow theme → themed `tabBar*` options in `(tabs)/_layout.tsx`; status bar per root-layout verification.
- FP-126 AC2: all remaining screens migrated with the FP-124 pattern → per-file list with any deliberate exceptions.
- FP-126 AC3: `placeholderTextColor` on all TextInputs including RsvpControls → repo-wide grep evidence.
- FP-126 AC4: `sectionHeaderBlank` verified/fixed → outcome stated.
- FP-126 AC5: reserved for Joseph's on-device light+dark testing per Stop Point.

### Jira Linkage
- PDEEpicID: FP-11 (EPIC-3) — FP-122; FP-126 filed without a parent
- PDEStoryID: FP-122, FP-126

### Stop Point
Save this DIP verbatim to `documentation/dips/DIP-FP-122-FP-126.md`; never append to it — executor observations go in the PR description only. Typecheck must pass before pushing. Open the PR against `dev` and stop — do not merge. Full unelided diffs in the completion report per standing rule 12, including `git diff dev...<branch> -- app/(app)/(tabs)/index.tsx` as explicit proof if the watch-point needed no change.

**Post-PR sequence for Joseph (mobile workflow — test before merge):** after Atlas reviews the diffs, check out the branch locally, `npx expo start`, and test on both phones: tap **each** confirmation button separately and watch the spinner land on the right one; toggle light/dark on every migrated screen; check the tab bar and status bar in both modes; type into inputs and check placeholders. Merge on GitHub only after both platforms pass, then run `publish-dev-update.bat` so the phones' EAS snapshot catches up.
