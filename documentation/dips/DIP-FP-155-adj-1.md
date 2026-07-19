DIP-FP-155-adj-1.md

Story Summary

Two refinements to the not-yet-merged PR #33, from Joseph's live device testing. (1) A background area near/around the tab bar isn't following dark mode correctly, even though the oval's own background is confirmed correctly theme-aware — needs live investigation to pinpoint exactly which element is responsible, not a blind guess. (2) The tab bar sits too high — needs to move lower.

Repo Target

Mobile (Expo/React Native) — owgc-tech/flockpulse-mobile. Continues on the existing, unmerged feature/FP-155-animated-pill-tab-bar branch (PR #33) — not a new branch.

Grounding Check

	•	Confirmed correct already, do not re-touch: AnimatedTabBar.tsx's container style uses colors.cardBackground (theme-aware, deliberately distinct from colors.background so the oval stays visible against the screen) — this is the right token, already in place. _layout.tsx's old tabBarStyle background override was already correctly removed.
	•	Suspected but unconfirmed: something outside the oval itself — most likely the safe-area strip below/around the tab bar (the wrapper's padding area, or the root view behind it) — isn't following the theme. This needs to be found live, not guessed at from static code review; a second wrong fix wastes a round-trip.
	•	Placement: wrapper's current paddingTop: 8 and the paddingBottom (via insets.bottom > 0 ? insets.bottom : 12) together control vertical position — reduce top padding and/or adjust bottom to bring the whole bar lower, without letting it collide with the home indicator/safe area on notched devices.

Implementation Plan

	1.	Dark mode investigation: check every element in and around AnimatedTabBar.tsx and its parent rendering context for anything not using a theme-aware color — specifically the space outside container (the wrapper's own background, which currently has none set — confirm what shows through it), and the root view/screen background behind the whole tab bar area. Take a screenshot comparison in both light and dark mode as part of verifying the fix, don't just assume the fix worked from code alone.
	2.	Placement: reduce wrapper.paddingTop and/or adjust the bottom spacing so the bar sits lower — test on a real device with a home indicator (notched) to confirm it doesn't collide with the safe area at the new position.

Files to Create/Modify

	•	src/features/navigation/AnimatedTabBar.tsx
	•	Possibly app/(app)/(tabs)/_layout.tsx or a root-level layout file, if the dark-mode investigation finds the issue there instead

Migration Files

Not applicable.

Branch Name

Continue on the existing feature/FP-155-animated-pill-tab-bar branch — do not create a new one.

Commit Message

FP-155: fix dark-mode background gap and lower tab bar placement (pre-merge revision)

Pull Request Description

Amend PR #33: fixes a dark-mode background inconsistency found in live testing (root cause to be confirmed by implementation, not assumed in this DIP) and lowers the tab bar's vertical position per Joseph's feedback.

Jira Linkage

	•	PDEEpicID: FP-31 (EPIC-8)
	•	PDEStoryID: FP-155

Stop Point

Save this DIP verbatim to documentation/dips/DIP-FP-155-adj-1.md on the same branch, frozen after save. Push as additional commits to the same PR #33. Do not merge.

Include full diffs, plus a description of exactly what was found causing the dark-mode issue (not just the fix) in the completion report.
