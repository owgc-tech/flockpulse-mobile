# DIP-FP-124

## Story Summary

Adds automatic light/dark theming to the mobile app, following the phone's own system appearance setting (confirmed decision — not a custom time-based schedule). Establishes a proper color-token theme foundation and migrates the highest-traffic screens (My Events, Confirmations, Self-Report tab, Event Detail, the persistent Community Banner/Avatar chrome, and the auth/biometric-lock screen) to use it. Lower-traffic screens (Create/Edit Event, Profile Edit, the modal pickers, registration/MFA screens) are deliberately out of scope for this DIP — flagged explicitly as a follow-up, not silently incomplete.

## Repo Target

Mobile (Expo) — `owgc-tech/flockpulse-mobile`. No web involvement.

## Grounding Check

- Confirmed live: zero theming infrastructure exists anywhere in this codebase today — every screen's `StyleSheet.create({...})` hardcodes light-only hex values (`backgroundColor: "#fff"`, `color: "#333"`, etc.) at module scope, meaning colors can't react to a hook value the normal way (`StyleSheet.create` runs once, outside any component).
- Design decision, confirmed: follow `useColorScheme()` from `react-native` (already a core RN API, no new dependency needed) — reacts automatically to OS changes, including the OS's own "Automatic" time-based dark mode setting.
- Migration pattern, to minimize risk across many files: keep each screen's existing `StyleSheet.create({...})` exactly as-is for all structural properties (padding, flexDirection, fontSize, borderRadius, gap) — only pull out color-specific keys (`backgroundColor`, `color`, `borderColor`) into a small themed-styles object computed from the hook at render time, then merge both style objects on each element (`style={[styles.container, themed.container]}`). This is a smaller, lower-risk diff per screen than rewriting each file's styles from scratch, and keeps structural layout completely untouched.
- Not yet verified — verify live before writing code: whether any screen currently reads `StyleSheet` values by reference elsewhere in a way that would break if a color key is removed from the base `StyleSheet.create` object (e.g., style-array spreading patterns). Spot-check each in-scope file's usage before editing, don't assume uniformity.

## Implementation Plan

**1. Theme foundation (new):**

`src/theme/colors.ts`:

```ts
export const lightColors = {
  background: "#fff",
  backgroundSecondary: "#f5f5f5",
  cardBackground: "#f5f5f5",
  text: "#111",
  textSecondary: "#555",
  textMuted: "#999",
  border: "#eee",
  divider: "#ddd",
  accent: "#2563eb",
  danger: "#dc2626",
  success: "#16a34a",
};

export const darkColors = {
  background: "#000",
  backgroundSecondary: "#1c1c1e",
  cardBackground: "#1c1c1e",
  text: "#f5f5f5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  border: "#2c2c2e",
  divider: "#3a3a3c",
  accent: "#3b82f6",
  danger: "#ef4444",
  success: "#22c55e",
};

export type ThemeColors = typeof lightColors;
```

`src/theme/useThemeColors.ts`:

```ts
import { useColorScheme } from "react-native";
import { lightColors, darkColors, type ThemeColors } from "./colors";

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? darkColors : lightColors;
}
```

**2. Worked example — migrate `app/(app)/(tabs)/index.tsx` (My Events) first**, fully, as the reference pattern the remaining in-scope screens should follow:

- Call `const colors = useThemeColors();` inside the component.
- Build a small `getThemedStyles(colors)` function (or inline `useMemo`) returning just the color-bearing style keys (`container.backgroundColor`, `sectionHeader.backgroundColor`/`borderBottomColor`, text colors, etc.).
- Apply via array-merge on each relevant element.
- Leave every structural/layout property in the existing `StyleSheet.create` untouched.

**3. Apply the same pattern to the remaining in-scope screens:**

- `app/(app)/(tabs)/confirmations/index.tsx`
- `app/(app)/(tabs)/self-report/index.tsx`
- `app/(app)/events/[id].tsx` (Event Detail)
- `src/features/tenant/components/CommunityBanner.tsx`
- `src/features/profile/components/Avatar.tsx` (including the Profile Card popover)
- `app/(app)/_layout.tsx` (the biometric-lock screen specifically — first thing a user sees on a cold app open, worth getting right)

**4. Deliberately out of scope for this DIP — do not touch, note in PR description as explicit follow-up:**

- `app/(app)/events/create.tsx`, `app/(app)/events/[id]/edit.tsx`, `app/(app)/events/[id]/self-report.tsx`, `app/(app)/profile/edit.tsx`
- Any modal-list pickers (`FormationTalkPicker`, `MeetingResourcePicker`, `MemberGroupPicker`)
- Registration/MFA-enrollment/login screens (`app/(auth)/...`)

## Files to Create/Modify

```
src/theme/colors.ts                                        (new)
src/theme/useThemeColors.ts                                 (new)
app/(app)/(tabs)/index.tsx                                  (modified)
app/(app)/(tabs)/confirmations/index.tsx                    (modified)
app/(app)/(tabs)/self-report/index.tsx                      (modified)
app/(app)/events/[id].tsx                                   (modified)
src/features/tenant/components/CommunityBanner.tsx          (modified)
src/features/profile/components/Avatar.tsx                  (modified)
app/(app)/_layout.tsx                                       (modified)
```

## Migration Files

None — no backend/schema changes.

## Branch Name

`feature/FP-124-mobile-dark-mode`

## Commit Message

`FP-124: add automatic light/dark theming (system-appearance-based), migrate core screens`

## Pull Request Description

Maps to FP-124's ACs for the in-scope screens: background/text colors automatically follow the phone's system appearance setting via `useColorScheme()`, verified legible in both modes (not just "doesn't crash" — actual contrast check in the dark palette). Explicitly lists which screens were migrated and which were deliberately deferred as follow-up work, per the DIP's own scope boundary.

## Jira Linkage

- PDEEpicID: FP-11
- PDEStoryID: FP-124

## Stop Point

Save this DIP verbatim to `documentation/dips/DIP-FP-124.md`. Open the PR against `dev` and stop — do not merge. The user reviews, merges, then tests both light and dark by toggling their phone's system appearance setting while the app is open.
