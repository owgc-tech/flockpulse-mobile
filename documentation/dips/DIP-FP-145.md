DIP-FP-145.md
Story Summary
Adds a Dark Mode toggle to the Preferences screen, letting a member override the app's appearance instead of always following the device's OS-level setting. Grounding found useThemeColors() — the single hook every themed component in the app calls — reads useColorScheme() (the OS setting) directly with no override mechanism at all. This DIP adds a small app-level context holding the user's preference, consulted by that one hook before falling back to the OS setting — centralizing the change so none of the 23 files that already call useThemeColors() need to be touched.
Repo Target
Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile.
Grounding Check
Confirmed live against dev:

useThemeColors() (src/theme/useThemeColors.ts) is the only place useColorScheme() is called anywhere in the app — confirmed via repo-wide grep. Every other themed component (23 files) calls useThemeColors(), never useColorScheme() directly. This means the fix is genuinely centralized: modify this one hook, add one new context, and all 23 consumers automatically respect the override with zero changes to any of them.
A real bug this DIP must also fix, found during grounding, not in the original ticket: app/_layout.tsx renders <StatusBar style="auto" />, which follows the OS scheme directly, independent of useThemeColors(). If a member overrides to Light while their device is set to system Dark, the status bar icons would still render for a dark background (via "auto") while the app itself renders light — a visibly wrong status bar. This must be explicitly computed from the same effective theme (override-or-system) as everything else, not left on "auto".
Storage precedent: AsyncStorage, matching FP-110's reminderSettings.service.ts pattern exactly (plain string key, JSON not needed since the value is a single string) — no new storage mechanism introduced.
Design decision (per the story's "not everyone wants dark, give them a choice" framing — reasonably extended, not just literally a binary on/off): implemented as a three-way choice — System / Light / Dark — rather than a simple binary toggle. A binary "dark on/off" would permanently strand a user who wants their OS setting respected once they've turned dark "off," with no way back to following the system automatically. Three-way is a strict superset (picking "Light" achieves exactly what a binary "off" switch would) while preserving the system-following default for anyone who doesn't touch the setting at all. Flagging this explicitly since it's a reasonable but non-literal reading of the ticket.
Domain rules: no conflict — pure client-side display preference, no server sync (matching FP-110's local-only precedent), no data model impact.

Implementation Plan

New file src/theme/ThemePreferenceContext.tsx: a React Context holding preference: 'system' | 'light' | 'dark', loaded from AsyncStorage on mount (key "theme_preference_override", default "system" if unset/unparseable), with a setPreference() function that persists and updates state. Exports a ThemePreferenceProvider and a useThemePreference() hook.
app/_layout.tsx: wrap the existing <SafeAreaProvider> content in <ThemePreferenceProvider>. Compute the effective scheme (preference === 'system' ? useColorScheme() : preference) and pass the correct, explicit style to <StatusBar> ('light' for an effectively-dark theme, 'dark' for effectively-light) instead of "auto".
useThemeColors.ts: consume useThemePreference(); if preference !== 'system', use it directly; otherwise fall back to useColorScheme() exactly as today. Return shape (ThemeColors) is unchanged, so none of the 23 existing consumers need any changes.
app/(app)/preferences.tsx: add a new "Appearance" section with a three-way segmented control (System / Light / Dark) below the existing reminder-timing fields, calling setPreference() from the new context on change — applies immediately (context update triggers a re-render app-wide), no separate save button needed for this control (distinct from the reminder-hours fields, which do need an explicit Save).

Files to Create/Modify

src/theme/ThemePreferenceContext.tsx (new)
app/_layout.tsx
src/theme/useThemeColors.ts
app/(app)/preferences.tsx

Migration Files
Not applicable — mobile-only, local AsyncStorage, no backend.
Branch Name
feature/FP-145-dark-mode-toggle
Commit Message
FP-145: add System/Light/Dark appearance override to Preferences
Pull Request Description
Maps to acceptance criteria:

"Dark Mode toggle on Preferences screen" → three-way Appearance control, applies immediately.
"Local-only, no server sync" → AsyncStorage, matching FP-110's precedent exactly.
"Flag scope honestly if larger than a one-line toggle" → it is larger: a new context, a root-layout change, and a real StatusBar bug fix found during grounding — but centralized enough that none of the 23 existing themed components need any changes.
"Basic contrast/legibility in light mode" → not a new concern, lightColors already exists and is already used today whenever a device's OS is in light mode — this DIP doesn't introduce a new palette, only a new way to reach the existing one.

Jira Linkage

PDEEpicID: FP-31 (EPIC-8 — Notification System, screen-sharing placement only, not thematically related — noted on the original ticket)
PDEStoryID: FP-145

Stop Point
Save this DIP verbatim to documentation/dips/DIP-FP-145.md, frozen after save. Open PR against dev, do not merge. No migration, no remote step.
Include full diffs for every file in the completion report.
